/**
 * Recrea desde cero la base de pruebas declarada en TEST_DATABASE_URL.
 * Nunca toca la base de desarrollo: aborta si el nombre no acaba en `_test`.
 */
import 'dotenv/config';
import { Client } from 'pg';

const principal = process.env.DATABASE_URL;
if (!principal) {
  throw new Error('Falta DATABASE_URL en server/.env');
}

const basePruebas = process.env.TEST_DATABASE_URL ?? 'app_iunav_test';
if (!basePruebas.endsWith('_test')) {
  throw new Error(`Refusaje destruir "${basePruebas}": el nombre debe terminar en _test`);
}

const url = new URL(principal);
const desarrollo = url.pathname.slice(1);
if (desarrollo === basePruebas) {
  throw new Error('TEST_DATABASE_URL apunta a la base de desarrollo');
}

url.pathname = '/postgres';
url.search = '';

const admin = new Client({ connectionString: url.toString() });
await admin.connect();

const { rows } = await admin.query<{ n: number }>(
  'select count(*)::int as n from pg_database where datname = $1',
  [basePruebas]
);

if (rows[0].n > 0) {
  await admin.query(`drop database "${basePruebas}"`);
  console.log(`Base descartada: ${basePruebas}`);
}

await admin.query(`create database "${basePruebas}"`);
console.log(`Base creada: ${basePruebas}`);
await admin.end();
