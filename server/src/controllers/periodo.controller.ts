import type { NextFunction, Response } from 'express';
import * as model from '../models/periodo.model.js';

export async function listarPeriodos(req: unknown, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = (req as { query?: Record<string, string> }).query ?? {};
    const soloActivos = query.todos !== 'true';
    const periodos = await model.listarPeriodos(soloActivos);
    res.json({ periodos });
  } catch (err) {
    next(err);
  }
}
