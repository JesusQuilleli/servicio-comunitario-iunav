import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { saludDb } from './db/pool.js';
import { apiRouter } from './routes/index.js';

/**
 * Limite de intentos de login por IP.
 *
 * Se desactiva cuando `NODE_ENV=test`: las pruebas hacen login muchas veces
 * seguidas desde la misma IP y sin esto la matriz de permisos empezaria a fallar
 * con 429. El rate limit real se verifica a mano (ver HANDOFF.md, seccion 5.6).
 */
const limiteLogin = rateLimit({
  windowMs: env.rateLimitLoginVentanaMs,
  limit: env.rateLimitLogin,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.nodeEnv === 'test',
  message: {
    message: 'Demasiados intentos de inicio de sesion. Espera unos minutos antes de reintentar.',
  },
});

export function createApp(): express.Express {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

/**
 * Sonda de disponibilidad. Devuelve 200 solo si PostgreSQL responde; si la base
 * esta caida responde 503 con `ok: false`. Es lo que consulta Caddy para decidir
 * si envia trafico (ver `deploy/Caddyfile`) y lo que usaria un monitor externo.
 *
 * No exige token a proposito: un balanceador no tiene sesion de usuario. No
 * devuelve datos de negocio, solo si el proceso vive y si la base contesta.
 */
app.get('/api/health', async (_req: Request, res: Response) => {
  const baseDeDatos = await saludDb();
  res.status(baseDeDatos ? 200 : 503).json({
    ok: baseDeDatos,
    baseDeDatos,
    servicio: 'IUNAV Servicio Comunitario API',
    hora: new Date().toISOString(),
  });
});

  app.use('/api/auth/login', limiteLogin);
  app.use('/api', apiRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.path}` });
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      res.status(400).json({
        message: 'Datos inválidos',
        errores: err.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
      });
      return;
    }

    if (err instanceof ApiError) {
      res.status(err.status).json({ message: err.message });
      return;
    }

    console.error('Error no controlado:', err);
    res.status(500).json({ message: 'Error interno del servidor' });
  });

  return app;
}