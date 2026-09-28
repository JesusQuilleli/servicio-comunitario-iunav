import type { NextFunction, Response } from 'express';
import { pool } from '../db/pool.js';
import type { AuthRequest } from '../middleware/auth.js';
import { mapUsuarioPublico, type UsuarioRow } from '../models/usuario.model.js';
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