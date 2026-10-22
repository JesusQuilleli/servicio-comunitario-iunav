/**
 * Constantes y utilidades compartidas del kit local de Servicio Comunitario IUNAV.
 *
 * El kit levanta una copia de desarrollo del sistema dentro del PC del usuario:
 * un PostgreSQL embebido (puerto 55432), la API (4000) y la web (3000).
 * Nada de esto toca la VPS ni los scripts de `deploy/`.
 *
 * Decisiones que no se rehacen:
 * - El PostgreSQL va al 55432 y no al 5432 para no chocar con un PostgreSQL
 *   nativo que el usuario pueda tener instalado.
 * - La API escucha solo en 127.0.0.1 y la web en localhost: es una copia de
 *   trabajo, no un servicio publicado.
 * - Los secretos (contrasena de la base y secreto del JWT) viven en
 *   `local/.env.local`, que esta en el `.gitignore`. Se generan UNA sola vez:
 *   si se regeneraran, el cluster quedaria con la contrasena vieja y el
 *   usuario perderia la sesion en cada apagado.
 */
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

/** Carpeta `local/` (la raiz del kit). */
export const RAIZ_LOCAL = path.dirname(fileURLToPath(import.meta.url));

/** Carpeta raiz del repositorio: un nivel por encima de `local/`. */
export const RAIZ_PROYECTO = path.resolve(RAIZ_LOCAL, '..');

/** Carpeta del backend. */
export const DIR_SERVIDOR = path.join(RAIZ_PROYECTO, 'server');

/** Carpeta del frontend. */
export const DIR_WEB = path.join(RAIZ_PROYECTO, 'web');

/** Puerto del PostgreSQL embebido (no 5432: para no chocar con el nativo). */
export const PUERTO_PG = 55432;

/** Puerto de la API. */
export const PUERTO_API = 4000;

/** Puerto de la web. */
export const PUERTO_WEB = 3000;

/** Usuario superusuario del cluster embebido. */
export const USUARIO_PG = 'postgres';

/** Base de datos de trabajo. */
export const BASE_DATOS = 'app_iunav';

/** Base de datos de las pruebas automaticas (su nombre debe acabar en `_test`). */
export const BASE_DATOS_PRUEBAS = 'app_iunav_test';

/** Carpeta donde PostgreSQL guarda los datos del cluster. */
export const DIR_DATOS = path.join(RAIZ_LOCAL, '.pgdata');

/** Archivo con la contrasena de la base y el secreto del JWT (ignorado por git). */
export const ARCHIVO_ENV = path.join(RAIZ_LOCAL, '.env.local');

/** Carpeta de logs y PID (ignorada por git). */
export const DIR_LOGS = path.join(RAIZ_LOCAL, 'logs');

/** PID del proceso que sostiene el cluster de PostgreSQL. */
export const ARCHIVO_PID_PG = path.join(DIR_LOGS, 'postgres.pid');

/** PID de la ventana de la API. */
export const ARCHIVO_PID_API = path.join(DIR_LOGS, 'api.pid');

/** PID de la ventana de la web. */
export const ARCHIVO_PID_WEB = path.join(DIR_LOGS, 'web.pid');

/** Archivo de peticion de parada del cluster (lo escribe `pg.mjs stop`). */
export const ARCHIVO_STOP_PG = path.join(DIR_LOGS, 'postgres.stop');

/** Log del cluster de PostgreSQL. */
export const ARCHIVO_LOG_PG = path.join(DIR_LOGS, 'postgres.log');

/** Archivo de configuracion de la web (lo escribe el kit solo si no existe). */
export const ARCHIVO_ENV_WEB = path.join(DIR_WEB, '.env.local');

/**
 * URL de conexion a una base del cluster local.
 * La contrasena es hexadecimal, asi que no necesita escaparse en la URL.
 */
export function urlBaseDeDatos(nombre, password) {
  return `postgresql://${USUARIO_PG}:${password}@127.0.0.1:${PUERTO_PG}/${nombre}`;
}

/**
 * Lee `local/.env.local`. Devuelve `null` si el archivo no existe.
 * Tolera lineas de comentario y espacios alrededor del `=`.
 */
export function leerEnvLocal() {
  if (!fs.existsSync(ARCHIVO_ENV)) return null;
  const texto = fs.readFileSync(ARCHIVO_ENV, 'utf8');
  const valores = {};
  for (const linea of texto.split(/\r?\n/)) {
    const limpio = linea.trim();
    if (limpio === '' || limpio.startsWith('#')) continue;
    const corte = limpio.indexOf('=');
    if (corte < 1) continue;
    valores[limpio.slice(0, corte).trim()] = limpio.slice(corte + 1).trim();
  }
  return valores;
}

/**
 * Se asegura de que exista `local/.env.local` con la contrasena de la base y el
 * secreto del JWT, y devuelve sus valores.
 *
 * Si el archivo ya existe, no se toca: es el unico sitio donde queda la
 * contrasena con la que se inicializo el cluster. Si falta el archivo pero el
 * cluster ya existe, no se inventa una contrasena nueva (dejaria al usuario sin
 * poder conectar): se explica el problema y se ofrecen las dos salidas.
 */
export function asegurarEnvLocal() {
  const existente = leerEnvLocal();

  if (existente && existente.PG_PASSWORD) {
    return { valores: existente, nuevo: false };
  }

  if (existente && !existente.PG_PASSWORD) {
    throw new Error(
      'El archivo local/.env.local existe pero no tiene la linea PG_PASSWORD.\n' +
        'Corrigelo a mano o borralo y vuelve a ejecutar instalar.cmd.'
    );
  }

  if (fs.existsSync(path.join(DIR_DATOS, 'PG_VERSION'))) {
    throw new Error(
      'La base de datos local ya existe (carpeta local/.pgdata) pero falta el archivo\n' +
        'local/.env.local con su contrasena. Sin ese archivo el cluster queda inaccesible,\n' +
        'asi que no se sigue adelante.\n' +
        'Tienes dos salidas:\n' +
        '  1. Recoverir el archivo local/.env.local que tenias (es el que guarda la contrasena).\n' +
        '  2. Borrar la carpeta local/.pgdata (se pierde todo lo que habia ahi) y ejecutar\n' +
        '     instalar.cmd otra vez para empezar de cero.'
    );
  }

  const password = randomBytes(24).toString('hex');
  const jwt = randomBytes(32).toString('hex');
  const contenido = [
    '# Configuracion del kit local de Servicio Comunitario IUNAV.',
    '# NO se sube al repositorio: contiene la contrasena de la base local y el',
    '# secreto del JWT. Se genera una sola vez y no se debe borrar ni editar a mano:',
    '# si la contrasena cambia, el cluster deja de aceptar la anterior.',
    `PG_PASSWORD=${password}`,
    `JWT_SECRET=${jwt}`,
    ''
  ].join('\n');
  fs.writeFileSync(ARCHIVO_ENV, contenido, 'utf8');
  return { valores: { PG_PASSWORD: password, JWT_SECRET: jwt }, nuevo: true };
}

/** Dice si algo esta escuchando en ese puerto (en localhost). */
export function puertoOcupado(puerto, host = '127.0.0.1') {
  return new Promise((resolver) => {
    const socket = net.connect({ port: puerto, host });
    const terminar = (ocupado) => {
      socket.destroy();
      resolver(ocupado);
    };
    socket.setTimeout(800);
    socket.once('connect', () => terminar(true));
    socket.once('timeout', () => terminar(false));
    socket.once('error', () => terminar(false));
  });
}

/** Espera a que un puerto responda. Devuelve `true` si respondio a tiempo. */
export async function esperarPuerto(puerto, milisegundos, host = '127.0.0.1') {
  const limite = Date.now() + milisegundos;
  while (Date.now() < limite) {
    if (await puertoOcupado(puerto, host)) return true;
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

/** Dice si un proceso sigue vivo (por su PID). */
export function procesoVivo(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM = el proceso existe pero es de otro usuario: tambien esta vivo.
    return err?.code === 'EPERM';
  }
}

/** Lee un archivo de PID. Devuelve `null` si no existe o no es un numero. */
export function leerPid(archivo) {
  try {
    const pid = Number.parseInt(fs.readFileSync(archivo, 'utf8').trim(), 10);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

/** Borra un archivo sin fallar si no existe. */
export function borrarArchivo(archivo) {
  try {
    fs.unlinkSync(archivo);
  } catch {
    /* no hacia falta */
  }
}
