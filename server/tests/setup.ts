/**
 * Se ejecuta antes de importar cualquier modulo de `src/`.
 *
 * Es obligatorio fijar el entorno aqui: `src/config/env.ts` llama a
 * `dotenv.config()` al importarse, y `src/db/pool.ts` lee `env.databaseUrl`
 * en ese mismo momento. Cualquier importacion de `src/` desde este archivo
 * haria que el pool se apunte a la base de desarrollo.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(serverRoot, '.env') });

export const TEST_DB_NAME = 'app_iunav_test';

const base = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!base) {
  throw new Error(
    'No se encontro DATABASE_URL. Las pruebas leen server/.env; definela o exporta TEST_DATABASE_URL.'
  );
}

const url = new URL(base);
url.pathname = `/${TEST_DB_NAME}`;
url.search = '';

process.env.DATABASE_URL = url.toString();
process.env.DB_SSL = 'false';
process.env.NODE_ENV = 'test';
// Carpeta propia de pruebas: los archivos de los tests no deben mezclarse con
// los de desarrollo ni quedar dando vueltas en `server/uploads/`.
process.env.UPLOAD_DIR = 'uploads-test';
// Secreto fijo solo para pruebas: no depende del .env ni se filtra a produccion.
process.env.JWT_SECRET = process.env.TEST_JWT_SECRET ?? 'secreto-exclusivo-de-pruebas-0123456789abcdef';
process.env.JWT_EXPIRES_IN = '1h';
