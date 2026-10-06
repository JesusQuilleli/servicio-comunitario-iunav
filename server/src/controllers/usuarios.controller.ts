import type { NextFunction, Response } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import { borrarArchivo, guardarArchivo } from '../lib/archivos.js';
import { generarPasswordTemporal } from '../lib/password.js';
import { archivoDe } from '../middleware/subida.js';
import { escribirRuta, leerRuta } from '../models/archivo.model.js';
import {
  actualizarPassword,
  mapUsuarioPublico,
  type UsuarioRow,
} from '../models/usuario.model.js';
import type { UserRole } from '../types.js';

export async function listarUsuarios(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { rows } = await pool.query<UsuarioRow>(
      'select * from usuarios order by nombre_completo asc'
    );
    res.json({ usuarios: rows.map(mapUsuarioPublico) });
  } catch (err) {
    next(err);
  }
}

export async function toggleActivo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { activo } = req.body as { activo: boolean };

    if (!req.usuario?.idUsuario) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }
    if (id === req.usuario.idUsuario) {
      res.status(400).json({ message: 'No puedes desactivar tu propia cuenta' });
      return;
    }

    const { rows } = await pool.query<UsuarioRow>(
      'update usuarios set activo = $1 where id_usuario = $2 returning *',
      [activo, id]
    );
    if (!rows[0]) {
      res.status(404).json({ message: 'Usuario no encontrado' });
      return;
    }
    res.json({ usuario: mapUsuarioPublico(rows[0]) });
  } catch (err) {
    next(err);
  }
}

export const rolesPermitidos: UserRole[] = ['admin', 'coordinador', 'tutor', 'estudiante'];

/**
 * Firma y sello viven en `usuarios`, asi que comparten el mismo camino:
 * `?id=` es el usuario al que se le asigna, que no siempre es quien sube.
 *
 * - La firma la sube el propio usuario o el administrador.
 * - El sello es institucional: solo el administrador lo asigna.
 */
async function subirImagenDeUsuario(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
  opciones: { columna: 'firma_url' | 'sello_url'; categoria: 'firmas' | 'sellos'; soloAdmin: boolean }
): Promise<void> {
  let rutaNueva: string | null = null;
  try {
    const quien = req.usuario;
    if (!quien) {
      throw new ApiError(401, 'No autenticado');
    }

    const { id } = req.params as { id: string };
    if (opciones.soloAdmin && quien.rol !== 'admin') {
      throw new ApiError(403, 'Acceso denegado. El sello institucional lo asigna el administrador');
    }
    if (!opciones.soloAdmin && quien.rol !== 'admin' && id !== quien.idUsuario) {
      throw new ApiError(403, 'Acceso denegado. Solo puedes subir tu propia firma');
    }

    const { rows: existe } = await pool.query<{ id_usuario: string }>(
      'select id_usuario from usuarios where id_usuario = $1',
      [id]
    );
    if (!existe[0]) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    const archivo = archivoDe(req, 'archivo');
    if (!archivo) {
      throw new ApiError(400, 'Adjunta el archivo de la imagen');
    }

    // Primero se guarda, para no dejar la columna apuntando a un archivo que no
    // se pudo escribir. Si la columna falla, se borra lo guardado.
    rutaNueva = (await guardarArchivo(opciones.categoria, archivo)).ruta;

    // La ruta anterior se lee ANTES de sobrescribir la columna: leerla despues
    // devolveria la nueva y el archivo viejo se quedaria para siempre en disco.
    const anterior = await leerRuta('usuarios', id, opciones.columna);

    await escribirRuta('usuarios', id, opciones.columna, rutaNueva);
    if (anterior && anterior !== rutaNueva) {
      await borrarArchivo(anterior);
    }

    const { rows } = await pool.query<UsuarioRow>(
      'select * from usuarios where id_usuario = $1',
      [id]
    );
    res.status(201).json({ usuario: mapUsuarioPublico(rows[0]) });
  } catch (err) {
    if (rutaNueva) {
      await borrarArchivo(rutaNueva);
    }
    next(err);
  }
}

export function subirFirma(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  return subirImagenDeUsuario(req, res, next, {
    columna: 'firma_url',
    categoria: 'firmas',
    soloAdmin: false,
  });
}

export function subirSello(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  return subirImagenDeUsuario(req, res, next, {
    columna: 'sello_url',
    categoria: 'sellos',
    soloAdmin: true,
  });
}

/**
 * El admin restablece la contrasena de una cuenta.
 *
 * No hay correo saliente: se genera una clave temporal y se devuelve una sola
 * vez para que el admin la entregue en mano. El usuario queda obligado a
 * cambiarla al entrar (marca `tmp` del token).
 */
export async function restablecerPassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };

    const { rows } = await pool.query<UsuarioRow>('select * from usuarios where id_usuario = $1', [id]);
    const usuario = rows[0];
    if (!usuario) {
      throw new ApiError(404, 'Usuario no encontrado');
    }

    const temporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(temporal, 10);
    const actualizado = await actualizarPassword(id, passwordHash, true);

    res.status(201).json({
      // Solo se devuelve ahora: en la base solo queda el hash.
      passwordTemporal: temporal,
      usuario: mapUsuarioPublico(actualizado),
    });
  } catch (err) {
    next(err);
  }
}