import { pool } from '../db/pool.js';

export interface FilaPeriodo {
  idPeriodo: number;
  nombrePeriodo: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export async function listarPeriodos(soloActivos: boolean): Promise<FilaPeriodo[]> {
  const { rows } = await pool.query<{
    id_periodo: number;
    nombre_periodo: string;
    fecha_inicio: string;
    fecha_fin: string;
    activo: boolean;
  }>(
    `select id_periodo,
            nombre_periodo,
            fecha_inicio::text as fecha_inicio,
            fecha_fin::text as fecha_fin,
            activo
     from periodos_academicos
     ${soloActivos ? 'where activo' : ''}
     order by fecha_inicio desc`,
    []
  );
  return rows.map((r) => ({
    idPeriodo: r.id_periodo,
    nombrePeriodo: r.nombre_periodo,
    fechaInicio: r.fecha_inicio,
    fechaFin: r.fecha_fin,
    activo: r.activo,
  }));
}
