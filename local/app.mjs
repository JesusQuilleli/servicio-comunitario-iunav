/**
 * Lanzador de la API y la web del kit local.
 *
 * Sustituye al `start ... cmd /k` que usaba antes `iniciar.cmd`: aquel metodo
 * abria dos ventanas pero no dejaba rastro de sus PID, asi que `detener.cmd`
 * no podia cerrarlas. El sintoma era que la base se apagaba pero las ventanas
 * seguian vivas y el siguiente `iniciar.cmd` moria con "puerto ocupado".
 *
 * Aqui cada servicio se lanza en segundo plano, su PID se guarda en
 * `logs/api.pid` / `logs/web.pid` y su salida va a `logs/api.log` /
 * `logs/web.log` (util para diagnosticar sin depender de la ventana).
 *
 * Comandos:
 *   node app.mjs start    arranca API y web, espera a que respondan y abre el navegador
 *   node app.mjs stop     cierra los dos servicios por PID
 *   node app.mjs status   dice si estan en marcha
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import {
  ARCHIVO_ENV_WEB,
  ARCHIVO_PID_API,
  ARCHIVO_PID_WEB,
  BASE_DATOS,
  BASE_DATOS_PRUEBAS,
  DIR_LOGS,
  DIR_SERVIDOR,
  DIR_WEB,
  PUERTO_API,
  PUERTO_WEB,
  asegurarEnvLocal,
  borrarArchivo,
  leerPid,
  procesoVivo,
  puertoOcupado,
  urlBaseDeDatos
} from './config.mjs';

/** Ruta del log de cada servicio. */
const LOG_API = path.join(DIR_LOGS, 'api.log');
const LOG_WEB = path.join(DIR_LOGS, 'web.log');

/** Direcciones que se abren/consultan. */
const URL_WEB = `http://localhost:${PUERTO_WEB}`;
const URL_SALUD = `http://127.0.0.1:${PUERTO_API}/api/health`;

/** Entorno con el que corre la API: apunta al PostgreSQL del kit. */
function entornoApi(valores) {
  return {
    ...process.env,
    DATABASE_URL: urlBaseDeDatos(BASE_DATOS, valores.PG_PASSWORD),
    TEST_DATABASE_URL: urlBaseDeDatos(BASE_DATOS_PRUEBAS, valores.PG_PASSWORD),
    DB_SSL: 'false',
    JWT_SECRET: valores.JWT_SECRET,
    JWT_EXPIRES_IN: '8h',
    PORT: String(PUERTO_API),
    API_HOST: '127.0.0.1',
    FRONTEND_URL: URL_WEB,
    UPLOAD_DIR: 'uploads',
    NODE_ENV: 'development'
  };
}

/** Entorno con el que corre la web: habla con la API local. */
function entornoWeb() {
  return { ...process.env, NEXT_PUBLIC_API_URL: `http://localhost:${PUERTO_API}` };
}

/** Nombre del ejecutable de un PID (para no matar un proceso ajeno por PID reciclado). */
function nombreProceso(pid) {
  if (process.platform !== 'win32') return 'node';
  try {
    const salida = execFileSync(
      'tasklist',
      ['/FI', `PID eq ${pid}`, '/FO', 'CSV', '/NH'],
      { encoding: 'utf8', windowsHide: true }
    );
    const corte = salida.match(/^"([^"]+)"/m);
    return corte ? corte[1].toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Dice si el PID guardado sigue siendo uno de nuestros lanzadores. */
function esNuestro(pid) {
  if (!procesoVivo(pid)) return false;
  const nombre = nombreProceso(pid);
  if (nombre === null) return false;
  return process.platform === 'win32' ? nombre === 'cmd.exe' || nombre === 'node.exe' : true;
}

/** Mata un proceso y todos sus hijos. */
function matarArbol(pid) {
  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true
      });
    } catch {
      /* ya no estaba */
    }
  } else {
    try {
      process.kill(-pid, 'SIGKILL');
    } catch {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        /* ya no estaba */
      }
    }
  }
}

/** Espera a que un proceso desaparezca. */
async function esperarMuerte(pid, milisegundos) {
  const limite = Date.now() + milisegundos;
  while (Date.now() < limite) {
    if (!procesoVivo(pid)) return true;
    await new Promise((r) => setTimeout(r, 250));
  }
  return !procesoVivo(pid);
}

/** Lanza `npm run dev` desacoplado, guarda su PID y su log. */
function lanzar(nombre, cwd, env, archivoPid, archivoLog) {
  fs.mkdirSync(DIR_LOGS, { recursive: true });
  const log = fs.openSync(archivoLog, 'a');
  fs.writeSync(
    log,
    `\n===== ${nombre} — arranque ${new Date().toISOString()} =====\n`
  );

  // En Windows `npm` es `npm.cmd`, que solo se resuelve a traves de cmd.exe.
  // Se lanza cmd.exe con una unica cadena para no pasar argumentos sin escapar
  // (Node avisa con DEP0190 si se combinan `shell: true` y argumentos).
  const [ejecutable, argumentos] =
    process.platform === 'win32'
      ? [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run dev']]
      : ['npm', ['run', 'dev']];

  const hijo = spawn(ejecutable, argumentos, {
    cwd,
    env,
    detached: true,
    windowsHide: true,
    stdio: ['ignore', log, log]
  });

  fs.closeSync(log);
  hijo.unref();
  fs.writeFileSync(archivoPid, String(hijo.pid));
  return hijo.pid;
}

/** Ultimas lineas de un log, para adjuntarlas a un mensaje de error. */
function colaDeLog(archivo, lineas = 15) {
  try {
    const texto = fs.readFileSync(archivo, 'utf8');
    return texto.split(/\r?\n/).filter(Boolean).slice(-lineas).join('\n');
  } catch {
    return '(sin registro)';
  }
}

/** Espera a que responda el health de la API con base de datos conectada. */
async function esperarSalud(milisegundos) {
  const limite = Date.now() + milisegundos;
  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(URL_SALUD, { signal: AbortSignal.timeout(3000) });
      const datos = await respuesta.json();
      if (datos.ok === true && datos.baseDeDatos === true) return true;
    } catch {
      /* aun no responde */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Espera a que la web sirva una pagina (no solo a que abra el puerto). */
async function esperarWeb(milisegundos) {
  const limite = Date.now() + milisegundos;
  while (Date.now() < limite) {
    try {
      const respuesta = await fetch(URL_WEB, {
        signal: AbortSignal.timeout(5000),
        redirect: 'manual'
      });
      if (respuesta.status < 500) return true;
    } catch {
      /* Next todavia compilando */
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

/** Abre el navegador con la web. */
function abrirNavegador() {
  if (process.platform === 'win32') {
    spawn('cmd', ['/d', '/s', '/c', `start "" "${URL_WEB}"`], {
      detached: true,
      windowsHide: true,
      stdio: 'ignore'
    }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', [URL_WEB], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('xdg-open', [URL_WEB], { detached: true, stdio: 'ignore' }).unref();
  }
}

/** Se asegura de que `web/.env.local` apunte a la API local. */
function asegurarEnvWeb() {
  if (fs.existsSync(ARCHIVO_ENV_WEB)) return false;
  fs.writeFileSync(ARCHIVO_ENV_WEB, `NEXT_PUBLIC_API_URL=http://localhost:${PUERTO_API}\n`, 'utf8');
  return true;
}

/** `app.mjs start` */
async function comandoStart() {
  const valores = asegurarEnvLocal().valores;

  const pidApi = leerPid(ARCHIVO_PID_API);
  const pidWeb = leerPid(ARCHIVO_PID_WEB);
  if (pidApi && esNuestro(pidApi) && pidWeb && esNuestro(pidWeb)) {
    console.log('La API y la web ya estan en marcha.');
    console.log(`  Web: ${URL_WEB}`);
    console.log('Si quieres reiniciarlas, ejecuta primero detener.cmd.');
    return;
  }

  if (pidApi && !esNuestro(pidApi)) borrarArchivo(ARCHIVO_PID_API);
  if (pidWeb && !esNuestro(pidWeb)) borrarArchivo(ARCHIVO_PID_WEB);

  if (await puertoOcupado(PUERTO_API)) {
    console.error(`ERROR: el puerto ${PUERTO_API} ya esta ocupado por otro programa.`);
    console.error('Cierra ese programa (o reinicia el equipo) y vuelve a intentarlo.');
    console.error('Si crees que es una ejecucion anterior, ejecuta: detener.cmd');
    process.exitCode = 1;
    return;
  }
  if (await puertoOcupado(PUERTO_WEB)) {
    console.error(`ERROR: el puerto ${PUERTO_WEB} ya esta ocupado por otro programa.`);
    console.error('Cierra ese programa (o reinicia el equipo) y vuelve a intentarlo.');
    console.error('Si crees que es una ejecucion anterior, ejecuta: detener.cmd');
    process.exitCode = 1;
    return;
  }

  if (asegurarEnvWeb()) {
    console.log('Se creo web/.env.local para que la web hable con la API local.');
  }

  console.log('  - Iniciando la API...');
  const api = lanzar('API', DIR_SERVIDOR, entornoApi(valores), ARCHIVO_PID_API, LOG_API);
  console.log(`    pid ${api}`);

  console.log('  - Iniciando la web (la primera vez compila y tarda mas)...');
  const web = lanzar('WEB', DIR_WEB, entornoWeb(), ARCHIVO_PID_WEB, LOG_WEB);
  console.log(`    pid ${web}`);

  console.log('  - Esperando a que la API conecte con la base de datos...');
  if (!(await esperarSalud(150000))) {
    console.error('');
    console.error('ERROR: la API no respondio con la base de datos conectada.');
    console.error(`Revisa ${LOG_API}. Ultimas lineas:`);
    console.error(colaDeLog(LOG_API));
    console.error('');
    console.error('Se cierran los servicios que se alcanzaron a iniciar.');
    matarArbol(api);
    matarArbol(web);
    borrarArchivo(ARCHIVO_PID_API);
    borrarArchivo(ARCHIVO_PID_WEB);
    process.exitCode = 1;
    return;
  }
  console.log('    API lista.');

  console.log('  - Esperando a que la web responda...');
  if (!(await esperarWeb(240000))) {
    console.error('');
    console.error('ERROR: la web no respondio a tiempo.');
    console.error(`Revisa ${LOG_WEB}. Ultimas lineas:`);
    console.error(colaDeLog(LOG_WEB));
    console.error('');
    console.error('La API se deja en marcha; vuelve a intentarlo con: detener.cmd y iniciar.cmd');
    process.exitCode = 1;
    return;
  }
  console.log('    Web lista.');

  console.log('');
  console.log('  Abriendo el navegador...');
  abrirNavegador();
  console.log('');
  console.log(`  Sistema en marcha: ${URL_WEB}`);
}

/** `app.mjs stop` */
async function comandoStop() {
  let cerradoAlguno = false;

  for (const [etiqueta, archivo] of [
    ['API', ARCHIVO_PID_API],
    ['web', ARCHIVO_PID_WEB]
  ]) {
    const pid = leerPid(archivo);
    if (!pid) {
      console.log(`  - La ${etiqueta} no estaba en marcha.`);
      continue;
    }
    if (!procesoVivo(pid)) {
      borrarArchivo(archivo);
      console.log(`  - La ${etiqueta} ya estaba detenida.`);
      continue;
    }
    if (!esNuestro(pid)) {
      borrarArchivo(archivo);
      console.log(`  - La ${etiqueta} tenia un PID viejo que ya no le pertenece: se ignora.`);
      continue;
    }

    console.log(`  - Cerrando la ${etiqueta} (pid ${pid})...`);
    matarArbol(pid);
    if (!(await esperarMuerte(pid, 15000))) {
      console.log(`    Aviso: la ${etiqueta} no confirmo el cierre; se reintenta.`);
      matarArbol(pid);
      await esperarMuerte(pid, 5000);
    }
    borrarArchivo(archivo);
    cerradoAlguno = true;
  }

  if (!cerradoAlguno) {
    console.log('  No habia nada que cerrar.');
  }
}

/** `app.mjs status` */
async function comandoStatus() {
  console.log('Estado de la API y la web');
  console.log(`  API:    puerto ${PUERTO_API}`);
  console.log(`  Web:    puerto ${PUERTO_WEB}`);

  for (const [etiqueta, archivo, puerto] of [
    ['API', ARCHIVO_PID_API, PUERTO_API],
    ['Web', ARCHIVO_PID_WEB, PUERTO_WEB]
  ]) {
    const pid = leerPid(archivo);
    const vivo = pid && esNuestro(pid);
    const responde = await puertoOcupado(puerto);
    const estado = vivo ? `en marcha (pid ${pid})` : 'detenida';
    console.log(`  ${etiqueta}:    ${estado} · puerto ${responde ? 'responde' : 'libre'}`);
  }

  try {
    const respuesta = await fetch(URL_SALUD, { signal: AbortSignal.timeout(3000) });
    const datos = await respuesta.json();
    console.log(`  Salud:  ok=${datos.ok} baseDeDatos=${datos.baseDeDatos}`);
  } catch {
    console.log('  Salud:  no responde');
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
    default:
      console.log('Uso: node app.mjs start | stop | status');
      process.exitCode = 1;
  }
}

await main();
