import { pool } from '../db/pool.js';
import { esTutorDelGrupo } from '../lib/tutores.js';
import { obtenerConfiguracion } from './configuracion.model.js';
import { obtenerGrupo, type DetalleGrupo } from './grupo.model.js';
import type { EstadoFinal } from './grupo.model.js';

/**
 * Datos que alimentan los reportes en PDF y Excel.
 *
 * Los tres reportes salen de las mismas cifras que el dashboard: solo cuentan
 * horas **aprobadas**. Un reporte que sumara tambien lo pendiente daria por
 * cumplido un requisito que todavia no se cumple.
 */

export interface FilaConsolidado {
  idUsuario: string;
  cedula: string;
  nombreCompleto: string;
  horasDirectas: number;
  directasPendientes: number;
  horasImpacto: number;
  impactoPendientes: number;
  totalAprobadas: number;
}

export interface FiltroConsolidado {
  /** Periodo academico; `null` cuenta todas las horas registradas. */
  periodoId: number | null;
  /** Un solo grupo; el tutor lo usa para aislar su proyecto. */
  idGrupo: string | null;
  /** El tutor solo ve los estudiantes de sus grupos. */
  idTutor: string | null;
}

export interface PeriodoInfo {
  id: number;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
}

/** `null` si el reporte no se acota a un periodo y no hay uno activo. */
export async function obtenerPeriodo(periodoId: number | null): Promise<PeriodoInfo | null> {
  const { rows } = await pool.query<{
    id_periodo: number;
    nombre_periodo: string;
    fecha_inicio: string;
    fecha_fin: string;
  }>(
    `select p.id_periodo, p.nombre_periodo, p.fecha_inicio::text, p.fecha_fin::text
     from periodos_academicos p
     where ($1::int is null and p.activo) or p.id_periodo = $1
     order by p.id_periodo desc
     limit 1`,
    [periodoId]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    id: r.id_periodo,
    nombre: r.nombre_periodo,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
  };
}

interface ConsolidadoRow {
  id_usuario: string;
  cedula: string;
  nombre_completo: string;
  d_aprobadas: string;
  d_pendientes: string;
  i_aprobadas: string;
  i_pendientes: string;
}

/**
 * Una fila por estudiante activo, con sus horas aprobadas y pendientes.
 *
 * El filtro de grupo aprieta las horas directas a ese grupo (las de impacto no
 * tienen grupo: se atribuyen por la pertenencia del estudiante en el periodo).
 */
export async function obtenerConsolidado(filtro: FiltroConsolidado): Promise<FilaConsolidado[]> {
  const { rows } = await pool.query<ConsolidadoRow>(
    `select u.id_usuario,
            u.cedula,
            u.nombre_completo,
            coalesce(d.aprobadas, 0)::text as d_aprobadas,
            coalesce(d.pendientes, 0)::text as d_pendientes,
            coalesce(i.aprobadas, 0)::text as i_aprobadas,
            coalesce(i.pendientes, 0)::text as i_pendientes
     from usuarios u
     left join lateral (
       select coalesce(sum(b.horas_invertidas) filter (where b.estado = 'aprobado'), 0) as aprobadas,
              coalesce(sum(b.horas_invertidas) filter (where b.estado in ('pendiente', 'corregir')), 0) as pendientes
       from bitacoras_comunitario b
       where b.id_estudiante = u.id_usuario
         and ($1::uuid is null or b.id_grupo = $1)
         and ($2::int is null or b.id_grupo in (select gp.id_grupo from grupos_proyectos gp
                                                 where gp.id_periodo = $2))
     ) d on true
     left join lateral (
       select coalesce(sum(c.horas_invertidas) filter (where c.estado = 'aprobado'), 0) as aprobadas,
              coalesce(sum(c.horas_invertidas) filter (where c.estado in ('pendiente', 'corregir')), 0) as pendientes
       from control_servicios_institucionales c
       where c.id_estudiante = u.id_usuario
         and ($2::int is null or exists (
               select 1 from integrantes_grupo ig
               join grupos_proyectos gp on gp.id_grupo = ig.id_grupo
               where ig.id_estudiante = c.id_estudiante and gp.id_periodo = $2))
     ) i on true
     where u.rol = 'estudiante'
       and u.activo
       and ($1::uuid is null or exists (select 1 from integrantes_grupo ig
                                        where ig.id_estudiante = u.id_usuario and ig.id_grupo = $1))
       and ($3::uuid is null or exists (select 1 from integrantes_grupo ig
                                        join grupos_proyectos gp on gp.id_grupo = ig.id_grupo
                                        where ig.id_estudiante = u.id_usuario and ${esTutorDelGrupo('gp', 3)}))
     order by u.nombre_completo asc`,
    [filtro.idGrupo, filtro.periodoId, filtro.idTutor]
  );

  return rows.map((r) => {
    const horasDirectas = Number(r.d_aprobadas);
    const horasImpacto = Number(r.i_aprobadas);
    return {
      idUsuario: r.id_usuario,
      cedula: r.cedula,
      nombreCompleto: r.nombre_completo,
      horasDirectas,
      directasPendientes: Number(r.d_pendientes),
      horasImpacto,
      impactoPendientes: Number(r.i_pendientes),
      totalAprobadas: horasDirectas + horasImpacto,
    };
  });
}

export interface IntegranteActa {
  cedula: string;
  nombreCompleto: string;
  estadoFinal: EstadoFinal | null;
  horasDirectas: number;
  horasImpacto: number;
  total: number;
}

export interface DatosActa {
  grupo: DetalleGrupo;
  periodo: PeriodoInfo | null;
  integrantes: IntegranteActa[];
  totales: { directas: number; impacto: number; total: number };
}

/**
 * Acta de culminacion de un grupo: integrantes, horas y estado final.
 *
 * Las horas de impacto son las del periodo del grupo, porque un registro de
 * servicio no pertenece a ningun grupo concreto.
 */
export async function obtenerDatosActa(idGrupo: string): Promise<DatosActa | null> {
  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) return null;

  const { rows } = await pool.query<{
    cedula: string;
    nombre_completo: string;
    estado_final: EstadoFinal | null;
    horas_directas: string;
    horas_impacto: string;
  }>(
    `select u.cedula,
            u.nombre_completo,
            ig.estado_final,
            coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                      where b.id_estudiante = u.id_usuario and b.id_grupo = $1
                        and b.estado = 'aprobado'), 0)::text as horas_directas,
            coalesce((select sum(c.horas_invertidas) from control_servicios_institucionales c
                      where c.id_estudiante = u.id_usuario and c.estado = 'aprobado'
                        and ($2::int is null or exists (
                              select 1 from integrantes_grupo ig2
                              join grupos_proyectos gp on gp.id_grupo = ig2.id_grupo
                              where ig2.id_estudiante = c.id_estudiante and gp.id_periodo = $2))
                    ), 0)::text as horas_impacto
     from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_grupo = $1
     order by u.nombre_completo asc`,
    [idGrupo, grupo.periodoId]
  );

  const integrantes: IntegranteActa[] = rows.map((r) => {
    const horasDirectas = Number(r.horas_directas);
    const horasImpacto = Number(r.horas_impacto);
    return {
      cedula: r.cedula,
      nombreCompleto: r.nombre_completo,
      estadoFinal: r.estado_final,
      horasDirectas,
      horasImpacto,
      total: horasDirectas + horasImpacto,
    };
  });

  return {
    grupo,
    periodo: await obtenerPeriodo(grupo.periodoId),
    integrantes,
    totales: integrantes.reduce(
      (acc, i) => ({
        directas: acc.directas + i.horasDirectas,
        impacto: acc.impacto + i.horasImpacto,
        total: acc.total + i.total,
      }),
      { directas: 0, impacto: 0, total: 0 }
    ),
  };
}

/** `true` si el estudiante pertenece a al menos un grupo del tutor. */
export async function esIntegranteDeTutor(idEstudiante: string, idTutor: string): Promise<boolean> {
  const { rows } = await pool.query(
    `select 1
     from integrantes_grupo ig
     join grupos_proyectos gp on gp.id_grupo = ig.id_grupo
     where ig.id_estudiante = $1 and ${esTutorDelGrupo('gp', 2)}
     limit 1`,
    [idEstudiante, idTutor]
  );
  return rows.length > 0;
}

export interface DatosCertificado {
  idUsuario: string;
  cedula: string;
  nombreCompleto: string;
  periodo: PeriodoInfo | null;
  horasDirectas: number;
  horasImpacto: number;
  total: number;
  metas: { directas: number; impacto: number };
  cumpleMetas: boolean;
  pendientes: number;
}

/** Resumen de un estudiante para el certificado; `null` si no es estudiante. */
export async function obtenerDatosCertificado(
  idUsuario: string,
  periodoId: number | null
): Promise<DatosCertificado | null> {
  const { rows } = await pool.query<{
    id_usuario: string;
    cedula: string;
    nombre_completo: string;
    horas_directas: string;
    horas_impacto: string;
    pendientes: string;
  }>(
    `select u.id_usuario,
            u.cedula,
            u.nombre_completo,
            coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                      where b.id_estudiante = u.id_usuario and b.estado = 'aprobado'
                        and ($1::int is null or b.id_grupo in (select gp.id_grupo from grupos_proyectos gp
                                                               where gp.id_periodo = $1))), 0)::text as horas_directas,
            coalesce((select sum(c.horas_invertidas) from control_servicios_institucionales c
                      where c.id_estudiante = u.id_usuario and c.estado = 'aprobado'
                        and ($1::int is null or exists (
                              select 1 from integrantes_grupo ig
                              join grupos_proyectos gp on gp.id_grupo = ig.id_grupo
                              where ig.id_estudiante = c.id_estudiante and gp.id_periodo = $1))), 0)::text as horas_impacto,
            (
              (select count(*) from bitacoras_comunitario b
               where b.id_estudiante = u.id_usuario and b.estado in ('pendiente', 'corregir')) +
              (select count(*) from control_servicios_institucionales c
               where c.id_estudiante = u.id_usuario and c.estado in ('pendiente', 'corregir'))
            )::text as pendientes
     from usuarios u
     where u.id_usuario = $2 and u.rol = 'estudiante'`,
    [periodoId, idUsuario]
  );

  const r = rows[0];
  if (!r) return null;

  const config = await obtenerConfiguracion();
  const horasDirectas = Number(r.horas_directas);
  const horasImpacto = Number(r.horas_impacto);
  return {
    idUsuario: r.id_usuario,
    cedula: r.cedula,
    nombreCompleto: r.nombre_completo,
    periodo: await obtenerPeriodo(periodoId),
    horasDirectas,
    horasImpacto,
    total: horasDirectas + horasImpacto,
    metas: { directas: config.horasDirectas, impacto: config.horasImpacto },
    cumpleMetas:
      horasDirectas >= config.horasDirectas && horasImpacto >= config.horasImpacto,
    pendientes: Number(r.pendientes),
  };
}

// ====================================================================
// Reporte semanal de actividades
// ====================================================================
//
// A diferencia del consolidado, que da UNA fila por estudiante, este devuelve
// una fila por ACTIVIDAD: es lo que pedia la revision para poder ver "las
// actividades especificas realizadas por cada grupo o por cada estudiante".
//
// La semana se calcula desde el inicio del periodo academico y no desde el
// calendario. Hay dos motivos:
//
//  1. `control_servicios_institucionales` no tiene columna de semana, solo
//     fecha. Calcularla es la unica forma de comparar las dos tablas.
//  2. `bitacoras_comunitario.numero_semana` lo escribe el estudiante a mano y
//     puede no coincidir. Se devuelve aparte (`semanaDeclarada`) para poder
//     senalar la discrepancia en vez de taparla.

export interface FilaSemanal {
  id: string;
  /** Semana calculada desde `periodos_academicos.fecha_inicio`. */
  semana: number;
  /** Lo que escribio el estudiante. `null` en los servicios institucionales. */
  semanaDeclarada: number | null;
  fecha: string;
  tipo: 'comunitario' | 'social' | 'ambiental';
  idEstudiante: string;
  estudiante: string;
  cedula: string;
  idGrupo: string | null;
  proyecto: string | null;
  descripcion: string;
  horas: number;
  estado: string;
  tieneEvidencia: boolean;
}

export interface FiltroSemanal {
  periodoId: number | null;
  /** `null` = todas las semanas del periodo. */
  semana: number | null;
  idGrupo: string | null;
  idEstudiante: string | null;
  /** Acota a los grupos de un tutor. */
  idTutor: string | null;
}

/**
 * Las dos tablas, con la semana calculada contra el periodo.
 *
 * `floor((fecha - inicio) / 7) + 1`: la semana 1 son los siete primeros dias
 * del periodo. Una actividad anterior al inicio daria 0 o negativo, asi que se
 * recorta a 1 con `greatest`.
 */
const SELECT_SEMANAL = `
     select b.id_bitacora::text as id,
            greatest(1, floor((b.fecha_actividad - p.fecha_inicio) / 7) + 1)::int as semana,
            b.numero_semana as semana_declarada,
            b.fecha_actividad::text as fecha,
            'comunitario' as tipo,
            u.id_usuario as id_estudiante,
            u.nombre_completo as estudiante,
            u.cedula,
            b.id_grupo,
            g.nombre_proyecto as proyecto,
            b.descripcion,
            b.horas_invertidas::text as horas,
            b.estado,
            (b.evidencia_foto_url is not null) as tiene_evidencia
     from bitacoras_comunitario b
     join usuarios u on u.id_usuario = b.id_estudiante
     left join grupos_proyectos g on g.id_grupo = b.id_grupo
     join periodos_academicos p on p.id_periodo = $1
     where ($2::int is null
            or greatest(1, floor((b.fecha_actividad - p.fecha_inicio) / 7) + 1) = $2)
       and ($3::uuid is null or b.id_grupo = $3)
       and ($4::uuid is null or b.id_estudiante = $4)
       and ($5::uuid is null or exists (
             select 1 from grupos_proyectos gt
             where gt.id_grupo = b.id_grupo
               and (gt.id_tutor_academico = $5 or gt.id_tutor_comunitario = $5)))
       and b.fecha_actividad between p.fecha_inicio and p.fecha_fin
     union all
     select c.id_registro::text as id,
            greatest(1, floor((c.fecha_actividad - p.fecha_inicio) / 7) + 1)::int as semana,
            null::int as semana_declarada,
            c.fecha_actividad::text as fecha,
            c.tipo,
            u.id_usuario as id_estudiante,
            u.nombre_completo as estudiante,
            u.cedula,
            null::uuid as id_grupo,
            null as proyecto,
            c.descripcion,
            c.horas_invertidas::text as horas,
            c.estado,
            (c.evidencia_foto_url is not null) as tiene_evidencia
     from control_servicios_institucionales c
     join usuarios u on u.id_usuario = c.id_estudiante
     join periodos_academicos p on p.id_periodo = $1
     where ($2::int is null
            or greatest(1, floor((c.fecha_actividad - p.fecha_inicio) / 7) + 1) = $2)
       -- El servicio social/ambiental no se registra contra un grupo. Filtrar
       -- por grupo significa "los estudiantes de ese grupo".
       and ($3::uuid is null or exists (
             select 1 from integrantes_grupo ig
             where ig.id_estudiante = c.id_estudiante and ig.id_grupo = $3))
       and ($4::uuid is null or c.id_estudiante = $4)
       and ($5::uuid is null or exists (
             select 1 from integrantes_grupo ig
             join grupos_proyectos gt on gt.id_grupo = ig.id_grupo
             where ig.id_estudiante = c.id_estudiante
               and (gt.id_tutor_academico = $5 or gt.id_tutor_comunitario = $5)))
       and c.fecha_actividad between p.fecha_inicio and p.fecha_fin`;

interface SemanalRow {
  id: string;
  semana: number;
  semana_declarada: number | null;
  fecha: string;
  tipo: 'comunitario' | 'social' | 'ambiental';
  id_estudiante: string;
  estudiante: string;
  cedula: string;
  id_grupo: string | null;
  proyecto: string | null;
  descripcion: string;
  horas: string;
  estado: string;
  tiene_evidencia: boolean;
}

function mapSemanal(r: SemanalRow): FilaSemanal {
  return {
    id: r.id,
    semana: r.semana,
    semanaDeclarada: r.semana_declarada,
    fecha: r.fecha,
    tipo: r.tipo,
    idEstudiante: r.id_estudiante,
    estudiante: r.estudiante,
    cedula: r.cedula,
    idGrupo: r.id_grupo,
    proyecto: r.proyecto,
    descripcion: r.descripcion,
    horas: Number(r.horas),
    estado: r.estado,
    tieneEvidencia: r.tiene_evidencia,
  };
}

export async function obtenerDetalleSemanal(
  periodoId: number,
  filtro: FiltroSemanal
): Promise<FilaSemanal[]> {
  const { rows } = await pool.query<SemanalRow>(
    `select * from (${SELECT_SEMANAL}) as actividades
     order by semana asc, estudiante asc, fecha asc, id asc`,
    [periodoId, filtro.semana, filtro.idGrupo, filtro.idEstudiante, filtro.idTutor]
  );
  return rows.map(mapSemanal);
}

export interface SemanaConActividad {
  semana: number;
  /** Primer dia de esa semana dentro del periodo. */
  desde: string;
  hasta: string;
  actividades: number;
  horas: number;
}

/** Semanas que tienen al menos una actividad, para poblar el selector. */
export async function obtenerSemanasConActividad(
  periodoId: number,
  filtro: FiltroSemanal
): Promise<SemanaConActividad[]> {
  const { rows } = await pool.query<{
    semana: number;
    desde: string;
    hasta: string;
    actividades: string;
    horas: string;
  }>(
    `select a.semana,
            (p.fecha_inicio + ((a.semana - 1) * 7))::text as desde,
            least(p.fecha_fin, p.fecha_inicio + ((a.semana - 1) * 7) + 6)::text as hasta,
            count(*)::text as actividades,
            coalesce(sum(a.horas::numeric), 0)::text as horas
     from (${SELECT_SEMANAL}) as a
     join periodos_academicos p on p.id_periodo = $1
     group by a.semana, p.fecha_inicio, p.fecha_fin
     order by a.semana asc`,
    [periodoId, null, filtro.idGrupo, filtro.idEstudiante, filtro.idTutor]
  );
  return rows.map((r) => ({
    semana: r.semana,
    desde: r.desde,
    hasta: r.hasta,
    actividades: Number(r.actividades),
    horas: Number(r.horas),
  }));
}

/** Nombre del estudiante, para titular su propio reporte. */
export async function nombreDeEstudiante(idUsuario: string): Promise<string | null> {
  const { rows } = await pool.query<{ nombre_completo: string }>(
    `select nombre_completo from usuarios where id_usuario = $1 and rol = 'estudiante'`,
    [idUsuario]
  );
  return rows[0]?.nombre_completo ?? null;
}
