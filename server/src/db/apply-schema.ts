import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { pool } from './pool.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.resolve(__dirname, '../../sql/schema.sql');

async function main(): Promise<void> {
  const sql = await readFile(schemaPath, 'utf8');
  console.log('Aplicando esquema desde sql/schema.sql ...');
  await pool.query(sql);
  console.log('Esquema aplicado correctamente.');
}

void main()
  .catch((err: unknown) => {
    console.error('Error al aplicar el esquema:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());