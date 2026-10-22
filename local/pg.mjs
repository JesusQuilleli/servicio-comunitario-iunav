#!/usr/bin/env node
/**
 * CLI del PostgreSQL embebido del kit local de Servicio Comunitario IUNAV.
 *
 *   node pg.mjs start       levanta el cluster (lo inicializa la primera vez)
 *   node pg.mjs stop        lo detiene
 *   node pg.mjs status      dice si esta en marcha
 *   node pg.mjs ensure-db   crea app_iunav y app_iunav_test si no existen
 *
 * Como funciona:
 * - El cluster vive en `local/.pgdata` y es PERSISTENTE: los datos sobreviven
 *   a los reinicios del PC. `initialise()` solo se llama la primera vez (se
 *   detecta por el archivo `PG_VERSION` de la carpeta de datos).
 * - La contrasena de la base y el secreto del JWT se generan una sola vez y
 *   quedan en `local/.env.local` (ignorado por git). Regenerarlos dejaria el
 *   cluster con la contrasena vieja.
 * - El cluster se sostiene con un proceso aparte ("demonio") que queda
 *   escuchando en segundo plano. Por eso `start` devuelve el control de
 *   inmediato y `stop` le pide que se cierre.
 *
 * Este archivo no toca `server/.env`: la API recibe sus variables de entorno
 * por herencia, y `dotenv` no pisa lo que ya esta en el entorno.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';
import {
  ARCHIVO_ENV,
  ARCHIVO_LOG_PG,
  ARCHIVO_PID_PG,
  ARCHIVO_STOP_PG,
  BASE_DATOS,
  BASE_DATOS_PRUEBAS,
  DIR_DATOS,
  DIR_LOGS,
  PUERTO_PG,
  USUARIO_PG,
  asegurarEnvLocal,
  borrarArchivo,
  esperarPuerto,
  leerPid,
  procesoVivo,
  puertoOcupado
} from './config.mjs';

const RUTA_PG_MJS = fileURLToPath(import.meta.url);

/** Opciones de cluster que se pasan a la libreria en todos los comandos. */
function opcionesCluster(password) {
  return {
    databaseDir: DIR_DATOS,
    user: USUARIO_PG,
    password,
    port: PUERTO_PG,
    // Persistente: al parar NO se borran los datos de la carpeta .pgdata.
    persistent: true
  };
}

/** Crea las bases que falten. Sirve tanto desde el demonio como desde `ensure-db`. */
async function crearBasesQueFalten(pg) {
  const cliente = pg.getPgClient('postgres', '127.0.0.1');
  await cliente.connect();
  try {
    for (const nombre of [BASE_DATOS, BASE_DATOS_PRUEBAS]) {
      const { rows } = await cliente.query('select 1 from pg_database where datname = $1', [
        nombre
      ]);
      if (rows.length === 0) {
        try {
          await cliente.query(`create database "${nombre}"`);
          console.log(`Base de datos creada: ${nombre}`);
        } catch (err) {
          // Si el demonio la creo al mismo tiempo, PostgreSQL responde con
          // 42P04 (duplicate_database) o 23505 (indice unico de pg_database).
          // En ese caso el resultado ya es el que queriamos.
          if (err?.code === '42P04' || err?.code === '23505') {
            console.log(`Base de datos ya existe: ${nombre}`);
          } else {
            throw err;
          }
        }
      } else {
        console.log(`Base de datos ya existe: ${nombre}`);
      }
    }
  } finally {
    await cliente.end();
  }
}

/**
 * Cierra las conexiones abiertas y deja el disco consistente antes de bajar
 * el cluster. Asi, aunque el proceso de PostgreSQL termine de golpe, los datos
 * quedan escritos y la proxima arranque solo tiene que recuperar lo ultimo.
 */
async function cerrarConexiones(pg) {
  const cliente = pg.getPgClient('postgres', '127.0.0.1');
  await cliente.connect();
  try {
    await cliente.query('checkpoint');
    await cliente.query(
      'select pg_terminate_backend(pid) from pg_stat_activity where pid <> pg_backend_pid()'
    );
  } finally {
    await cliente.end();
  }
}

/** Comprueba que se puede conectar con la contrasena guardada. */
async function comprobarConexion(password, intentos = 5) {
  for (let i = 0; i < intentos; i += 1) {
    const pg = new EmbeddedPostgres(opcionesCluster(password));
    const cliente = pg.getPgClient('postgres', '127.0.0.1');
    try {
      await cliente.connect();
      await cliente.query('select 1');
      await cliente.end();
      return true;
    } catch {
      try {
        await cliente.end();
      } catch {
        /* nada */
      }
      await new Promise((r) => setTimeout(r, 800));
    }
  }
  return false;
}

/** Mata un proceso y, en Windows, tambien todos sus hijos. */
function matarArbol(pid) {
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { stdio: 'ignore' });
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* ya no esta */
      }
    }
  }
}

/**
 * Proceso en segundo plano que sostiene el cluster.
 * No se llama a mano: `start` lo lanza.
 */
async function demonio() {
  const { valores } = asegurarEnvLocal();
  const password = valores.PG_PASSWORD;

  const pg = new EmbeddedPostgres(opcionesCluster(password));
  try {
    await pg.start();
  } catch (err) {
    console.error('No se pudo arrancar PostgreSQL local:', err?.message ?? err);
    process.exit(1);
  }

  try {
    await crearBasesQueFalten(pg);
  } catch (err) {
    console.error('Aviso: no se pudieron revisar las bases de datos:', err?.message ?? err);
  }

  fs.mkdirSync(DIR_LOGS, { recursive: true });
  fs.writeFileSync(ARCHIVO_PID_PG, String(process.pid));
  console.log(`PostgreSQL local en marcha en el puerto ${PUERTO_PG} (pid ${process.pid}).`);

  let cerrando = false;
  const parar = async () => {
    if (cerrando) return;
    cerrando = true;
    console.log('Cerrando PostgreSQL local...');
    try {
      await cerrarConexiones(pg);
    } catch (err) {
      console.error('Aviso al cerrar conexiones:', err?.message ?? err);
    }
    try {
      await pg.stop();
    } catch (err) {
      console.error('Aviso al detener el cluster:', err?.message ?? err);
    }
    borrarArchivo(ARCHIVO_PID_PG);
    console.log('PostgreSQL local detenido.');
    process.exit(0);
  };

  process.on('SIGINT', () => void parar());
  process.on('SIGTERM', () => void parar());

  // Vigila la peticion de parada que escribe `pg.mjs stop`.
  // Este temporizador sin `unref` mantiene vivo el proceso a proposito.
  setInterval(() => {
    if (fs.existsSync(ARCHIVO_STOP_PG)) {
      borrarArchivo(ARCHIVO_STOP_PG);
      void parar();
    }
  }, 400);
}

/** `pg.mjs start` */
async function comandoStart() {
  fs.mkdirSync(DIR_LOGS, { recursive: true });

  let valores;
  try {
    ({ valores } = asegurarEnvLocal());
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
  if (valores.nuevo) {
    console.log('Se genero local/.env.local con la contrasena de la base y el secreto del JWT.');
  }

  const pid = leerPid(ARCHIVO_PID_PG);
  if (pid && procesoVivo(pid)) {
    console.log(`La base de datos local ya esta en marcha en el puerto ${PUERTO_PG}.`);
    return;
  }
  if (pid) borrarArchivo(ARCHIVO_PID_PG);
  borrarArchivo(ARCHIVO_STOP_PG);

  if (await puertoOcupado(PUERTO_PG)) {
    console.error(`ERROR: el puerto ${PUERTO_PG} ya esta ocupado por otro programa.`);
    console.error('Cierra el programa que lo este usando (o reinicia el PC) y vuelve a intentarlo.');
    process.exit(1);
  }

  if (!fs.existsSync(path.join(DIR_DATOS, 'PG_VERSION'))) {
    console.log('Primera vez: se prepara la base de datos local. Puede tardar un minuto...');
    const pg = new EmbeddedPostgres({
      ...opcionesCluster(valores.PG_PASSWORD),
      // El ruido de initdb no le interesa al usuario: si algo falla, el error
      // que se muestra ya incluye la salida de initdb.
      onLog: () => {},
      onError: () => {}
    });
    try {
      await pg.initialise();
    } catch (err) {
      console.error('ERROR: no se pudo preparar la base de datos local:', err?.message ?? err);
      process.exit(1);
    }
    console.log('Base de datos local preparada.');
  }

  const log = fs.openSync(ARCHIVO_LOG_PG, 'a');
  const hijo = spawn(process.execPath, [RUTA_PG_MJS, 'demonio'], {
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log]
  });
  hijo.unref();
  fs.closeSync(log);

  const listo = await esperarPuerto(PUERTO_PG, 60000);
  if (!listo) {
    console.error(`ERROR: PostgreSQL local no respondio en el puerto ${PUERTO_PG}.`);
    console.error(`Revisa el archivo ${ARCHIVO_LOG_PG} para ver el detalle del fallo.`);
    process.exit(1);
  }

  if (!(await comprobarConexion(valores.PG_PASSWORD))) {
    console.error('ERROR: el cluster arranco pero no se puede conectar con la contrasena guardada.');
    console.error(`Revisa el archivo ${ARCHIVO_LOG_PG}.`);
    process.exit(1);
  }

  // No se espera al demonio: las bases se aseguran aqui, antes de devolver el
  // control, para que quien llame a `start` (instalar.cmd, iniciar.cmd) pueda
  // crear el esquema sin carreras con la creacion que hace el demonio.
  const pg = new EmbeddedPostgres(opcionesCluster(valores.PG_PASSWORD));
  try {
    await crearBasesQueFalten(pg);
  } catch (err) {
    console.error('ERROR: no se pudieron crear las bases de datos:', err?.message ?? err);
    process.exit(1);
  }

  console.log(`Base de datos local lista en el puerto ${PUERTO_PG}.`);
}

/** `pg.mjs stop` */
async function comandoStop() {
  const pid = leerPid(ARCHIVO_PID_PG);
  if (!pid) {
    console.log('La base de datos local ya esta detenida.');
    return;
  }
  if (!procesoVivo(pid)) {
    borrarArchivo(ARCHIVO_PID_PG);
    console.log('La base de datos local ya esta detenida.');
    return;
  }

  console.log('Cerrando la base de datos local...');
  fs.mkdirSync(DIR_LOGS, { recursive: true });
  fs.writeFileSync(ARCHIVO_STOP_PG, String(Date.now()));

  let cerrada = false;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (!procesoVivo(pid)) {
      cerrada = true;
      break;
    }
  }

  if (!cerrada) {
    console.log('El cluster no respondio a la peticion de parada; se cierra a la fuerza.');
    matarArbol(pid);
    for (let i = 0; i < 20; i += 1) {
      await new Promise((r) => setTimeout(r, 250));
      if (!procesoVivo(pid)) break;
    }
  }

  borrarArchivo(ARCHIVO_PID_PG);
  borrarArchivo(ARCHIVO_STOP_PG);
  console.log('Base de datos local detenida.');
}

/** `pg.mjs status` */
async function comandoStatus() {
  console.log('Estado de la base de datos local');
  console.log(`  Puerto:    ${PUERTO_PG}`);
  console.log(`  Datos:     ${DIR_DATOS}`);
  console.log(`  Config:    ${ARCHIVO_ENV}`);

  const pid = leerPid(ARCHIVO_PID_PG);
  if (pid && procesoVivo(pid)) {
    console.log(`  Proceso:   en marcha (pid ${pid})`);
  } else if (pid) {
    console.log('  Proceso:   apagado (quedo un pid viejo en logs/postgres.pid)');
  } else {
    console.log('  Proceso:   apagado');
  }

  const responde = await puertoOcupado(PUERTO_PG);
  console.log(`  Conexion:  ${responde ? 'el puerto responde' : 'el puerto no responde'}`);

  const inicializado = fs.existsSync(path.join(DIR_DATOS, 'PG_VERSION'));
  console.log(`  Cluster:   ${inicializado ? 'inicializado' : 'sin inicializar (se hara en el primer arranque)'}`);

  if (responde) {
    const valores = (() => {
      try {
        return asegurarEnvLocal().valores;
      } catch {
        return null;
      }
    })();
    if (valores) {
      try {
        const pg = new EmbeddedPostgres(opcionesCluster(valores.PG_PASSWORD));
        const cliente = pg.getPgClient('postgres', '127.0.0.1');
        await cliente.connect();
        const { rows } = await cliente.query(
          'select datname from pg_database where datname = any($1) order by datname',
          [[BASE_DATOS, BASE_DATOS_PRUEBAS]]
        );
        await cliente.end();
        console.log(`  Bases:     ${rows.map((f) => f.datname).join(', ') || 'ninguna'}`);
      } catch (err) {
        console.log(`  Bases:     no se pudieron leer (${err?.message ?? err})`);
      }
    }
  }
}

/** `pg.mjs ensure-db` */
async function comandoEnsureDb() {
  const { valores } = asegurarEnvLocal();

  if (!(await puertoOcupado(PUERTO_PG))) {
    console.error(`ERROR: la base de datos local no esta en marcha en el puerto ${PUERTO_PG}.`);
    console.error('Arrancala primero con: node pg.mjs start');
    process.exit(1);
  }

  const pg = new EmbeddedPostgres(opcionesCluster(valores.PG_PASSWORD));
  try {
    await crearBasesQueFalten(pg);
  } catch (err) {
    console.error('ERROR: no se pudieron crear las bases de datos:', err?.message ?? err);
    process.exit(1);
  }
}

async function main() {
  const comando = (process.argv[2] ?? '').toLowerCase();
  switch (comando) {
    case 'start':
      await comandoStart();
      break;
    case 'stop':
      await comandoStop();
      break;
    case 'status':
      await comandoStatus();
      break;
    case 'ensure-db':
      await comandoEnsureDb();
      break;
    case 'demonio':
      await demonio();
      break;
    default:
      console.log('Uso: node pg.mjs start | stop | status | ensure-db');
      process.exitCode = 1;
  }
}

await main();
