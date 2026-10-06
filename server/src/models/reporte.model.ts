import { pool } from '../db/pool.js';
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
                                        where ig.id_estudiante = u.id_usuario and gp.id_tutor = $3))
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
     where ig.id_estudiante = $1 and gp.id_tutor = $2
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