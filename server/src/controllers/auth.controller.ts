import type { NextFunction, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import { passwordSchema } from '../lib/password.js';
import {
  actualizarPerfil,
  actualizarPassword,
  crearUsuario,
  findUsuarioPorCedula,
  findUsuarioPorEmail,
  findUsuarioPorId,
  mapUsuarioPublico,
} from '../models/usuario.model.js';
import {
  crearSolicitud,
  findPendientePorCampo,
  mapSolicitudPublica,
  type CampoSolicitud,
} from '../models/solicitud.model.js';
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
  password: passwordSchema,
  rol: z.enum(['admin', 'coordinador', 'tutor', 'estudiante']),
});

const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, 'Escribe tu contraseña actual'),
    passwordNueva: passwordSchema,
  })
  .refine((v) => v.passwordActual !== v.passwordNueva, {
    message: 'La contraseña nueva debe ser distinta de la actual',
    path: ['passwordNueva'],
  });

const perfilSchema = z
  .object({
    nombreCompleto: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').optional(),
    email: z.string().trim().email('Correo electrónico inválido').optional(),
  })
  .refine((v) => v.nombreCompleto !== undefined || v.email !== undefined, {
    message: 'No hay cambios que guardar',
  });

function firmaToken(idUsuario: string, rol: UserRole, passwordTemporal: boolean): string {
  return jwt.sign({ rol, tmp: passwordTemporal }, env.jwtSecret, {
    subject: idUsuario,
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  });
}

function requiereUsuario(req: AuthRequest): string {
  if (!req.usuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return req.usuario.idUsuario;
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

    const token = firmaToken(usuario.id_usuario, usuario.rol, usuario.password_temporal);
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

    // Jerarquia: el coordinador da de alta tutores y estudiantes, nunca a
    // alguien por encima de el mismo (ni a otro coordinador).
    if (req.usuario?.rol === 'coordinador' && (body.rol === 'admin' || body.rol === 'coordinador')) {
      throw new ApiError(403, 'Solo el administrador puede crear administradores o coordinadores');
    }

    const existe = await findUsuarioPorEmail(body.email.toLowerCase());
    if (existe) {
      throw new ApiError(409, 'Ya existe un usuario con ese correo electrónico');
    }

    const mismaCedula = await findUsuarioPorCedula(body.cedula.trim());
    if (mismaCedula) {
      throw new ApiError(409, 'Ya existe un usuario con esa cédula');
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

/**
 * Cambio de contrasena por el propio usuario.
 *
 * Se exige la actual para que un token robado no sirva para quedarse con la
 * cuenta. Al cambiarla se devuelve un token nuevo porque el anterior llevaba la
 * marca de clave temporal y ya no permitiria operar.
 */
export async function cambiarPassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idUsuario = requiereUsuario(req);
    const body = cambiarPasswordSchema.parse(req.body);

    const usuario = await findUsuarioPorId(idUsuario);
    if (!usuario || !usuario.activo) {
      throw new ApiError(401, 'Usuario no encontrado o inactivo');
    }

    const actualValida = await bcrypt.compare(body.passwordActual, usuario.password_hash);
    if (!actualValida) {
      throw new ApiError(400, 'La contraseña actual no es correcta');
    }

    const passwordHash = await bcrypt.hash(body.passwordNueva, 10);
    const actualizado = await actualizarPassword(idUsuario, passwordHash, false);

    res.json({
      token: firmaToken(idUsuario, actualizado.rol, false),
      usuario: mapUsuarioPublico(actualizado),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Actualizacion de los datos de la cuenta desde "Mi perfil".
 *
 * Administradores, coordinadores y tutores aplican el cambio en el acto. El
 * estudiante no edita su cuenta: la propuesta queda como solicitud pendiente
 * que el coordinador (o el admin) aprueba o rechaza en Gestión de Usuarios.
 */
export async function actualizarPerfilPropio(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const idUsuario = requiereUsuario(req);
    const body = perfilSchema.parse(req.body);

    const usuario = await findUsuarioPorId(idUsuario);
    if (!usuario || !usuario.activo) {
      throw new ApiError(401, 'Usuario no encontrado o inactivo');
    }

    const cambios: { campo: CampoSolicitud; valorAnterior: string; valorNuevo: string }[] = [];

    if (body.nombreCompleto !== undefined && body.nombreCompleto !== usuario.nombre_completo) {
      cambios.push({
        campo: 'nombre_completo',
        valorAnterior: usuario.nombre_completo,
        valorNuevo: body.nombreCompleto,
      });
    }

    const emailNuevo = body.email?.toLowerCase();
    if (emailNuevo !== undefined && emailNuevo !== usuario.email) {
      const dueno = await findUsuarioPorEmail(emailNuevo);
      if (dueno && dueno.id_usuario !== idUsuario) {
        throw new ApiError(409, 'Ya existe un usuario con ese correo electrónico');
      }
      cambios.push({ campo: 'email', valorAnterior: usuario.email, valorNuevo: emailNuevo });
    }

    // Nada que tocar: respuesta idempotente con el usuario tal cual.
    if (cambios.length === 0) {
      res.json({ usuario: mapUsuarioPublico(usuario), solicitudes: [] });
      return;
    }

    if (usuario.rol !== 'estudiante') {
      const cambiosAplicados: { nombreCompleto?: string; email?: string } = {};
      for (const cambio of cambios) {
        if (cambio.campo === 'nombre_completo') cambiosAplicados.nombreCompleto = cambio.valorNuevo;
        if (cambio.campo === 'email') cambiosAplicados.email = cambio.valorNuevo;
      }
      const actualizado = await actualizarPerfil(idUsuario, cambiosAplicados);
      res.json({ usuario: mapUsuarioPublico(actualizado), solicitudes: [] });
      return;
    }

    // Estudiante: una solicitud por campo, sin duplicados pendientes.
    const creadas = [];
    for (const cambio of cambios) {
      const pendiente = await findPendientePorCampo(idUsuario, cambio.campo);
      if (pendiente) {
        throw new ApiError(
          409,
          `Ya tienes una solicitud de cambio de ${
            cambio.campo === 'email' ? 'correo electrónico' : 'nombre completo'
          } pendiente de aprobación`
        );
      }
      const solicitud = await crearSolicitud({
        idUsuario,
        campo: cambio.campo,
        valorAnterior: cambio.valorAnterior,
        valorNuevo: cambio.valorNuevo,
      });
      creadas.push(mapSolicitudPublica(solicitud));
    }

    res.status(201).json({ usuario: mapUsuarioPublico(usuario), solicitudes: creadas });
  } catch (err) {
    next(err);
  }
}

/** Mantiene viva la conexión con PostgreSQL al arrancar el servidor. */
export async function warmup(): Promise<void> {
  const { rows } = await pool.query<{ count: string }>('select count(*)::text as count from usuarios');
  console.log(`Conexión a PostgreSQL OK. Usuarios registrados: ${rows[0]?.count ?? '0'}`);
}