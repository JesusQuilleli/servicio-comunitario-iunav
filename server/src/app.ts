import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import { ZodError } from 'zod';
import { env } from './config/env.js';
import { ApiError } from './lib/errors.js';
import { apiRouter } from './routes/index.js';

export function createApp(): express.Express {
  const app = express();

  app.use(cors({ origin: env.frontendUrl, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, servicio: 'IUNAV Servicio Comunitario API', hora: new Date().toISOString() });
  });

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