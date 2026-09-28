import { pool } from '../db/pool.js';

export interface Configuracion {
  horasDirectas: number;
  horasImpacto: number;
}

interface FilaEntrada {
  id: string;
  tipo: 'comunitario' | 'social' | 'ambiental';
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidencia: boolean;
  estado: string;
}

export async function obtenerConfiguracion(): Promise<Configuracion> {
  const { rows } = await pool.query<{ horas_directas: number; horas_impacto: number }>(
    'select horas_directas, horas_impacto from configuracion_sistema limit 1'
  );
  return {
    horasDirectas: rows[0]?.horas_directas ?? 90,
    horasImpacto: rows[0]?.horas_impacto ?? 30,
  };
}

export async function obtenerHorasEstudiante(idEstudiante: string): Promise<{
  horasDirectas: number;
  horasImpacto: number;
  pendientes: number;
}> {
  const { rows } = await pool.query<{ directas: string; impacto: string; pendientes: string }>(
    `select
       coalesce((select sum(horas_invertidas) from bitacoras_comunitario
                 where id_estudiante = $1 and estado = 'aprobado'), 0)::text as directas,
       coalesce((select sum(horas_invertidas) from control_servicios_institucionales
                 where id_estudiante = $1 and estado = 'aprobado'), 0)::text as impacto,
       (
         (select count(*) from bitacoras_comunitario
          where id_estudiante = $1 and estado in ('pendiente', 'corregir')) +
         (select count(*) from control_servicios_institucionales
          where id_estudiante = $1 and estado in ('pendiente', 'corregir'))
       )::text as pendientes`,
    [idEstudiante]
  );
  return {
    horasDirectas: Number(rows[0]?.directas ?? 0),
    horasImpacto: Number(rows[0]?.impacto ?? 0),
    pendientes: Number(rows[0]?.pendientes ?? 0),
  };
}

export async function obtenerProyectoEstudiante(idEstudiante: string): Promise<{
  idGrupo: string;
  nombreProyecto: string;
  periodo: string;
  tutorNombre: string | null;
  estado: string;
  proyectoEscrito: boolean;
  diapositivas: boolean;
  integrantes: { id: string; nombre: string }[];
} | null> {
  const { rows } = await pool.query<{
    id_grupo: string;
    nombre_proyecto: string;
    nombre_periodo: string;
    tutor_nombre: string | null;
    estado: string;
    proyecto_escrito: boolean;
    diapositivas: boolean;
  }>(
    `select g.id_grupo, g.nombre_proyecto, p.nombre_periodo,
            t.nombre_completo as tutor_nombre, g.estado,
            (g.proyecto_escrito_url is not null) as proyecto_escrito,
            (g.diapositivas_url is not null) as diapositivas
     from integrantes_grupo ig
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     join periodos_academicos p on p.id_periodo = g.id_periodo
     left join usuarios t on t.id_usuario = g.id_tutor
     where ig.id_estudiante = $1 and g.estado not in ('finalizado', 'suspendido')
     order by g.creado_en desc
     limit 1`,
    [idEstudiante]
  );
  const grupo = rows[0];
  if (!grupo) return null;

  const integrantes = await pool.query<{ id_usuario: string; nombre_completo: string }>(
    `select u.id_usuario, u.nombre_completo
     from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_grupo = $1
     order by u.nombre_completo asc`,
    [grupo.id_grupo]
  );

  return {
    idGrupo: grupo.id_grupo,
    nombreProyecto: grupo.nombre_proyecto,
    periodo: grupo.nombre_periodo,
    tutorNombre: grupo.tutor_nombre,
    estado: grupo.estado,
    proyectoEscrito: grupo.proyecto_escrito,
    diapositivas: grupo.diapositivas,
    integrantes: integrantes.rows.map((i) => ({ id: i.id_usuario, nombre: i.nombre_completo })),
  };
}

export async function obtenerEntradasEstudiante(idEstudiante: string, estado: 'pendientes' | 'aprobadas'): Promise<FilaEntrada[]> {
  const condicionEstado =
    estado === 'pendientes' ? "estado in ('pendiente', 'corregir')" : "estado = 'aprobado'";

  const { rows } = await pool.query<FilaEntrada>(
    `select id_bitacora as id, 'comunitario' as tipo, numero_semana as semana,
            fecha_actividad::text as fecha, descripcion, horas_invertidas as horas,
            (evidencia_foto_url is not null) as evidencia, estado
     from bitacoras_comunitario
     where id_estudiante = $1 and ${condicionEstado}
     union all
     select id_registro as id, tipo, null as semana, fecha_actividad::text as fecha,
            descripcion, horas_invertidas as horas,
            (evidencia_foto_url is not null) as evidencia, estado
     from control_servicios_institucionales
     where id_estudiante = $1 and ${condicionEstado}
     order by fecha desc
     limit 8`,
    [idEstudiante]
  );
  return rows;
}

export interface FilaPendienteTutor {
  id: string;
  estudianteNombre: string;
  tipo: 'comunitario' | 'social' | 'ambiental';
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  estado: string;
}

export async function obtenerProyectosTutor(idTutor: string): Promise<{
  idGrupo: string;
  nombreProyecto: string;
  periodo: string;
  estado: string;
}[]> {
  const { rows } = await pool.query<{ id_grupo: string; nombre_proyecto: string; nombre_periodo: string; estado: string }>(
    `select g.id_grupo, g.nombre_proyecto, p.nombre_periodo, g.estado
     from grupos_proyectos g
     join periodos_academicos p on p.id_periodo = g.id_periodo
     where g.id_tutor = $1
     order by p.nombre_periodo desc, g.creado_en desc`,
    [idTutor]
  );
  return rows.map((r) => ({
    idGrupo: r.id_grupo,
    nombreProyecto: r.nombre_proyecto,
    periodo: r.nombre_periodo,
    estado: r.estado,
  }));
}

export async function obtenerIntegrantesPorGrupo(idTutor: string): Promise<Map<string, { id: string; nombre: string }[]>> {
  const { rows } = await pool.query<{ id_grupo: string; id_usuario: string; nombre_completo: string }>(
    `select ig.id_grupo, u.id_usuario, u.nombre_completo
     from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     where g.id_tutor = $1
     order by u.nombre_completo asc`,
    [idTutor]
  );
  const mapa = new Map<string, { id: string; nombre: string }[]>();
  for (const r of rows) {
    const actual = mapa.get(r.id_grupo) ?? [];
    actual.push({ id: r.id_usuario, nombre: r.nombre_completo });
    mapa.set(r.id_grupo, actual);
  }
  return mapa;
}

export async function obtenerResumenTutor(idTutor: string): Promise<{
  pendientes: number;
  aprobadas: number;
  rechazadas: number;
  estudiantes: number;
  proyectos: number;
}> {
  const { rows } = await pool.query<{
    pendientes: string;
    aprobadas: string;
    rechazadas: string;
    estudiantes: string;
    proyectos: string;
  }>(
    `select
       coalesce((
         (select count(*) from bitacoras_comunitario b
          join grupos_proyectos g on g.id_grupo = b.id_grupo
          where g.id_tutor = $1 and b.estado in ('pendiente', 'corregir')) +
         (select count(*) from control_servicios_institucionales c
          join integrantes_grupo ig on ig.id_estudiante = c.id_estudiante
          join grupos_proyectos g on g.id_grupo = ig.id_grupo
          where g.id_tutor = $1 and c.estado in ('pendiente', 'corregir'))
       ), 0)::text as pendientes,
       coalesce((
         (select count(*) from bitacoras_comunitario b
          join grupos_proyectos g on g.id_grupo = b.id_grupo
          where g.id_tutor = $1 and b.estado = 'aprobado') +
         (select count(*) from control_servicios_institucionales c
          join integrantes_grupo ig on ig.id_estudiante = c.id_estudiante
          join grupos_proyectos g on g.id_grupo = ig.id_grupo
          where g.id_tutor = $1 and c.estado = 'aprobado')
       ), 0)::text as aprobadas,
       coalesce((
         (select count(*) from bitacoras_comunitario b
          join grupos_proyectos g on g.id_grupo = b.id_grupo
          where g.id_tutor = $1 and b.estado = 'rechazado') +
         (select count(*) from control_servicios_institucionales c
          join integrantes_grupo ig on ig.id_estudiante = c.id_estudiante
          join grupos_proyectos g on g.id_grupo = ig.id_grupo
          where g.id_tutor = $1 and c.estado = 'rechazado')
       ), 0)::text as rechazadas,
       coalesce((select count(distinct ig.id_estudiante)
                 from integrantes_grupo ig
                 join grupos_proyectos g on g.id_grupo = ig.id_grupo
                 where g.id_tutor = $1), 0)::text as estudiantes,
       coalesce((select count(*) from grupos_proyectos where id_tutor = $1), 0)::text as proyectos`,
    [idTutor]
  );
  return {
    pendientes: Number(rows[0]?.pendientes ?? 0),
    aprobadas: Number(rows[0]?.aprobadas ?? 0),
    rechazadas: Number(rows[0]?.rechazadas ?? 0),
    estudiantes: Number(rows[0]?.estudiantes ?? 0),
    proyectos: Number(rows[0]?.proyectos ?? 0),
  };
}

export async function obtenerPendientesTutor(idTutor: string): Promise<FilaPendienteTutor[]> {
  const { rows } = await pool.query<FilaPendienteTutor>(
    `select b.id_bitacora as id, u.nombre_completo as "estudianteNombre",
            'comunitario' as tipo, b.numero_semana as semana,
            b.fecha_actividad::text as fecha, b.descripcion, b.horas_invertidas as horas, b.estado
     from bitacoras_comunitario b
     join grupos_proyectos g on g.id_grupo = b.id_grupo
     join usuarios u on u.id_usuario = b.id_estudiante
     where g.id_tutor = $1 and b.estado in ('pendiente', 'corregir')
     union all
     select c.id_registro as id, u.nombre_completo as "estudianteNombre",
            c.tipo as tipo, null as semana, c.fecha_actividad::text as fecha,
            c.descripcion, c.horas_invertidas as horas, c.estado
     from control_servicios_institucionales c
     join integrantes_grupo ig on ig.id_estudiante = c.id_estudiante
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     join usuarios u on u.id_usuario = c.id_estudiante
     where g.id_tutor = $1 and c.estado in ('pendiente', 'corregir')
     order by fecha desc
     limit 8`,
    [idTutor]
  );
  return rows;
}

export async function obtenerResumenGestion(): Promise<{
  estudiantes: number;
  tutores: number;
  proyectosEnCurso: number;
  horasValidadas: number;
  pendientes: number;
  horasDirectas: number;
  horasImpacto: number;
  totalRegistradas: number;
}> {
  const { rows } = await pool.query<{
    estudiantes: string;
    tutores: string;
    proyectosEnCurso: string;
    horasValidadas: string;
    pendientes: string;
    horasDirectas: string;
    horasImpacto: string;
    totalRegistradas: string;
  }>(
    `select
       (select count(*) from usuarios where rol = 'estudiante' and activo)::text as estudiantes,
       (select count(*) from usuarios where rol = 'tutor')::text as tutores,
       (select count(*) from grupos_proyectos where estado in ('en_curso', 'pendiente_aprobacion'))::text as "proyectosEnCurso",
       coalesce((
         (select coalesce(sum(horas_invertidas), 0) from bitacoras_comunitario where estado = 'aprobado') +
         (select coalesce(sum(horas_invertidas), 0) from control_servicios_institucionales where estado = 'aprobado')
       ), 0)::text as "horasValidadas",
       (
         (select count(*) from bitacoras_comunitario where estado in ('pendiente', 'corregir')) +
         (select count(*) from control_servicios_institucionales where estado in ('pendiente', 'corregir'))
       )::text as pendientes,
       coalesce((select sum(horas_invertidas) from bitacoras_comunitario where estado = 'aprobado'), 0)::text as "horasDirectas",
       coalesce((select sum(horas_invertidas) from control_servicios_institucionales where estado = 'aprobado'), 0)::text as "horasImpacto",
       coalesce((
         (select coalesce(sum(horas_invertidas), 0) from bitacoras_comunitario) +
         (select coalesce(sum(horas_invertidas), 0) from control_servicios_institucionales)
       ), 0)::text as "totalRegistradas"`
  );
  const r = rows[0]!;
  return {
    estudiantes: Number(r.estudiantes),
    tutores: Number(r.tutores),
    proyectosEnCurso: Number(r.proyectosEnCurso),
    horasValidadas: Number(r.horasValidadas),
    pendientes: Number(r.pendientes),
    horasDirectas: Number(r.horasDirectas),
    horasImpacto: Number(r.horasImpacto),
    totalRegistradas: Number(r.totalRegistradas),
  };
}

export async function obtenerProyectosPendientes(): Promise<{
  idGrupo: string;
  nombre: string;
  tutorNombre: string | null;
  materialCompleto: boolean;
}[]> {
  const { rows } = await pool.query<{
    id_grupo: string;
    nombre_proyecto: string;
    tutor_nombre: string | null;
    escenario: string;
  }>(
    `select g.id_grupo, g.nombre_proyecto, t.nombre_completo as tutor_nombre,
            (g.proyecto_escrito_url is not null)::text as escenario
     from grupos_proyectos g
     left join usuarios t on t.id_usuario = g.id_tutor
     where g.estado = 'pendiente_aprobacion'
     order by g.creado_en desc`
  );
  return rows.map((r) => ({
    idGrupo: r.id_grupo,
    nombre: r.nombre_proyecto,
    tutorNombre: r.tutor_nombre,
    materialCompleto: r.escenario === 'true',
  }));
}

export async function obtenerTutores(): Promise<{
  id: string;
  nombre: string;
  cedula: string;
  firma: boolean;
  sello: boolean;
}[]> {
  const { rows } = await pool.query<{
    id_usuario: string;
    nombre_completo: string;
    cedula: string;
    firma_url: string | null;
    sello_url: string | null;
  }>(
    `select id_usuario, nombre_completo, cedula, firma_url, sello_url
     from usuarios
     where rol = 'tutor' and activo
     order by nombre_completo asc`
  );
  return rows.map((r) => ({
    id: r.id_usuario,
    nombre: r.nombre_completo,
    cedula: r.cedula,
    firma: r.firma_url != null,
    sello: r.sello_url != null,
  }));
}

export async function obtenerActividadReciente(): Promise<{
  id: string;
  descripcion: string;
  fecha: string;
  tipo: string;
  usuario: string;
}[]> {
  const { rows } = await pool.query<{
    id: string;
    descripcion: string;
    fecha: string;
    tipo: 'registro' | 'inscripcion';
    usuario: string;
  }>(
    `(select b.id_bitacora::text as id, 'Registró horas de bitácora comunitaria' as descripcion,
             b.creado_en::text as fecha, 'registro' as tipo, u.nombre_completo as usuario
      from bitacoras_comunitario b
      join usuarios u on u.id_usuario = b.id_estudiante)
     union all
     (select c.id_registro::text as id, 'Registró servicio ' || c.tipo as descripcion,
             c.creado_en::text as fecha, 'registro' as tipo, u.nombre_completo as usuario
      from control_servicios_institucionales c
      join usuarios u on u.id_usuario = c.id_estudiante)
     union all
     (select g.id_grupo::text as id, 'Creación de grupo/proyecto' as descripcion,
             g.creado_en::text as fecha, 'inscripcion' as tipo, t.nombre_completo as usuario
      from grupos_proyectos g
      join usuarios t on t.id_usuario = g.id_tutor)
     order by fecha desc
     limit 8`
  );
  return rows;
}