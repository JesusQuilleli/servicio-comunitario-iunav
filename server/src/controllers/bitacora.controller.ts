import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import * as model from '../models/bitacora.model.js';

const crearSchema = z
  .object({
    tipo: z.enum(['comunitario', 'social', 'ambiental']),
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)'),
    descripcion: z.string().min(3, 'La descripción debe tener al menos 3 caracteres'),
    horas: z.number().positive('Las horas deben ser mayores a 0').max(24, 'Máximo 24 horas por registro'),
    semana: z.number().int().min(1).max(52).optional(),
    idGrupo: z.string().uuid('Grupo inválido').optional(),
  })
  .superRefine((val, ctx) => {
    if (val.tipo === 'comunitario') {
      if (!val.semana) {
        ctx.addIssue({ code: 'custom', path: ['semana'], message: 'La bitácora comunitaria requiere la semana' });
      }
      if (!val.idGrupo) {
        ctx.addIssue({ code: 'custom', path: ['idGrupo'], message: 'La bitácora comunitaria requiere el grupo/proyecto' });
      }
    } else if (val.semana || val.idGrupo) {
      ctx.addIssue({
        code: 'custom',
        path: ['semana'],
        message: 'Los servicios sociales/ambientales no usan semana ni grupo',
      });
    }
  });

const veredictoSchema = z.object({
  tipo: z.enum(['comunitario', 'social', 'ambiental']),
  estado: z.enum(['aprobado', 'rechazado', 'corregir']),
  comentario: z.string().trim().max(500).optional(),
});

function requiereUsuario(req: AuthRequest): { idUsuario: string } {
  if (!req.usuario?.idUsuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return { idUsuario: req.usuario.idUsuario };
}

export async function getMisRegistros(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const registros = await model.listarMisRegistros(idUsuario);
    res.json({ registros });
  } catch (err) {
    next(err);
  }
}

export async function getMisGrupos(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const grupos = await model.obtenerGruposEstudiante(idUsuario);
    res.json({ grupos });
  } catch (err) {
    next(err);
  }
}

export async function crearRegistro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const body = crearSchema.parse(req.body);

    const hoy = new Date().toISOString().slice(0, 10);
    if (body.fecha > hoy) {
      throw new ApiError(400, 'La fecha de la actividad no puede ser futura');
    }

    const limite = await model.obtenerLimiteHorasDiarias();
    const { id } = await model.crearRegistroEstudiante(
      { ...body, idEstudiante: idUsuario },
      limite
    );

    res.status(201).json({
      registro: {
        id,
        tipo: body.tipo,
        fecha: body.fecha,
        descripcion: body.descripcion,
        horas: body.horas,
        estado: 'pendiente',
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function getPendientesTutor(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const pendientes = await model.obtenerPendientesTutor(idUsuario);
    res.json({ pendientes });
  } catch (err) {
    next(err);
  }
}

export async function validarRegistro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const { id } = req.params;
    const body = veredictoSchema.parse(req.body);

    if ((body.estado === 'rechazado' || body.estado === 'corregir') && !body.comentario) {
      throw new ApiError(400, 'Debes indicar un comentario al tutor al rechazar o pedir correcciones');
    }

    const resultado = await model.cambiarEstadoRegistro({
      id,
      tipo: body.tipo,
      idTutor: idUsuario,
      estado: body.estado,
      comentario: body.comentario ?? null,
    });

    res.json({ actualizado: resultado });
  } catch (err) {
    next(err);
  }
}