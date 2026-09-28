import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';

export interface FilaPeriodo {
  idPeriodo: number;
  nombrePeriodo: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export interface DatosPeriodo {
  nombrePeriodo: string;
  fechaInicio: string;
  fechaFin: string;
}

interface PeriodoCrudo {
  id_periodo: number;
  nombre_periodo: string;
  fecha_inicio: string;
  fecha_fin: string;
  activo: boolean;
}

const SELECCION_PERIODO = `
  select id_periodo,
         nombre_periodo,
         fecha_inicio::text as fecha_inicio,
         fecha_fin::text as fecha_fin,
         activo
  from periodos_academicos
`;

function mapearPeriodo(r: PeriodoCrudo): FilaPeriodo {
  return {
    idPeriodo: r.id_periodo,
    nombrePeriodo: r.nombre_periodo,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    activo: r.activo,
  };
}

export async function listarPeriodos(soloActivos: boolean): Promise<FilaPeriodo[]> {
  const { rows } = await pool.query<PeriodoCrudo>(
    `${SELECCION_PERIODO}
     ${soloActivos ? 'where activo' : ''}
     order by fecha_inicio desc`,
    []
  );
  return rows.map(mapearPeriodo);
}

export async function obtenerPeriodo(id: number): Promise<FilaPeriodo> {
  const { rows } = await pool.query<PeriodoCrudo>(`${SELECCION_PERIODO} where id_periodo = $1`, [id]);
  if (rows.length === 0) {
    throw new ApiError(404, 'Período académico no encontrado');
  }
  return mapearPeriodo(rows[0]);
}

export async function crearPeriodo(datos: DatosPeriodo): Promise<FilaPeriodo> {
  const { rows: existentes } = await pool.query<{ id_periodo: number }>(
    'select id_periodo from periodos_academicos where lower(nombre_periodo) = lower($1)',
    [datos.nombrePeriodo]
  );
  if (existentes.length > 0) {
    throw new ApiError(409, 'Ya existe un período con ese nombre');
  }

  const { rows } = await pool.query<{ id_periodo: number }>(
    `insert into periodos_academicos (nombre_periodo, fecha_inicio, fecha_fin, activo)
     values ($1, $2, $3, true)
     returning id_periodo`,
    [datos.nombrePeriodo, datos.fechaInicio, datos.fechaFin]
  );

  return obtenerPeriodo(rows[0].id_periodo);
}

export async function actualizarPeriodo(id: number, datos: DatosPeriodo): Promise<FilaPeriodo> {
  const { rows: existentes } = await pool.query<{ id_periodo: number }>(
    'select id_periodo from periodos_academicos where lower(nombre_periodo) = lower($1) and id_periodo <> $2',
    [datos.nombrePeriodo, id]
  );
  if (existentes.length > 0) {
    throw new ApiError(409, 'Ya existe otro período con ese nombre');
  }

  const { rows } = await pool.query(
    `update periodos_academicos
     set nombre_periodo = $1, fecha_inicio = $2, fecha_fin = $3
     where id_periodo = $4
     returning id_periodo`,
    [datos.nombrePeriodo, datos.fechaInicio, datos.fechaFin, id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Período académico no encontrado');
  }

  return obtenerPeriodo(id);
}

export async function cambiarActivoPeriodo(id: number, activo: boolean): Promise<FilaPeriodo> {
  const { rows } = await pool.query(
    `update periodos_academicos
     set activo = $1
     where id_periodo = $2
     returning id_periodo`,
    [activo, id]
  );
  if (rows.length === 0) {
    throw new ApiError(404, 'Período académico no encontrado');
  }

  return obtenerPeriodo(id);
}
