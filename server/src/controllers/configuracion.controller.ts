import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import * as model from '../models/configuracion.model.js';
import type { TipoPlantilla } from '../models/configuracion.model.js';

const tiposPlantilla = ['bitacora', 'acta', 'informe', 'certificado'] as const;

const urlOpcional = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v.trim()))
  .refine(
    (v) => v === null || v === '' || /^https?:\/\/\S+$/i.test(v),
    'Debe ser una URL válida (http:// o https://)'
  )
  .transform((v) => (v == null || v === '' ? null : v));

const periodoIdOpcional = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.union([z.coerce.number().int().positive(), z.null()])
);

const textoOpcional = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((v) => {
    if (v == null) return null;
    const t = v.trim();
    return t === '' ? null : t;
  });

const configuracionSchema = z
  .object({
    horasDirectas: z.coerce
      .number({ message: 'Las horas de trabajo directo deben ser un número' })
      .int('Las horas de trabajo directo deben ser un número entero')
      .min(1, 'Debe ser al menos 1 hora')
      .max(1000, 'Revisa el valor: máximo 1000 horas'),
    horasImpacto: z.coerce
      .number({ message: 'Las horas de impacto deben ser un número' })
      .int('Las horas de impacto deben ser un número entero')
      .min(0, 'No puede ser negativo')
      .max(1000, 'Revisa el valor: máximo 1000 horas'),
    limiteHorasDiarias: z.coerce
      .number({ message: 'El límite diario debe ser un número' })
      .int('El límite diario debe ser un número entero')
      .min(1, 'Debe ser al menos 1 hora')
      .max(24, 'No puede superar 24 horas diarias'),
    periodoActivoId: periodoIdOpcional,
  })
  .refine((v) => v.horasDirectas + v.horasImpacto <= 1000, {
    message: 'La suma de metas no debe superar 1000 horas',
    path: ['horasImpacto'],
  });

const plantillaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(120, 'El nombre es demasiado largo'),
  descripcion: textoOpcional,
  tipo: z.enum(tiposPlantilla),
  urlDocumento: urlOpcional,
});

const activoSchema = z.object({ activo: z.boolean() });

const idPlantillaSchema = z.coerce.number().int().positive('Identificador inválido');

function requiereUsuario(req: AuthRequest): void {
  if (!req.usuario) {
    throw new ApiError(401, 'No autenticado');
  }
}

export async function obtenerConfiguracion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const configuracion = await model.obtenerConfiguracion();
    res.json({ configuracion });
  } catch (err) {
    next(err);
  }
}

export async function actualizarConfiguracion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const body = configuracionSchema.parse(req.body);
    const configuracion = await model.actualizarConfiguracion({
      horasDirectas: body.horasDirectas,
      horasImpacto: body.horasImpacto,
      limiteHorasDiarias: body.limiteHorasDiarias,
      periodoActivoId: body.periodoActivoId,
    });
    res.json({ configuracion });
  } catch (err) {
    next(err);
  }
}

export async function listarPlantillas(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const query = (req as { query?: Record<string, string> }).query ?? {};
    const soloActivas = query.todas !== 'true';
    const plantillas = await model.listarPlantillas(soloActivas);
    res.json({ plantillas });
  } catch (err) {
    next(err);
  }
}

export async function crearPlantilla(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const body = plantillaSchema.parse(req.body);
    const plantilla = await model.crearPlantilla({
      nombre: body.nombre,
      descripcion: body.descripcion,
      tipo: body.tipo as TipoPlantilla,
      urlDocumento: body.urlDocumento,
    });
    res.status(201).json({ plantilla });
  } catch (err) {
    next(err);
  }
}

export async function actualizarPlantilla(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const idPlantilla = idPlantillaSchema.parse(id);
    const body = plantillaSchema.parse(req.body);
    const plantilla = await model.actualizarPlantilla(idPlantilla, {
      nombre: body.nombre,
      descripcion: body.descripcion,
      tipo: body.tipo as TipoPlantilla,
      urlDocumento: body.urlDocumento,
    });
    res.json({ plantilla });
  } catch (err) {
    next(err);
  }
}

export async function cambiarActivoPlantilla(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const idPlantilla = idPlantillaSchema.parse(id);
    const { activo } = activoSchema.parse(req.body);
    const plantilla = await model.cambiarActivoPlantilla(idPlantilla, activo);
    res.json({ plantilla });
  } catch (err) {
    next(err);
  }
}
