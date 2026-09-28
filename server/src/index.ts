import { createApp } from './app.js';
import { env } from './config/env.js';
import { testConnection } from './db/pool.js';

async function main(): Promise<void> {
  await testConnection().catch((err: unknown) => {
    console.error('No se pudo conectar a PostgreSQL. Revisa DATABASE_URL en server/.env');
    console.error(err);
    process.exit(1);
  });

  const app = createApp();
  app.listen(env.port, () => {
    console.log(`>> API IUNAV Servicio Comunitario escuchando en http://localhost:${env.port}`);
    console.log(`>> Health check: http://localhost:${env.port}/api/health`);
  });
}

void main();