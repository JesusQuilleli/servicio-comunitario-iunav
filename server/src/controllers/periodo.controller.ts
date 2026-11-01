import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import { registrarAccion } from '../lib/historial.js';
import * as model from '../models/periodo.model.js';

const isoDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa el formato AAAA-MM-DD');

const periodoSchema = z
  .object({
    nombrePeriodo: z
      .string()
      .trim()
      .min(3, 'El nombre del período debe tener al menos 3 caracteres')
      .max(80, 'El nombre es demasiado largo'),
    fechaInicio: isoDate,
    fechaFin: isoDate,
  })
  .refine((v) => v.fechaFin >= v.fechaInicio, {
    message: 'La fecha de fin no puede ser anterior a la fecha de inicio',
    path: ['fechaFin'],
  });

const activoSchema = z.object({ activo: z.boolean() });

const idPeriodoSchema = z.coerce.number().int().positive('Identificador inválido');

function requiereUsuario(req: AuthRequest): void {
  if (!req.usuario) {
    throw new ApiError(401, 'No autenticado');
  }
}

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

export async function crearPeriodo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const body = periodoSchema.parse(req.body);
    const periodo = await model.crearPeriodo(body);
    await registrarAccion(req, {
      accion: 'periodo.crear',
      entidad: 'periodo',
      idEntidad: periodo.idPeriodo,
      descripcion: `Creó el período "${periodo.nombrePeriodo}" (${periodo.fechaInicio} a ${periodo.fechaFin})`,
    });
    res.status(201).json({ periodo });
  } catch (err) {
    next(err);
  }
}

export async function actualizarPeriodo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const idPeriodo = idPeriodoSchema.parse(id);
    const body = periodoSchema.parse(req.body);
    const periodo = await model.actualizarPeriodo(idPeriodo, body);
    await registrarAccion(req, {
      accion: 'periodo.actualizar',
      entidad: 'periodo',
      idEntidad: idPeriodo,
      descripcion: `Editó el período "${periodo.nombrePeriodo}" (${periodo.fechaInicio} a ${periodo.fechaFin})`,
    });
    res.json({ periodo });
  } catch (err) {
    next(err);
  }
}

export async function cambiarActivoPeriodo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const idPeriodo = idPeriodoSchema.parse(id);
    const { activo } = activoSchema.parse(req.body);
    const periodo = await model.cambiarActivoPeriodo(idPeriodo, activo);
    await registrarAccion(req, {
      accion: 'periodo.activo',
      entidad: 'periodo',
      idEntidad: idPeriodo,
      descripcion: `${activo ? 'Activó' : 'Desactivó'} el período "${periodo.nombrePeriodo}"`,
    });
    res.json({ periodo });
  } catch (err) {
    next(err);
  }
}
