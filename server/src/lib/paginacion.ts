import { z } from 'zod';

/**
 * Paginacion de los listados (`?pagina=` y `?porPagina=`).
 *
 * Vive en `lib/` porque es logica pura y la comparten cuatro controladores
 * (usuarios, grupos, mis bitacoras y pendientes del tutor): una sola definicion
 * de "que es una pagina valida" evita que se desincronicen los topes.
 */
export const PAGINA_DEFECTO = 1;
export const POR_PAGINA_DEFECTO = 20;
export const POR_PAGINA_TOPE = 100;

/** Entero positivo. `z.coerce` tolera el texto que siempre llega por query string. */
const enteroPositivo = z.coerce
  .number()
  .int('Debe ser un número entero')
  .min(1, 'Debe ser mayor o igual a 1');

const paginacionSchema = z.object({
  // Un parametro vacio (`?pagina=`) se trata como ausente, igual que los
  // filtros de grupos. Un texto no numerico no cae aqui: `z.coerce.number()`
  // lo convierte en NaN y `enteroPositivo` lo rechaza con 400.
  pagina: z.preprocess((v) => (v === '' || v === null ? undefined : v), enteroPositivo.optional()),
  porPagina: z.preprocess((v) => (v === '' || v === null ? undefined : v), enteroPositivo.optional()),
});

export interface Paginacion {
  pagina: number;
  porPagina: number;
  /** Desplazamiento listo para el `offset` de SQL. */
  offset: number;
}

/**
 * Lee la paginacion de la query string.
 *
 * Los valores invalidos (0, negativos, decimales, no numericos) los rechaza
 * Zod con el 400 de "Datos invalidos" del proyecto. `porPagina` por encima del
 * tope se recorta en vez de rechazarse: pedir 500 devuelve 100, no un error.
 */
export function leerPaginacion(query: unknown): Paginacion {
  const { pagina: paginaCruda, porPagina: porPaginaCruda } = paginacionSchema.parse(query);
  const pagina = paginaCruda ?? PAGINA_DEFECTO;
  const porPagina = Math.min(porPaginaCruda ?? POR_PAGINA_DEFECTO, POR_PAGINA_TOPE);
  return { pagina, porPagina, offset: (pagina - 1) * porPagina };
}

/**
 * Cuerpo de un listado paginado.
 *
 * `items` es la pagina pedida (puede venir vacia si la pagina se sale del
 * rango, sin ser 404). Las claves heredadas (`usuarios`, `grupos`, ...) las
 * agrega cada controlador para no romper a los consumidores actuales.
 */
export function respuestaPaginada<T>(
  items: T[],
  total: number,
  paginacion: Paginacion
): { items: T[]; total: number; pagina: number; porPagina: number } {
  return { items, total, pagina: paginacion.pagina, porPagina: paginacion.porPagina };
}
