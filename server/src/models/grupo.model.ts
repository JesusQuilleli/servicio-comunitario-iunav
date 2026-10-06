import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import type { UserRole } from '../types.js';

export type EstadoGrupo = 'en_curso' | 'pendiente_aprobacion' | 'finalizado' | 'suspendido';
export type EstadoFinal = 'en_curso' | 'aprobado' | 'reprobado';

export interface FilaGrupo {
  idGrupo: string;
  nombreProyecto: string;
  estado: EstadoGrupo;
  periodoId: number | null;
  periodo: string | null;
  tutorId: string | null;
  tutorNombre: string | null;
  coordinadorId: string | null;
  coordinadorNombre: string | null;
  proyectoEscritoUrl: string | null;
  diapositivasUrl: string | null;
  integrantes: number;
  horasAprobadas: number;
  horasPendientes: number;
  creadoEn: string;
}

export interface FilaIntegrante {
  idUsuario: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  activo: boolean;
  estadoFinal: EstadoFinal | null;
  horasAprobadas: number;
  horasPendientes: number;
}

export type DetalleGrupo = FilaGrupo & { listaIntegrantes: FilaIntegrante[] };

interface GrupoRow {
  id_grupo: string;
  nombre_proyecto: string;
  estado: EstadoGrupo;
  id_periodo: number | null;
  periodo: string | null;
  id_tutor: string | null;
  tutor_nombre: string | null;
  id_coordinador: string | null;
  coordinador_nombre: string | null;
  proyecto_escrito_url: string | null;
  diapositivas_url: string | null;
  creado_en: string;
  integrantes: number;
  horas_aprobadas: string;
  horas_pendientes: string;
}

const SELECT_GRUPO = `
  select g.id_grupo,
         g.nombre_proyecto,
         g.estado,
         g.id_periodo,
         p.nombre_periodo as periodo,
         g.id_tutor,
         t.nombre_completo as tutor_nombre,
         g.id_coordinador,
         c.nombre_completo as coordinador_nombre,
         g.proyecto_escrito_url,
         g.diapositivas_url,
         g.creado_en::text as creado_en,
         (select count(*)::int from integrantes_grupo ig where ig.id_grupo = g.id_grupo) as integrantes,
         coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                    where b.id_grupo = g.id_grupo and b.estado = 'aprobado'), 0)::text as horas_aprobadas,
         coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                    where b.id_grupo = g.id_grupo and b.estado in ('pendiente', 'corregir')), 0)::text
           as horas_pendientes
  from grupos_proyectos g
  left join periodos_academicos p on p.id_periodo = g.id_periodo
  left join usuarios t on t.id_usuario = g.id_tutor
  left join usuarios c on c.id_usuario = g.id_coordinador
`;

function mapGrupo(row: GrupoRow): FilaGrupo {
  return {
    idGrupo: row.id_grupo,
    nombreProyecto: row.nombre_proyecto,
    estado: row.estado,
    periodoId: row.id_periodo,
    periodo: row.periodo,
    tutorId: row.id_tutor,
    tutorNombre: row.tutor_nombre,
    coordinadorId: row.id_coordinador,
    coordinadorNombre: row.coordinador_nombre,
    proyectoEscritoUrl: row.proyecto_escrito_url,
    diapositivasUrl: row.diapositivas_url,
    integrantes: row.integrantes,
    horasAprobadas: Number(row.horas_aprobadas),
    horasPendientes: Number(row.horas_pendientes),
    creadoEn: row.creado_en,
  };
}

export interface FiltrosGrupos {
  periodoId: number | null;
  estado: EstadoGrupo | null;
  tutorId: string | null;
  busqueda: string | null;
}

export async function listarGrupos(filtros: FiltrosGrupos): Promise<FilaGrupo[]> {
  const { rows } = await pool.query<GrupoRow>(
    `${SELECT_GRUPO}
     where ($1::int is null or g.id_periodo = $1)
       and ($2::text is null or g.estado = $2)
       and ($3::uuid is null or g.id_tutor = $3)
       and ($4::text is null or g.nombre_proyecto ilike '%' || $4 || '%')
     order by g.creado_en desc`,
    [filtros.periodoId, filtros.estado, filtros.tutorId, filtros.busqueda]
  );
  return rows.map(mapGrupo);
}

async function obtenerIntegrantes(idGrupo: string): Promise<FilaIntegrante[]> {
  const { rows } = await pool.query<{
    id_usuario: string;
    nombre_completo: string;
    cedula: string;
    email: string;
    activo: boolean;
    estado_final: EstadoFinal | null;
    horas_aprobadas: string;
    horas_pendientes: string;
  }>(
    `select u.id_usuario,
            u.nombre_completo,
            u.cedula,
            u.email,
            u.activo,
            ig.estado_final,
            coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                       where b.id_grupo = $1 and b.id_estudiante = u.id_usuario
                         and b.estado = 'aprobado'), 0)::text as horas_aprobadas,
            coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                       where b.id_grupo = $1 and b.id_estudiante = u.id_usuario
                         and b.estado in ('pendiente', 'corregir')), 0)::text as horas_pendientes
     from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_grupo = $1
     order by u.nombre_completo asc`,
    [idGrupo]
  );
  return rows.map((r) => ({
    idUsuario: r.id_usuario,
    nombreCompleto: r.nombre_completo,
    cedula: r.cedula,
    email: r.email,
    activo: r.activo,
    estadoFinal: r.estado_final,
    horasAprobadas: Number(r.horas_aprobadas),
    horasPendientes: Number(r.horas_pendientes),
  }));
}

export async function obtenerGrupo(idGrupo: string): Promise<DetalleGrupo | null> {
  const { rows } = await pool.query<GrupoRow>(`${SELECT_GRUPO} where g.id_grupo = $1`, [idGrupo]);
  if (!rows[0]) return null;
  return { ...mapGrupo(rows[0]), listaIntegrantes: await obtenerIntegrantes(idGrupo) };
}

/**
 * Devuelve el grupo solo si el usuario tiene acceso: gestión ve todo,
 * el tutor únicamente sus grupos y el estudiante solo donde es integrante.
 */
export async function obtenerGrupoConAcceso(
  idGrupo: string,
  usuario: { idUsuario: string; rol: UserRole }
): Promise<DetalleGrupo> {
  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }

  if (usuario.rol === 'tutor' && grupo.tutorId !== usuario.idUsuario) {
    throw new ApiError(403, 'Solo puedes consultar los proyectos que tú tutorizas');
  }

  if (usuario.rol === 'estudiante') {
    const esIntegrante = grupo.listaIntegrantes.some((i) => i.idUsuario === usuario.idUsuario);
    if (!esIntegrante) {
      throw new ApiError(403, 'No perteneces a este grupo/proyecto');
    }
  }

  return grupo;
}

/**
 * Quién puede subir los documentos del proyecto (escrito y diapositivas).
 *
 * La gestión (admin y coordinador) puede sobre cualquier grupo; el tutor, solo
 * sobre los suyos. El estudiante no llega aqui: el proyecto es del grupo, y lo
 * que el estudiante aporta son sus evidencias de bitácora.
 */
export async function exigirGestionDeGrupo(
  idGrupo: string,
  usuario: { idUsuario: string; rol: UserRole }
): Promise<DetalleGrupo> {
  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  if (usuario.rol === 'tutor' && grupo.tutorId !== usuario.idUsuario) {
    throw new ApiError(403, 'Solo puedes subir documentos de los proyectos que tú tutorizas');
  }
  return grupo;
}

export interface DatosGrupo {
  nombreProyecto: string;
  periodoId: number | null;
  tutorId: string | null;
  coordinadorId: string | null;
  estado: EstadoGrupo;
  integrantesIds: string[];
}

async function validarUsuarioConRol(
  client: PoolClient,
  id: string | null,
  rol: UserRole,
  campo: string
): Promise<void> {
  if (id === null) return;
  const { rows } = await client.query<{ cuenta: string }>(
    'select count(*)::text as cuenta from usuarios where id_usuario = $1 and rol = $2 and activo',
    [id, rol]
  );
  if (Number(rows[0]?.cuenta ?? 0) === 0) {
    throw new ApiError(400, `El ${campo} seleccionado no existe o no tiene el rol requerido`);
  }
}

async function validarPeriodo(client: PoolClient, periodoId: number | null): Promise<void> {
  if (periodoId === null) return;
  const { rows } = await client.query<{ cuenta: string }>(
    'select count(*)::text as cuenta from periodos_academicos where id_periodo = $1',
    [periodoId]
  );
  if (Number(rows[0]?.cuenta ?? 0) === 0) {
    throw new ApiError(400, 'El período académico seleccionado no existe');
  }
}

async function validarIntegrantes(
  client: PoolClient,
  ids: string[],
  idGrupoExcluir: string | null,
  permitirMiembrosActuales = false
): Promise<void> {
  if (ids.length === 0) return;

  const { rows: noValidos } = await client.query<{ nombre_completo: string; rol: string; activo: boolean }>(
    `select nombre_completo, rol, activo from usuarios
     where id_usuario = any($1::uuid[]) and (rol <> 'estudiante' or not activo)`,
    [ids]
  );
  if (noValidos.length > 0) {
    const detalle = noValidos
      .map((u) => `${u.nombre_completo} (${u.activo ? u.rol : 'inactivo'})`)
      .join(', ');
    throw new ApiError(400, `Solo se pueden asignar estudiantes activos. Revisa: ${detalle}`);
  }

  if (!permitirMiembrosActuales) {
    const { rows: yaEnGrupo } = await client.query<{ nombre_completo: string }>(
      `select u.nombre_completo from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_estudiante = any($1::uuid[]) and ig.id_grupo = $2`,
      [ids, idGrupoExcluir]
    );
    if (yaEnGrupo.length > 0) {
      throw new ApiError(
        409,
        `Ya pertenecen a este proyecto: ${yaEnGrupo.map((u) => u.nombre_completo).join(', ')}`
      );
    }
  }
}

export async function crearGrupo(datos: DatosGrupo): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    await validarPeriodo(client, datos.periodoId);
    await validarUsuarioConRol(client, datos.tutorId, 'tutor', 'tutor');
    await validarUsuarioConRol(client, datos.coordinadorId, 'coordinador', 'coordinador');
    await validarIntegrantes(client, datos.integrantesIds, null);

    // Los documentos no se tocan aqui: las columnas `*_url` solo las escribe el
    // endpoint de subida. Si esta consulta las incluyera, un simple cambio de
    // nombre dejaria el grupo sin documentos y con archivos huerfanos en disco.
    const { rows } = await client.query<{ id_grupo: string }>(
      `insert into grupos_proyectos
         (nombre_proyecto, id_periodo, id_tutor, id_coordinador, estado)
       values ($1, $2, $3, $4, $5)
       returning id_grupo`,
      [datos.nombreProyecto, datos.periodoId, datos.tutorId, datos.coordinadorId, datos.estado]
    );
    const idGrupo = rows[0].id_grupo;

    if (datos.integrantesIds.length > 0) {
      await client.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         select $1, unnest($2::uuid[]), 'en_curso'`,
        [idGrupo, datos.integrantesIds]
      );
    }

    await client.query('commit');
    return idGrupo;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarGrupo(idGrupo: string, datos: DatosGrupo): Promise<DetalleGrupo> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: existe } = await client.query<{ cuenta: string }>(
      'select count(*)::text as cuenta from grupos_proyectos where id_grupo = $1',
      [idGrupo]
    );
    if (Number(existe[0]?.cuenta ?? 0) === 0) {
      throw new ApiError(404, 'Grupo/proyecto no encontrado');
    }

    await validarPeriodo(client, datos.periodoId);
    await validarUsuarioConRol(client, datos.tutorId, 'tutor', 'tutor');
    await validarUsuarioConRol(client, datos.coordinadorId, 'coordinador', 'coordinador');
    await validarIntegrantes(client, datos.integrantesIds, idGrupo, true);

    await client.query(
      `update grupos_proyectos
       set nombre_proyecto = $2,
           id_periodo = $3,
           id_tutor = $4,
           id_coordinador = $5,
           estado = $6
       where id_grupo = $1`,
      [idGrupo, datos.nombreProyecto, datos.periodoId, datos.tutorId, datos.coordinadorId, datos.estado]
    );

    const idsActuales = new Set(datos.integrantesIds);
    const { rows: actuales } = await client.query<{ id_estudiante: string }>(
      'select id_estudiante from integrantes_grupo where id_grupo = $1',
      [idGrupo]
    );

    const paraQuitar = actuales
      .map((r) => r.id_estudiante)
      .filter((id) => !idsActuales.has(id));
    if (paraQuitar.length > 0) {
      await quitarIntegrantesConCliente(client, idGrupo, paraQuitar);
    }

    const yaPresentes = new Set(actuales.map((r) => r.id_estudiante));
    const paraAgregar = datos.integrantesIds.filter((id) => !yaPresentes.has(id));
    if (paraAgregar.length > 0) {
      await client.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         select $1, unnest($2::uuid[]), 'en_curso'
         on conflict do nothing`,
        [idGrupo, paraAgregar]
      );
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  return grupo;
}

export async function cambiarEstadoGrupo(idGrupo: string, estado: EstadoGrupo): Promise<DetalleGrupo> {
  const { rows } = await pool.query<{ id_grupo: string }>(
    'update grupos_proyectos set estado = $2 where id_grupo = $1 returning id_grupo',
    [idGrupo, estado]
  );
  if (!rows[0]) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  return grupo;
}

async function quitarIntegrantesConCliente(
  client: PoolClient,
  idGrupo: string,
  idsEstudiante: string[]
): Promise<void> {
  const { rows: conRegistros } = await client.query<{ nombre_completo: string }>(
    `select distinct u.nombre_completo
     from bitacoras_comunitario b
     join usuarios u on u.id_usuario = b.id_estudiante
     where b.id_grupo = $1 and b.id_estudiante = any($2::uuid[])`,
    [idGrupo, idsEstudiante]
  );
  if (conRegistros.length > 0) {
    throw new ApiError(
      409,
      `No se pueden quitar del grupo a estudiantes con horas ya registradas: ${conRegistros
        .map((r) => r.nombre_completo)
        .join(', ')}`
    );
  }

  await client.query('delete from integrantes_grupo where id_grupo = $1 and id_estudiante = any($2::uuid[])', [
    idGrupo,
    idsEstudiante,
  ]);
}

export async function agregarIntegrantes(
  idGrupo: string,
  idsEstudiante: string[]
): Promise<{ agregados: number }> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: grupoRows } = await client.query<{ id_periodo: number | null }>(
      'select id_periodo from grupos_proyectos where id_grupo = $1',
      [idGrupo]
    );
    if (!grupoRows[0]) {
      throw new ApiError(404, 'Grupo/proyecto no encontrado');
    }

    await validarIntegrantes(client, idsEstudiante, idGrupo);

    const { rows } = await client.query<{ id_estudiante: string }>(
      `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
       select $1, unnest($2::uuid[]), 'en_curso'
       on conflict do nothing
       returning id_estudiante`,
      [idGrupo, idsEstudiante]
    );

    await client.query('commit');
    return { agregados: rows.length };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function quitarIntegrante(idGrupo: string, idEstudiante: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await quitarIntegrantesConCliente(client, idGrupo, [idEstudiante]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function cambiarEstadoFinalIntegrante(
  idGrupo: string,
  idEstudiante: string,
  estadoFinal: EstadoFinal
): Promise<void> {
  const { rows } = await pool.query<{ id_estudiante: string }>(
    `update integrantes_grupo
     set estado_final = $3
     where id_grupo = $1 and id_estudiante = $2
     returning id_estudiante`,
    [idGrupo, idEstudiante, estadoFinal]
  );
  if (!rows[0]) {
    throw new ApiError(404, 'El estudiante no pertenece a este grupo/proyecto');
  }
}
