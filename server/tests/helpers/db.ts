import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const schemaPath = path.join(serverRoot, 'sql', 'schema.sql');

function nombreDePruebas(): string {
  return new URL(process.env.DATABASE_URL as string).pathname.slice(1);
}

/** Crea la base de pruebas si no existe, conectandose antes a `postgres`. */
export async function asegurarBaseDePruebas(): Promise<void> {
  const url = new URL(process.env.DATABASE_URL as string);
  url.pathname = '/postgres';
  url.search = '';

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const nombre = nombreDePruebas();
    const { rows } = await admin.query<{ n: number }>(
      'select count(*)::int as n from pg_database where datname = $1',
      [nombre]
    );
    if (rows[0].n === 0) {
      await admin.query(`create database "${nombre}"`);
    }
  } finally {
    await admin.end();
  }
}

export async function aplicarEsquema(): Promise<void> {
  const { pool } = await import('../../src/db/pool.js');
  await pool.query(await readFile(schemaPath, 'utf8'));
}

const TABLAS = [
  'integrantes_grupo',
  'bitacoras_comunitario',
  'control_servicios_institucionales',
  'grupos_proyectos',
  'configuracion_sistema',
  'plantillas_documento',
  'periodos_academicos',
  'solicitudes_cambio',
  'usuarios',
];

export interface DatosSemilla {
  admin: string;
  coordinador: string;
  tutorA: string;
  tutorB: string;
  estudianteA: string;
  estudianteB: string;
  outsider: string;
  estudianteInactivo: string;
  integranteSinHoras: string;
  periodo: number;
  plantilla: number;
  grupo: string;
  bitacoraPendiente: string;
  solicitud: string;
}

export const PASSWORD_SEMILLA = 'pruebas123';

export async function sembrar(): Promise<DatosSemilla> {
  const bcrypt = (await import('bcryptjs')).default;
  const { pool } = await import('../../src/db/pool.js');
  // 4 rondas: suficiente para el seed y mucho mas rapido que 10.
  const hash = await bcrypt.hash(PASSWORD_SEMILLA, 4);

  await pool.query(`truncate table ${TABLAS.join(', ')} restart identity cascade`);

  async function crearUsuario(
    email: string,
    nombre: string,
    cedula: string,
    rol: string,
    activo = true
  ): Promise<string> {
    const { rows } = await pool.query<{ id_usuario: string }>(
      `insert into usuarios (nombre_completo, cedula, email, password_hash, rol, activo)
       values ($1, $2, $3, $4, $5, $6)
       returning id_usuario`,
      [nombre, cedula, email, hash, rol, activo]
    );
    return rows[0].id_usuario;
  }

  // Todos los correos en minusculas: el login normaliza la entrada con
  // toLowerCase(), asi que un correo con mayusculas seria inalcanzable.
  const admin = await crearUsuario('admin@test.local', 'Admin Prueba', 'V-00000001', 'admin');
  const coordinador = await crearUsuario('coordinador@test.local', 'Coordinador Prueba', 'V-00000002', 'coordinador');
  const tutorA = await crearUsuario('tutoralfa@test.local', 'Tutor Alfa', 'V-00000003', 'tutor');
  const tutorB = await crearUsuario('tutorbeta@test.local', 'Tutor Beta', 'V-00000004', 'tutor');
  const estudianteA = await crearUsuario('estudianteana@test.local', 'Estudiante Ana', 'V-00000005', 'estudiante');
  const estudianteB = await crearUsuario('estudiantebeto@test.local', 'Estudiante Beto', 'V-00000006', 'estudiante');
  const outsider = await crearUsuario('estudiantecarla@test.local', 'Estudiante Carla', 'V-00000007', 'estudiante');
  const estudianteInactivo = await crearUsuario('inactivo@test.local', 'Estudiante Inactivo', 'V-00000008', 'estudiante', false);
  // Integrante del grupo pero sin horas registradas: la app impide quitar del
  // grupo a quien ya tiene horas, asi que hace falta para probar el DELETE.
  const integranteSinHoras = await crearUsuario('sinhoras@test.local', 'Estudiante Sin Horas', 'V-00000009', 'estudiante');

  const { rows: p } = await pool.query<{ id_periodo: number }>(
    `insert into periodos_academicos (nombre_periodo, fecha_inicio, fecha_fin, activo)
     values ('2026-I', '2026-01-15', '2026-06-30', true)
     returning id_periodo`
  );
  const periodo = p[0].id_periodo;

  await pool.query(
    `insert into configuracion_sistema (horas_directas, horas_impacto, limite_horas_diarias, periodo_activo)
     values (90, 30, 8, $1)`,
    [periodo]
  );

  const { rows: pl } = await pool.query<{ id_plantilla: number }>(
    `insert into plantillas_documento (nombre, descripcion, tipo)
     values ('Plantilla de prueba', 'Descripcion de prueba', 'bitacora')
     returning id_plantilla`
  );
  const plantilla = pl[0].id_plantilla;

  const { rows: g } = await pool.query<{ id_grupo: string }>(
    `insert into grupos_proyectos (nombre_proyecto, id_periodo, id_tutor, id_coordinador)
     values ('Grupo de prueba', $1, $2, $3)
     returning id_grupo`,
    [periodo, tutorA, coordinador]
  );
  const grupo = g[0].id_grupo;

  await pool.query(
    `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
     values ($1, $2, 'en_curso'), ($1, $3, 'en_curso'), ($1, $4, 'en_curso')`,
    [grupo, estudianteA, estudianteB, integranteSinHoras]
  );

  const { rows: b } = await pool.query<{ id_bitacora: string }>(
    `insert into bitacoras_comunitario
       (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
     values ($1, $2, 1, '2026-02-10', 'Actividad pendiente de validar', 4, 'pendiente')
     returning id_bitacora`,
    [estudianteA, grupo]
  );

  // Solicitud de cambio pendiente del estudiante A: la resuelve la matriz de
  // permisos (PATCH /api/solicitudes/:id) y la listan GET /solicitudes(/mias).
  const { rows: s } = await pool.query<{ id_solicitud: string }>(
    `insert into solicitudes_cambio (id_usuario, campo, valor_anterior, valor_nuevo, estado)
     values ($1, 'email', 'estudianteana@test.local', 'ana.nuevo@test.local', 'pendiente')
     returning id_solicitud`,
    [estudianteA]
  );

  return {
    admin,
    coordinador,
    tutorA,
    tutorB,
    estudianteA,
    estudianteB,
    outsider,
    estudianteInactivo,
    integranteSinHoras,
    periodo,
    plantilla,
    grupo,
    bitacoraPendiente: b[0].id_bitacora,
    solicitud: s[0].id_solicitud,
  };
}

export async function cerrarPool(): Promise<void> {
  const { pool } = await import('../../src/db/pool.js');
  await pool.end();
}
