import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';

export type TipoRegistro = 'comunitario' | 'social' | 'ambiental';

export interface FilaMisRegistro {
  id: string;
  tipo: TipoRegistro;
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidencia: boolean;
  estado: string;
  comentarioTutor: string | null;
  proyecto: string | null;
  creadoEn: string;
}

export async function listarMisRegistros(idEstudiante: string): Promise<FilaMisRegistro[]> {
  const { rows } = await pool.query<{
    id: string;
    tipo: TipoRegistro;
    semana: number | null;
    fecha: string;
    descripcion: string;
    horas: string;
    evidencia: boolean;
    estado: string;
    comentario_tutor: string | null;
    proyecto: string | null;
    creado_en: string;
  }>(
    `select b.id_bitacora as id, 'comunitario' as tipo, b.numero_semana as semana,
            b.fecha_actividad::text as fecha, b.descripcion, b.horas_invertidas::text as horas,
            (b.evidencia_foto_url is not null) as evidencia, b.estado,
            b.comentario_tutor, g.nombre_proyecto as proyecto, b.creado_en::text as creado_en
     from bitacoras_comunitario b
     left join grupos_proyectos g on g.id_grupo = b.id_grupo
     where b.id_estudiante = $1
     union all
     select c.id_registro as id, c.tipo, null as semana, c.fecha_actividad::text as fecha,
            c.descripcion, c.horas_invertidas::text as horas,
            (c.evidencia_foto_url is not null) as evidencia, c.estado,
            c.comentario_tutor, null as proyecto, c.creado_en::text as creado_en
     from control_servicios_institucionales c
     where c.id_estudiante = $1
     order by fecha desc, creado_en desc`,
    [idEstudiante]
  );
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    semana: r.semana,
    fecha: r.fecha,
    descripcion: r.descripcion,
    horas: Number(r.horas),
    evidencia: r.evidencia,
    estado: r.estado,
    comentarioTutor: r.comentario_tutor,
    proyecto: r.proyecto,
    creadoEn: r.creado_en,
  }));
}

export async function obtenerGruposEstudiante(
  idEstudiante: string
): Promise<{ idGrupo: string; nombreProyecto: string; estado: string }[]> {
  const { rows } = await pool.query<{ id_grupo: string; nombre_proyecto: string; estado: string }>(
    `select g.id_grupo, g.nombre_proyecto, g.estado
     from integrantes_grupo ig
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     where ig.id_estudiante = $1 and g.estado not in ('finalizado', 'suspendido')
     order by g.creado_en desc`,
    [idEstudiante]
  );
  return rows.map((r) => ({
    idGrupo: r.id_grupo,
    nombreProyecto: r.nombre_proyecto,
    estado: r.estado,
  }));
}

export async function obtenerLimiteHorasDiarias(): Promise<number> {
  const { rows } = await pool.query<{ limite: string }>(
    'select limite_horas_diarias::text as limite from configuracion_sistema limit 1'
  );
  return Number(rows[0]?.limite ?? 8);
}

export async function crearRegistroEstudiante(
  datos: {
    idEstudiante: string;
    tipo: Exclude<TipoRegistro, 'comunitario'> | 'comunitario';
    fecha: string;
    descripcion: string;
    horas: number;
    semana?: number;
    idGrupo?: string;
  },
  limiteHorasDiarias: number
): Promise<{ id: string }> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: suma } = await client.query<{ total: string }>(
      `select coalesce(
         (select coalesce(sum(horas_invertidas), 0) from bitacoras_comunitario
          where id_estudiante = $1 and fecha_actividad = $2) +
         (select coalesce(sum(horas_invertidas), 0) from control_servicios_institucionales
          where id_estudiante = $1 and fecha_actividad = $2), 0)::text as total`,
      [datos.idEstudiante, datos.fecha]
    );
    const yaRegistradas = Number(suma[0]?.total ?? 0);
    if (yaRegistradas + datos.horas > limiteHorasDiarias) {
      throw new ApiError(
        400,
        `Superas el límite diario de ${limiteHorasDiarias} horas (ese día ya llevas ${yaRegistradas}h registradas)`
      );
    }

    let id: string;
    if (datos.tipo === 'comunitario') {
      if (!datos.idGrupo || !datos.semana) {
        throw new ApiError(400, 'La bitácora comunitaria requiere semana y grupo/proyecto');
      }
      const { rows: miembro } = await client.query<{ cuenta: string }>(
        `select count(*)::text as cuenta from integrantes_grupo
         where id_grupo = $1 and id_estudiante = $2`,
        [datos.idGrupo, datos.idEstudiante]
      );
      if (Number(miembro[0]?.cuenta ?? 0) === 0) {
        throw new ApiError(403, 'No perteneces a ese grupo/proyecto');
      }
      const { rows: insertado } = await client.query<{ id_bitacora: string }>(
        `insert into bitacoras_comunitario
           (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
         values ($1, $2, $3, $4, $5, $6, 'pendiente')
         returning id_bitacora`,
        [
          datos.idEstudiante,
          datos.idGrupo,
          datos.semana,
          datos.fecha,
          datos.descripcion,
          datos.horas,
        ]
      );
      id = insertado[0].id_bitacora;
    } else {
      const { rows: insertado } = await client.query<{ id_registro: string }>(
        `insert into control_servicios_institucionales
           (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, estado)
         values ($1, $2, $3, $4, $5, 'pendiente')
         returning id_registro`,
        [datos.idEstudiante, datos.tipo, datos.fecha, datos.descripcion, datos.horas]
      );
      id = insertado[0].id_registro;
    }

    await client.query('commit');
    return { id };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export interface FilaPendienteTutor {
  id: string;
  idEstudiante: string;
  estudianteNombre: string;
  idGrupo: string | null;
  proyectoNombre: string | null;
  tipo: TipoRegistro;
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidenciaUrl: string | null;
  estado: string;
}

export async function obtenerPendientesTutor(idTutor: string): Promise<FilaPendienteTutor[]> {
  const { rows } = await pool.query<{
    id: string;
    id_estudiante: string;
    estudiante_nombre: string;
    id_grupo: string | null;
    proyecto_nombre: string | null;
    tipo: TipoRegistro;
    semana: number | null;
    fecha: string;
    descripcion: string;
    horas: string;
    evidencia_url: string | null;
    estado: string;
  }>(
    `select b.id_bitacora as id, b.id_estudiante, u.nombre_completo as estudiante_nombre,
            b.id_grupo, g.nombre_proyecto as proyecto_nombre, 'comunitario' as tipo,
            b.numero_semana as semana, b.fecha_actividad::text as fecha, b.descripcion,
            b.horas_invertidas::text as horas, b.evidencia_foto_url as evidencia_url, b.estado
     from bitacoras_comunitario b
     join grupos_proyectos g on g.id_grupo = b.id_grupo
     join usuarios u on u.id_usuario = b.id_estudiante
     where g.id_tutor = $1 and b.estado in ('pendiente', 'corregir')
     union all
     select c.id_registro as id, c.id_estudiante, u.nombre_completo as estudiante_nombre,
            null::uuid as id_grupo, null as proyecto_nombre, c.tipo as tipo,
            null as semana, c.fecha_actividad::text as fecha, c.descripcion,
            c.horas_invertidas::text as horas, c.evidencia_foto_url as evidencia_url, c.estado
     from control_servicios_institucionales c
     join integrantes_grupo ig on ig.id_estudiante = c.id_estudiante
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     join usuarios u on u.id_usuario = c.id_estudiante
     where g.id_tutor = $1 and c.estado in ('pendiente', 'corregir')
     order by fecha asc`,
    [idTutor]
  );
  return rows.map((r) => ({
    id: r.id,
    idEstudiante: r.id_estudiante,
    estudianteNombre: r.estudiante_nombre,
    idGrupo: r.id_grupo,
    proyectoNombre: r.proyecto_nombre,
    tipo: r.tipo,
    semana: r.semana,
    fecha: r.fecha,
    descripcion: r.descripcion,
    horas: Number(r.horas),
    evidenciaUrl: r.evidencia_url,
    estado: r.estado,
  }));
}

export async function cambiarEstadoRegistro(
  datos: {
    id: string;
    tipo: TipoRegistro;
    idTutor: string;
    estado: 'aprobado' | 'rechazado' | 'corregir';
    comentario: string | null;
  }
): Promise<{ estado: string }> {
  const { id, tipo, idTutor, estado, comentario } = datos;

  let filas: number;
  if (tipo === 'comunitario') {
    const { rows } = await pool.query<{ id_bitacora: string }>(
      `update bitacoras_comunitario b
       set estado = $2, comentario_tutor = $3
       where b.id_bitacora = $1
         and exists (select 1 from grupos_proyectos g
                     where g.id_grupo = b.id_grupo and g.id_tutor = $4)
       returning id_bitacora`,
      [id, estado, comentario, idTutor]
    );
    filas = rows.length;
  } else {
    const { rows } = await pool.query<{ id_registro: string }>(
      `update control_servicios_institucionales c
       set estado = $2, comentario_tutor = $3
       where c.id_registro = $1
         and exists (select 1
                     from integrantes_grupo ig
                     join grupos_proyectos g on g.id_grupo = ig.id_grupo
                     where ig.id_estudiante = c.id_estudiante and g.id_tutor = $4)
       returning id_registro`,
      [id, estado, comentario, idTutor]
    );
    filas = rows.length;
  }

  if (filas === 0) {
    throw new ApiError(404, 'Registro no encontrado o sin autorización para validarlo');
  }

  return { estado };
}