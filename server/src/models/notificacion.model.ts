import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import type { Paginacion } from '../lib/paginacion.js';

/**
 * Bandeja de salida del correo.
 *
 * Es una COLA, no un historial de lo enviado. Encolar es barato y va dentro de
 * la transaccion que provoca el aviso; enviar es lento, depende de un servidor
 * ajeno y va despues, fuera de ella. Esa separacion es lo que hace que un SMTP
 * caido no deshaga el alta de un usuario.
 */

export const TIPOS_NOTIFICACION = [
  'bienvenida',
  'horas_validadas',
  'meta_alcanzada',
  'proyecto_finalizado',
] as const;

export type TipoNotificacion = (typeof TIPOS_NOTIFICACION)[number];

export const ESTADOS_NOTIFICACION = ['pendiente', 'enviada', 'fallida'] as const;

export type EstadoNotificacion = (typeof ESTADOS_NOTIFICACION)[number];

export interface NotificacionNueva {
  idDestinatario: string | null;
  destinatarioEmail: string;
  destinatarioNombre: string;
  tipo: TipoNotificacion;
  asunto: string;
  cuerpo: string;
}

export interface Notificacion extends NotificacionNueva {
  idNotificacion: string;
  estado: EstadoNotificacion;
  intentos: number;
  error: string | null;
  creadoEn: string;
  enviadoEn: string | null;
}

interface NotificacionRow {
  id_notificacion: string;
  id_destinatario: string | null;
  destinatario_email: string;
  destinatario_nombre: string;
  tipo: TipoNotificacion;
  asunto: string;
  cuerpo: string;
  estado: EstadoNotificacion;
  intentos: number;
  error: string | null;
  creado_en: string;
  enviado_en: string | null;
}

function mapNotificacion(r: NotificacionRow): Notificacion {
  return {
    idNotificacion: r.id_notificacion,
    idDestinatario: r.id_destinatario,
    destinatarioEmail: r.destinatario_email,
    destinatarioNombre: r.destinatario_nombre,
    tipo: r.tipo,
    asunto: r.asunto,
    cuerpo: r.cuerpo,
    estado: r.estado,
    intentos: r.intentos,
    error: r.error,
    creadoEn: r.creado_en,
    enviadoEn: r.enviado_en,
  };
}

const COLUMNAS = `id_notificacion, id_destinatario, destinatario_email, destinatario_nombre,
                  tipo, asunto, cuerpo, estado, intentos, error,
                  creado_en::text as creado_en, enviado_en::text as enviado_en`;

/**
 * Mete el aviso en la cola. `cliente` permite encolar dentro de la misma
 * transaccion que la operacion que lo provoca: si esa transaccion se deshace,
 * el aviso desaparece con ella y no se manda un correo sobre algo que no paso.
 */
export async function encolar(
  notificacion: NotificacionNueva,
  cliente?: PoolClient
): Promise<Notificacion> {
  const ejecutor = cliente ?? pool;
  const { rows } = await ejecutor.query<NotificacionRow>(
    `insert into notificaciones
       (id_destinatario, destinatario_email, destinatario_nombre, tipo, asunto, cuerpo)
     values ($1, $2, $3, $4, $5, $6)
     returning ${COLUMNAS}`,
    [
      notificacion.idDestinatario,
      notificacion.destinatarioEmail,
      notificacion.destinatarioNombre,
      notificacion.tipo,
      notificacion.asunto,
      notificacion.cuerpo,
    ]
  );
  return mapNotificacion(rows[0]);
}

export async function marcarEnviada(idNotificacion: string): Promise<void> {
  await pool.query(
    `update notificaciones
     set estado = 'enviada', intentos = intentos + 1, error = null, enviado_en = now()
     where id_notificacion = $1`,
    [idNotificacion]
  );
}

export async function marcarFallida(idNotificacion: string, error: string): Promise<void> {
  await pool.query(
    `update notificaciones
     set estado = 'fallida', intentos = intentos + 1, error = $2
     where id_notificacion = $1`,
    // El texto del error puede ser muy largo (trazas de SMTP): se recorta para
    // que la tabla no crezca sin control.
    [idNotificacion, error.slice(0, 500)]
  );
}

export async function obtenerNotificacion(id: string): Promise<Notificacion> {
  const { rows } = await pool.query<NotificacionRow>(
    `select ${COLUMNAS} from notificaciones where id_notificacion = $1`,
    [id]
  );
  if (!rows[0]) {
    throw new ApiError(404, 'Notificación no encontrada');
  }
  return mapNotificacion(rows[0]);
}

export interface FiltroNotificaciones {
  estado: EstadoNotificacion | null;
  tipo: TipoNotificacion | null;
}

/** Mismo `where` para la pagina y el conteo: si no, `total` no describe la pagina. */
const FILTRO = `
     from notificaciones n
     where ($1::text is null or n.estado = $1)
       and ($2::text is null or n.tipo = $2)`;

export async function listarNotificaciones(
  filtro: FiltroNotificaciones,
  paginacion: Paginacion
): Promise<{ items: Notificacion[]; total: number }> {
  const params = [filtro.estado, filtro.tipo];
  const [datos, cuenta] = await Promise.all([
    pool.query<NotificacionRow>(
      `select n.id_notificacion, n.id_destinatario, n.destinatario_email,
              n.destinatario_nombre, n.tipo, n.asunto, n.cuerpo, n.estado,
              n.intentos, n.error, n.creado_en::text as creado_en,
              n.enviado_en::text as enviado_en
       ${FILTRO}
       order by n.creado_en desc, n.id_notificacion asc
       limit $3 offset $4`,
      [...params, paginacion.porPagina, paginacion.offset]
    ),
    pool.query<{ total: number }>(`select count(*)::int as total ${FILTRO}`, params),
  ]);
  return { items: datos.rows.map(mapNotificacion), total: cuenta.rows[0].total };
}

/** Cuantas hay en cada estado, para el resumen de la pantalla. */
export async function resumenNotificaciones(): Promise<Record<EstadoNotificacion, number>> {
  const { rows } = await pool.query<{ estado: EstadoNotificacion; total: number }>(
    'select estado, count(*)::int as total from notificaciones group by estado'
  );
  const resumen: Record<EstadoNotificacion, number> = { pendiente: 0, enviada: 0, fallida: 0 };
  for (const r of rows) resumen[r.estado] = r.total;
  return resumen;
}

/** Avisos que todavia no han salido, mas antiguos primero. */
export async function pendientesDeEnvio(limite = 50): Promise<Notificacion[]> {
  const { rows } = await pool.query<NotificacionRow>(
    `select ${COLUMNAS} from notificaciones
     where estado <> 'enviada'
     order by creado_en asc
     limit $1`,
    [limite]
  );
  return rows.map(mapNotificacion);
}
