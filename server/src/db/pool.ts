import { Pool } from 'pg';
import { env } from '../config/env.js';

export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: false } : false,
  max: 10,
  /**
   * Sin este tope, un PostgreSQL que no responde deja la promesa esperando para
   * siempre: el health check se queda colgado en vez de reportar 503, y el
   * balanceador nunca saca el nodo de rotacion. 5s es prudente para una VPS
   * donde Postgres esta en la misma maquina.
   */
  connectionTimeoutMillis: 5000,
});

export async function testConnection(): Promise<boolean> {
  const { rows } = await pool.query<{ now: Date }>('select now()');
  return rows[0]?.now != null;
}

/**
 * `select 1` con tope de tiempo propio. Se usa en `/api/health` para que el
 * chequeo sea de verdad una sonda de disponibilidad y no un "el proceso
 * arranco": si la base no responde, el servicio tiene que estar en unhealthy.
 */
export async function saludDb(ms = 2000): Promise<boolean> {
  let temporizador: NodeJS.Timeout | undefined;
  try {
    const tope = new Promise<never>((_resolver, rechazar) => {
      temporizador = setTimeout(() => rechazar(new Error(`PostgreSQL no respondio en ${ms} ms`)), ms);
      // `unref` evita que este temporizador mantenga vivo el proceso si la
      // consulta responde antes de que se dispare.
      temporizador.unref();
    });
    const { rows } = await Promise.race([pool.query('select 1'), tope]);
    return rows.length > 0;
  } catch {
    return false;
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}