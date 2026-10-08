import { pool } from '../db/pool.js';

export type CampoSolicitud = 'nombre_completo' | 'email';
export type EstadoSolicitud = 'pendiente' | 'aprobada' | 'rechazada';

export interface SolicitudRow {
  id_solicitud: string;
  id_usuario: string;
  campo: CampoSolicitud;
  valor_anterior: string | null;
  valor_nuevo: string;
  estado: EstadoSolicitud;
  comentario: string | null;
  id_resolvio: string | null;
  creado_en: Date;
  resuelto_en: Date | null;
}

export interface SolicitudPublica {
  idSolicitud: string;
  campo: CampoSolicitud;
  valorAnterior: string | null;
  valorNuevo: string;
  estado: EstadoSolicitud;
  comentario: string | null;
  creadoEn: Date;
  resueltoEn: Date | null;
  estudianteNombre?: string;
}

export function mapSolicitudPublica(row: SolicitudRow & { estudiante_nombre?: string }): SolicitudPublica {
  const publica: SolicitudPublica = {
    idSolicitud: row.id_solicitud,
    campo: row.campo,
    valorAnterior: row.valor_anterior,
    valorNuevo: row.valor_nuevo,
    estado: row.estado,
    comentario: row.comentario,
    creadoEn: row.creado_en,
    resueltoEn: row.resuelto_en,
  };
  if (row.estudiante_nombre !== undefined) {
    publica.estudianteNombre = row.estudiante_nombre;
  }
  return publica;
}

export async function crearSolicitud(datos: {
  idUsuario: string;
  campo: CampoSolicitud;
  valorAnterior: string | null;
  valorNuevo: string;
}): Promise<SolicitudRow> {
  const { rows } = await pool.query<SolicitudRow>(
    `insert into solicitudes_cambio (id_usuario, campo, valor_anterior, valor_nuevo)
     values ($1, $2, $3, $4)
     returning *`,
    [datos.idUsuario, datos.campo, datos.valorAnterior, datos.valorNuevo]
  );
  return rows[0];
}

export async function findPendientePorCampo(
  idUsuario: string,
  campo: CampoSolicitud
): Promise<SolicitudRow | null> {
  const { rows } = await pool.query<SolicitudRow>(
    `select * from solicitudes_cambio
      where id_usuario = $1 and campo = $2 and estado = 'pendiente'
      limit 1`,
    [idUsuario, campo]
  );
  return rows[0] ?? null;
}

export async function findSolicitudPorId(id: string): Promise<SolicitudRow | null> {
  const { rows } = await pool.query<SolicitudRow>(
    'select * from solicitudes_cambio where id_solicitud = $1',
    [id]
  );
  return rows[0] ?? null;
}

/** Listado para coordinacion: siempre con el nombre del estudiante. */
export async function listarSolicitudes(estado: EstadoSolicitud | 'todas'): Promise<SolicitudRow[]> {
  const where = estado === 'todas' ? '' : 'where s.estado = $1';
  const params = estado === 'todas' ? [] : [estado];
  const { rows } = await pool.query<SolicitudRow & { estudiante_nombre: string }>(
    `select s.*, u.nombre_completo as estudiante_nombre
       from solicitudes_cambio s
       join usuarios u on u.id_usuario = s.id_usuario
       ${where}
      order by s.creado_en desc`,
    params
  );
  return rows;
}

/** Las propias del estudiante (para ver el estado en su perfil). */
export async function listarMias(idUsuario: string): Promise<SolicitudRow[]> {
  const { rows } = await pool.query<SolicitudRow>(
    `select * from solicitudes_cambio
      where id_usuario = $1
      order by creado_en desc`,
    [idUsuario]
  );
  return rows;
}

/**
 * Resuelve una solicitud. Solo pasa si sigue pendiente: asi dos coordinadores
 * no pisan la respuesta del otro.
 */
export async function resolverSolicitud(datos: {
  idSolicitud: string;
  estado: Exclude<EstadoSolicitud, 'pendiente'>;
  idResolvio: string;
  comentario: string | null;
}): Promise<SolicitudRow | null> {
  const { rows } = await pool.query<SolicitudRow>(
    `update solicitudes_cambio
     set estado = $2,
         comentario = $3,
         id_resolvio = $4,
         resuelto_en = now()
     where id_solicitud = $1 and estado = 'pendiente'
     returning *`,
    [datos.idSolicitud, datos.estado, datos.comentario, datos.idResolvio]
  );
  return rows[0] ?? null;
}
