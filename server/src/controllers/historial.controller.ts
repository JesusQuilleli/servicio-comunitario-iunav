import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { leerPaginacion, respuestaPaginada } from '../lib/paginacion.js';
import { ENTIDADES, listarAcciones, listarHistorial } from '../models/historial.model.js';
import type { EntidadHistorial } from '../models/historial.model.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * `GET /api/historial`
 *
 * Bandeja de auditoria para administracion y coordinacion. Es de solo lectura:
 * no hay endpoint que escriba aqui desde fuera, las filas las pone
 * `lib/historial.ts` desde dentro de cada operacion.
 */

/** Un parametro vacio (`?entidad=`) se trata como ausente, igual que en grupos. */
const vacioEsAusente = (v: unknown) => (v === '' || v === null ? undefined : v);

const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD');

const filtrosSchema = z.object({
  entidad: z.preprocess(vacioEsAusente, z.enum(ENTIDADES).optional()),
  accion: z.preprocess(vacioEsAusente, z.string().trim().max(60).optional()),
  actorId: z.preprocess(vacioEsAusente, z.string().uuid('Identificador inválido').optional()),
  desde: z.preprocess(vacioEsAusente, fecha.optional()),
  hasta: z.preprocess(vacioEsAusente, fecha.optional()),
  q: z.preprocess(vacioEsAusente, z.string().trim().max(120).optional()),
});

export async function listar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filtros = filtrosSchema.parse(req.query);
    const paginacion = leerPaginacion(req.query);

    const { items, total } = await listarHistorial(
      {
        entidad: (filtros.entidad as EntidadHistorial | undefined) ?? null,
        accion: filtros.accion ?? null,
        idActor: filtros.actorId ?? null,
        desde: filtros.desde ?? null,
        hasta: filtros.hasta ?? null,
        texto: filtros.q ?? null,
      },
      paginacion
    );

    res.json({ eventos: items, ...respuestaPaginada(items, total, paginacion) });
  } catch (err) {
    next(err);
  }
}

/** `GET /api/historial/acciones` -> valores para el desplegable de la interfaz. */
export async function acciones(
  _req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json({ acciones: await listarAcciones(), entidades: ENTIDADES });
  } catch (err) {
    next(err);
  }
}
