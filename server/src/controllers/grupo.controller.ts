import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import * as model from '../models/grupo.model.js';
import type { EstadoGrupo } from '../models/grupo.model.js';
import type { UserRole } from '../types.js';

const estadosGrupo = ['en_curso', 'pendiente_aprobacion', 'finalizado', 'suspendido'] as const;
const estadosFinal = ['en_curso', 'aprobado', 'reprobado'] as const;

const urlOpcional = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v.trim()))
  .refine(
    (v) => v === null || v === '' || /^https?:\/\/\S+$/i.test(v),
    'Debe ser una URL válida (http:// o https://)'
  )
  .transform((v) => (v == null || v === '' ? null : v));

const idOpcional = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v == null || v === '' ? null : v))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, 'Identificador inválido');

const numeroOpcional = z
  .union([z.number(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v == null || v === '' ? null : v))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Debe ser un número entero positivo');

const grupoSchema = z.object({
  nombreProyecto: z
    .string()
    .trim()
    .min(3, 'El nombre del proyecto debe tener al menos 3 caracteres')
    .max(120, 'El nombre del proyecto es demasiado largo'),
  periodoId: numeroOpcional,
  tutorId: idOpcional,
  coordinadorId: idOpcional,
  proyectoEscritoUrl: urlOpcional,
  diapositivasUrl: urlOpcional,
  estado: z.enum(estadosGrupo),
  integrantesIds: z.array(z.string().uuid('Estudiante inválido')).max(80).default([]),
});

const estadoSchema = z.object({ estado: z.enum(estadosGrupo) });

const agregarSchema = z.object({
  estudiantesIds: z.array(z.string().uuid('Estudiante inválido')).min(1, 'Selecciona al menos un estudiante'),
});

const estadoFinalSchema = z.object({ estadoFinal: z.enum(estadosFinal) });

const filtrosSchema = z.object({
  periodo: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().positive().optional()),
  estado: z.preprocess((v) => (v === '' ? undefined : v), z.enum(estadosGrupo).optional()),
  tutor: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
  q: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional()),
});

function requiereUsuario(req: AuthRequest): { idUsuario: string; rol: UserRole } {
  if (!req.usuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return { idUsuario: req.usuario.idUsuario, rol: req.usuario.rol };
}

export async function listarGrupos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const filtros = filtrosSchema.parse(req.query);

    const grupos = await model.listarGrupos({
      periodoId: filtros.periodo ?? null,
      estado: filtros.estado ?? null,
      tutorId: filtros.tutor ?? (usuario.rol === 'tutor' ? usuario.idUsuario : null),
      busqueda: filtros.q ?? null,
    });

    res.json({ grupos });
  } catch (err) {
    next(err);
  }
}

export async function obtenerGrupo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const { id } = req.params as { id: string };
    const grupo = await model.obtenerGrupoConAcceso(id, usuario);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function crearGrupo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const body = grupoSchema.parse(req.body);
    const idGrupo = await model.crearGrupo(body);
    const grupo = await model.obtenerGrupo(idGrupo);
    res.status(201).json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function actualizarGrupo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const body = grupoSchema.parse(req.body);
    const grupo = await model.actualizarGrupo(id, body);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstado(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const { estado } = estadoSchema.parse(req.body);
    const grupo = await model.cambiarEstadoGrupo(id, estado as EstadoGrupo);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function agregarIntegrantes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const { estudiantesIds } = agregarSchema.parse(req.body);
    const resultado = await model.agregarIntegrantes(id, estudiantesIds);
    const grupo = await model.obtenerGrupo(id);
    res.json({ agregados: resultado.agregados, grupo });
  } catch (err) {
    next(err);
  }
}

export async function quitarIntegrante(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id, idEstudiante } = req.params as { id: string; idEstudiante: string };
    await model.quitarIntegrante(id, idEstudiante);
    const grupo = await model.obtenerGrupo(id);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstadoFinalIntegrante(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    requiereUsuario(req);
    const { id, idEstudiante } = req.params as { id: string; idEstudiante: string };
    const { estadoFinal } = estadoFinalSchema.parse(req.body);
    await model.cambiarEstadoFinalIntegrante(id, idEstudiante, estadoFinal);
    const grupo = await model.obtenerGrupo(id);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}
