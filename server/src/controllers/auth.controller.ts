import type { NextFunction, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import {
  crearUsuario,
  findUsuarioPorEmail,
  findUsuarioPorId,
  mapUsuarioPublico,
} from '../models/usuario.model.js';
import type { AuthRequest } from '../middleware/auth.js';
import type { UserRole } from '../types.js';

const loginSchema = z.object({
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

const registerSchema = z.object({
  nombreCompleto: z.string().min(3, 'El nombre debe tener al menos 3 caracteres'),
  cedula: z.string().min(5, 'Cédula inválida'),
  email: z.string().email('Correo electrónico inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  rol: z.enum(['admin', 'coordinador', 'tutor', 'estudiante']),
});

function firmaToken(idUsuario: string, rol: UserRole): string {
  return jwt.sign({ rol }, env.jwtSecret, {
    subject: idUsuario,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

export async function login(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = loginSchema.parse(req.body);

    const usuario = await findUsuarioPorEmail(body.email.toLowerCase());
    if (!usuario) {
      throw new ApiError(401, 'Credenciales incorrectas');
    }

    const passwordValida = await bcrypt.compare(body.password, usuario.password_hash);
    if (!passwordValida) {
      throw new ApiError(401, 'Credenciales incorrectas');
    }

    if (!usuario.activo) {
      throw new ApiError(403, 'Tu cuenta está desactivada. Contacta al coordinador.');
    }

    const token = firmaToken(usuario.id_usuario, usuario.rol);
    res.json({ token, usuario: mapUsuarioPublico(usuario) });
  } catch (err) {
    next(err);
  }
}

export async function me(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.usuario) {
      throw new ApiError(401, 'No autenticado');
    }
    const usuario = await findUsuarioPorId(req.usuario.idUsuario);
    if (!usuario || !usuario.activo) {
      throw new ApiError(401, 'Usuario no encontrado o inactivo');
    }
    res.json({ usuario: mapUsuarioPublico(usuario) });
  } catch (err) {
    next(err);
  }
}

export async function register(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const body = registerSchema.parse(req.body);

    const existe = await findUsuarioPorEmail(body.email.toLowerCase());
    if (existe) {
      throw new ApiError(409, 'Ya existe un usuario con ese correo electrónico');
    }

    const passwordHash = await bcrypt.hash(body.password, 10);
    const creado = await crearUsuario({
      nombreCompleto: body.nombreCompleto.trim(),
      cedula: body.cedula.trim(),
      email: body.email.trim().toLowerCase(),
      passwordHash,
      rol: body.rol,
    });

    res.status(201).json({ usuario: mapUsuarioPublico(creado) });
  } catch (err) {
    next(err);
  }
}

/** Mantiene viva la conexión con PostgreSQL al arrancar el servidor. */
export async function warmup(): Promise<void> {
  const { rows } = await pool.query<{ count: string }>('select count(*)::text as count from usuarios');
  console.log(`Conexión a PostgreSQL OK. Usuarios registrados: ${rows[0]?.count ?? '0'}`);
}