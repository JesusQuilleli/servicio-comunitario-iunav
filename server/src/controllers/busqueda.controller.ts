import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { buscar } from '../models/busqueda.model.js';
import type { AuthRequest } from '../middleware/auth.js';

const busquedaSchema = z.object({
  q: z.string().trim().min(1, 'Escribe algo para buscar'),
  limite: z.coerce.number().int().min(1).max(10).default(5),
});

/**
 * GET /api/busqueda?q=&limite=
 *
 * Devuelve tres grupos (usuarios, proyectos, bitacoras) acotados al rol. Con
 * menos de dos caracteres no se busca nada: no tiene sentido golpear la base
 * por una letra.
 */
export async function buscarGlobal(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.usuario) {
      throw new ApiError(401, 'No autenticado');
    }
    const { q, limite } = busquedaSchema.parse(req.query);

    if (q.length < 2) {
      res.json({ usuarios: [], proyectos: [], bitacoras: [] });
      return;
    }

    const resultados = await buscar(req.usuario.rol, req.usuario.idUsuario, q, limite);
    res.json(resultados);
  } catch (err) {
    next(err);
  }
}
