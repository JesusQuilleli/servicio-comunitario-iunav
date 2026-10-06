import supertest from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app.js';
import { PASSWORD_SEMILLA } from './db.js';

export type Rol = 'admin' | 'coordinador' | 'tutor' | 'estudiante';

export const CORREOS: Record<Rol, string> = {
  admin: 'admin@test.local',
  coordinador: 'coordinador@test.local',
  tutor: 'tutoralfa@test.local',
  estudiante: 'estudianteana@test.local',
};

let app: Express | null = null;

export function api(): supertest.Agent {
  app ??= createApp();
  return supertest(app);
}

/** Hace login real contra la API y devuelve el token JWT. */
export async function tokenDe(rol: Rol): Promise<string> {
  return tokenDeCorreo(CORREOS[rol]);
}

/** Login por correo, para los usuarios del seed que no son un rol de `CORREOS`. */
export async function tokenDeCorreo(email: string): Promise<string> {
  const res = await api()
    .post('/api/auth/login')
    .send({ email, password: PASSWORD_SEMILLA });

  if (res.status !== 200) {
    throw new Error(`Login de ${email} fallo con ${res.status}: ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

export function auth(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
