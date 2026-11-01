import { pool } from '../db/pool.js';
import type { Paginacion } from '../lib/paginacion.js';

/**
 * Historial de acciones administrativas y de configuracion.
 *
 * Es una bitacora de solo-anexado: nada la edita ni la borra. Por eso el modelo
 * expone unicamente `registrar` y `listarHistorial`.
 */

export const ENTIDADES = [
  'configuracion',
  'usuario',
  'grupo',
  'periodo',
  'plantilla',
  'solicitud',
] as const;

export type EntidadHistorial = (typeof ENTIDADES)[number];

export function esEntidad(valor: string): valor is EntidadHistorial {
  return (ENTIDADES as readonly string[]).includes(valor);
}

export interface EventoNuevo {
  idActor: string | null;
  actorNombre: string;
  actorRol: string;
  accion: string;
  entidad: EntidadHistorial;
  idEntidad?: string | null;
  descripcion: string;
  datos?: Record<string, unknown> | null;
}

export interface EventoHistorial {
  idEvento: string;
  idActor: string | null;
  actorNombre: string;
  actorRol: string;
  accion: string;
  entidad: EntidadHistorial;
  idEntidad: string | null;
  descripcion: string;
  datos: Record<string, unknown> | null;
  creadoEn: string;
}

interface EventoRow {
  id_evento: string;
  id_actor: string | null;
  actor_nombre: string;
  actor_rol: string;
  accion: string;
  entidad: EntidadHistorial;
  id_entidad: string | null;
  descripcion: string;
  datos: Record<string, unknown> | null;
  creado_en: string;
}

function mapEvento(r: EventoRow): EventoHistorial {
  return {
    idEvento: r.id_evento,
    idActor: r.id_actor,
    actorNombre: r.actor_nombre,
    actorRol: r.actor_rol,
    accion: r.accion,
    entidad: r.entidad,
    idEntidad: r.id_entidad,
    descripcion: r.descripcion,
    datos: r.datos,
    creadoEn: r.creado_en,
  };
}

export async function registrar(evento: EventoNuevo): Promise<void> {
  await pool.query(
    `insert into historial_acciones
       (id_actor, actor_nombre, actor_rol, accion, entidad, id_entidad, descripcion, datos)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      evento.idActor,
      evento.actorNombre,
      evento.actorRol,
      evento.accion,
      evento.entidad,
      evento.idEntidad ?? null,
      evento.descripcion,
      evento.datos ? JSON.stringify(evento.datos) : null,
    ]
  );
}

export interface FiltroHistorial {
  entidad: EntidadHistorial | null;
  accion: string | null;
  idActor: string | null;
  desde: string | null;
  hasta: string | null;
  texto: string | null;
}

/**
 * El `WHERE` se comparte entre la pagina y el conteo: si se escribieran dos
 * veces, el `total` acabaria contando algo distinto de lo que se muestra.
 *
 * `hasta` se compara contra el dia siguiente porque `creado_en` es un
 * `timestamptz`: `creado_en <= '2026-10-25'` dejaria fuera todo lo de ese dia
 * a partir de las 00:00:01.
 */
const FILTRO_HISTORIAL = `
     from historial_acciones h
     where ($1::text is null or h.entidad = $1)
       and ($2::text is null or h.accion = $2)
       and ($3::uuid is null or h.id_actor = $3)
       and ($4::date is null or h.creado_en >= $4::date)
       and ($5::date is null or h.creado_en < ($5::date + interval '1 day'))
       and ($6::text is null
            or h.descripcion ilike '%' || $6 || '%'
            or h.actor_nombre ilike '%' || $6 || '%')`;

export async function listarHistorial(
  filtro: FiltroHistorial,
  paginacion: Paginacion
): Promise<{ items: EventoHistorial[]; total: number }> {
  const params = [filtro.entidad, filtro.accion, filtro.idActor, filtro.desde, filtro.hasta, filtro.texto];

  const [datos, cuenta] = await Promise.all([
    pool.query<EventoRow>(
      `select h.id_evento, h.id_actor, h.actor_nombre, h.actor_rol, h.accion,
              h.entidad, h.id_entidad, h.descripcion, h.datos, h.creado_en::text as creado_en
       ${FILTRO_HISTORIAL}
       -- id_evento desempata creado_en: sin un orden total, dos filas de la
       -- misma milesima podrian repetirse o desaparecer al cambiar de pagina.
       order by h.creado_en desc, h.id_evento asc
       limit $7 offset $8`,
      [...params, paginacion.porPagina, paginacion.offset]
    ),
    pool.query<{ total: number }>(`select count(*)::int as total ${FILTRO_HISTORIAL}`, params),
  ]);

  return { items: datos.rows.map(mapEvento), total: cuenta.rows[0].total };
}

/** Acciones distintas ya registradas, para poblar el filtro de la interfaz. */
export async function listarAcciones(): Promise<string[]> {
  const { rows } = await pool.query<{ accion: string }>(
    'select distinct accion from historial_acciones order by accion asc'
  );
  return rows.map((r) => r.accion);
}
