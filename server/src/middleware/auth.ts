import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../types.js';

export interface TokenPayload extends JwtPayload {
  sub: string;
  rol: UserRole;
  /** El token se firmo con una clave temporal: solo vale para cambiarla. */
  tmp?: boolean;
}

export interface AuthRequest extends Request {
  usuario?: { idUsuario: string; rol: UserRole; passwordTemporal: boolean };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No se proporcionó un token de acceso' });
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.jwtSecret) as TokenPayload;
    req.usuario = {
      idUsuario: payload.sub,
      rol: payload.rol,
      passwordTemporal: payload.tmp === true,
    };
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

/**
 * Rutas que siguen abiertas para quien entra con clave temporal: sin ellas no
 * habria forma de cumplir el cambio obligatorio.
 */
const EXENTAS_CON_CLAVE_TEMPORAL = new Set(['PATCH /api/auth/password']);

export function requiereCambioDePassword(req: AuthRequest, res: Response, next: NextFunction): void {
  const clave = `${req.method} ${req.baseUrl}${req.path}`;
  if (!req.usuario?.passwordTemporal || EXENTAS_CON_CLAVE_TEMPORAL.has(clave)) {
    next();
    return;
  }
  res.status(403).json({
    message: 'Debes cambiar tu contraseña temporal antes de continuar',
    code: 'PASSWORD_TEMPORAL',
  });
}