import type { NextFunction, Response } from 'express';
import type { AuthRequest } from './auth.js';
import type { UserRole } from '../types.js';

/** Asegura que el usuario autenticado tenga al menos uno de los roles permitidos. */
export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.usuario) {
      res.status(401).json({ message: 'No autenticado' });
      return;
    }
    if (!roles.includes(req.usuario.rol)) {
      res.status(403).json({ message: `Acceso denegado. Requiere rol: ${roles.join(', ')}` });
      return;
    }
    next();
  };
}