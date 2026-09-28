import { Pool } from 'pg';
import { env } from '../config/env.js';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

export async function testConnection(): Promise<boolean> {
  const { rows } = await pool.query<{ now: Date }>('select now()');
  return rows[0]?.now != null;
}