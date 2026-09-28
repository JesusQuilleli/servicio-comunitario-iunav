import { pool } from '../db/pool.js';
import type { UserRole, UsuarioPublico } from '../types.js';

export interface UsuarioRow {
  id_usuario: string;
  nombre_completo: string;
  cedula: string;
  email: string;
  password_hash: string;
  rol: UserRole;
  firma_url: string | null;
  sello_url: string | null;
  activo: boolean;
  creado_en: Date;
}

export function mapUsuarioPublico(row: UsuarioRow): UsuarioPublico {
  return {
    idUsuario: row.id_usuario,
    nombreCompleto: row.nombre_completo,
    cedula: row.cedula,
    email: row.email,
    rol: row.rol,
    firmaUrl: row.firma_url,
    selloUrl: row.sello_url,
    activo: row.activo,
    creadoEn: row.creado_en,
  };
}

export async function findUsuarioPorEmail(email: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query<UsuarioRow>(
    'select * from usuarios where email = $1',
    [email]
  );
  return rows[0] ?? null;
}

export async function findUsuarioPorId(id: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query<UsuarioRow>(
    'select * from usuarios where id_usuario = $1',
    [id]
  );
  return rows[0] ?? null;
}

export interface CrearUsuarioData {
  nombreCompleto: string;
  cedula: string;
  email: string;
  passwordHash: string;
  rol: UserRole;
}

export async function crearUsuario(data: CrearUsuarioData): Promise<UsuarioRow> {
  const { rows } = await pool.query<UsuarioRow>(
    `insert into usuarios (nombre_completo, cedula, email, password_hash, rol)
     values ($1, $2, $3, $4, $5)
     returning *`,
    [data.nombreCompleto, data.cedula, data.email, data.passwordHash, data.rol]
  );
  return rows[0];
}