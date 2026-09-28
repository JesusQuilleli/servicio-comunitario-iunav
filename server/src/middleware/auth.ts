import type { NextFunction, Request, Response } from 'express';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env.js';
import type { UserRole } from '../types.js';

export interface TokenPayload extends JwtPayload {
  sub: string;
  rol: UserRole;
}

export interface AuthRequest extends Request {
  usuario?: { idUsuario: string; rol: UserRole };
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
    req.usuario = { idUsuario: payload.sub, rol: payload.rol };
    next();
  } catch {
    res.status(401).json({ message: 'Token inválido o expirado' });
  }
}