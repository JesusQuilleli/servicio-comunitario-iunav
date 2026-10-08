import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import { validarFila, type ErrorImportacion, type FilaImportacion } from '../lib/importar.js';
import { generarPasswordTemporal, passwordSchema } from '../lib/password.js';
import type { UserRole, UsuarioPublico } from '../types.js';

export interface UsuarioRow {
  id_usuario: string;
  nombre_completo: string;
  cedula: string;
  email: string;
  password_hash: string;
  password_temporal: boolean;
  password_cambiado_en: Date | null;
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
    passwordTemporal: row.password_temporal,
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

export async function findUsuarioPorCedula(cedula: string): Promise<UsuarioRow | null> {
  const { rows } = await pool.query<UsuarioRow>(
    'select * from usuarios where cedula = $1',
    [cedula]
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

/**
 * Guarda una contrasena nueva.
 *
 * `temporal` se apaga al cambiarla uno mismo y se enciende cuando el admin la
 * restablece: es la bandera que obliga a cambiar la clave al proximo inicio de
 * sesion.
 */
export async function actualizarPassword(
  idUsuario: string,
  passwordHash: string,
  temporal: boolean
): Promise<UsuarioRow> {
  const { rows } = await pool.query<UsuarioRow>(
    `update usuarios
     set password_hash = $2,
         password_temporal = $3,
         password_cambiado_en = now()
     where id_usuario = $1
     returning *`,
    [idUsuario, passwordHash, temporal]
  );
  return rows[0];
}

/**
 * Actualiza los datos de la cuenta (nombre y/o correo). Los campos que llegan
 * en `null` se conservan tal cual.
 */
export async function actualizarPerfil(
  idUsuario: string,
  datos: { nombreCompleto?: string | null; email?: string | null }
): Promise<UsuarioRow> {
  const { rows } = await pool.query<UsuarioRow>(
    `update usuarios
     set nombre_completo = coalesce($2, nombre_completo),
         email = coalesce($3, email)
     where id_usuario = $1
     returning *`,
    [idUsuario, datos.nombreCompleto ?? null, datos.email ?? null]
  );
  return rows[0];
}

export interface ResultadoImportacion {
  creados: number;
  asignados: number;
  errores: ErrorImportacion[];
  claves: { fila: number; email: string; claveInicial: string }[];
}

function normalizarNombre(valor: string): string {
  return valor.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export async function importarEstudiantesEnLote(
  filas: FilaImportacion[]
): Promise<ResultadoImportacion> {
  const errores: ErrorImportacion[] = [];
  const validas: FilaImportacion[] = [];
  const correoEnFila = new Map<string, number>();
  const cedulaEnFila = new Map<string, number>();

  for (const fila of filas) {
    const propios = validarFila(fila);
    errores.push(...propios);
    if (propios.length > 0) continue;

    const correoPrevia = correoEnFila.get(fila.email);
    if (correoPrevia !== undefined) {
      errores.push({
        fila: fila.fila,
        campo: 'email',
        mensaje: `El correo ya aparece en la fila ${correoPrevia} de la plantilla`,
      });
      continue;
    }
    const cedulaPrevia = cedulaEnFila.get(fila.cedula);
    if (cedulaPrevia !== undefined) {
      errores.push({
        fila: fila.fila,
        campo: 'cedula',
        mensaje: `La cédula ya aparece en la fila ${cedulaPrevia} de la plantilla`,
      });
      continue;
    }

    correoEnFila.set(fila.email, fila.fila);
    cedulaEnFila.set(fila.cedula, fila.fila);
    validas.push(fila);
  }

  if (validas.length > 0) {
    const { rows: existentes } = await pool.query<{ email: string; cedula: string }>(
      `select email, cedula from usuarios
       where email = any($1::text[]) or cedula = any($2::text[])`,
      [validas.map((f) => f.email), validas.map((f) => f.cedula)]
    );
    const correos = new Set(existentes.map((r) => r.email));
    const cedulas = new Set(existentes.map((r) => r.cedula));

    for (const fila of [...validas]) {
      if (correos.has(fila.email)) {
        errores.push({
          fila: fila.fila,
          campo: 'email',
          mensaje: 'Ya existe un usuario con ese correo electrónico',
        });
        quitar(validas, fila);
      } else if (cedulas.has(fila.cedula)) {
        errores.push({
          fila: fila.fila,
          campo: 'cedula',
          mensaje: 'Ya existe un usuario con esa cédula',
        });
        quitar(validas, fila);
      }
    }
  }

  const grupoPorFila = new Map<number, string>();
  if (validas.some((f) => f.grupo)) {
    const { rows: grupos } = await pool.query<{ id_grupo: string; nombre_proyecto: string }>(
      'select id_grupo, nombre_proyecto from grupos_proyectos'
    );
    const porNombre = new Map<string, string[]>();
    for (const g of grupos) {
      const clave = normalizarNombre(g.nombre_proyecto);
      porNombre.set(clave, [...(porNombre.get(clave) ?? []), g.id_grupo]);
    }

    for (const fila of [...validas]) {
      if (!fila.grupo) continue;
      const candidatos = porNombre.get(normalizarNombre(fila.grupo)) ?? [];
      if (candidatos.length === 0) {
        errores.push({
          fila: fila.fila,
          campo: 'grupo',
          mensaje: `No existe un grupo llamado "${fila.grupo}"`,
        });
        quitar(validas, fila);
      } else if (candidatos.length > 1) {
        errores.push({
          fila: fila.fila,
          campo: 'grupo',
          mensaje: `Hay más de un grupo llamado "${fila.grupo}"; renómbralo antes de cargar`,
        });
        quitar(validas, fila);
      } else {
        grupoPorFila.set(fila.fila, candidatos[0]);
      }
    }
  }

  const clavesIniciales = validas.map((f) =>
    passwordSchema.safeParse(f.cedula).success ? f.cedula : generarPasswordTemporal()
  );
  const hashes = await Promise.all(clavesIniciales.map((c) => bcrypt.hash(c, 10)));

  const client = await pool.connect();
  let asignados = 0;
  try {
    await client.query('begin');

    const ids: string[] = [];
    for (let i = 0; i < validas.length; i++) {
      const f = validas[i];
      const { rows } = await client.query<{ id_usuario: string }>(
        `insert into usuarios (nombre_completo, cedula, email, password_hash, rol, password_temporal)
         values ($1, $2, $3, $4, 'estudiante', true)
         returning id_usuario`,
        [f.nombreCompleto, f.cedula, f.email, hashes[i]]
      );
      ids.push(rows[0].id_usuario);
    }

    for (let i = 0; i < validas.length; i++) {
      const idGrupo = grupoPorFila.get(validas[i].fila);
      if (!idGrupo) continue;
      const { rowCount } = await client.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         values ($1, $2, 'en_curso')
         on conflict do nothing`,
        [idGrupo, ids[i]]
      );
      asignados += rowCount ?? 0;
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    if ((err as { code?: string }).code === '23505') {
      throw new ApiError(409, 'Alguna cédula o correo de la plantilla ya existe en el sistema');
    }
    throw err;
  } finally {
    client.release();
  }

  return {
    creados: validas.length,
    asignados,
    errores,
    claves: validas.map((f, i) => ({
      fila: f.fila,
      email: f.email,
      claveInicial: clavesIniciales[i],
    })),
  };
}

function quitar(lista: FilaImportacion[], fila: FilaImportacion): void {
  const i = lista.indexOf(fila);
  if (i >= 0) lista.splice(i, 1);
}