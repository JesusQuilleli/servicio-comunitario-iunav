/**
 * Lo que comparten el generador de datos de carga y la prueba que los usa.
 *
 * Vive aparte para que importar una constante no ejecute el generador: los
 * scripts de este proyecto corren su `main()` al cargarse, asi que
 * `import { PASSWORD_CARGA } from './datos-carga.js'` borraba y recreaba la
 * base justo antes de medirla.
 */

/** Sufijo obligatorio de la base de carga. Es la guardia contra pisar la real. */
export const SUFIJO_CARGA = '_carga';

/** Clave unica de todas las cuentas generadas. La base es desechable. */
export const PASSWORD_CARGA = 'carga1234';

/**
 * URL de la base de carga, derivada de `DATABASE_URL`.
 *
 * Nunca devuelve la base de desarrollo: el nombre siempre termina en
 * `_carga`, y si por lo que sea no lo hiciera, aborta.
 */
export function urlDeCarga(): { url: URL; nombre: string } {
  const principal = process.env.DATABASE_URL;
  if (!principal) {
    throw new Error('Falta DATABASE_URL (server/.env)');
  }
  const url = new URL(principal);
  const nombre = `${url.pathname.slice(1).replace(/_carga$/, '')}${SUFIJO_CARGA}`;
  if (!nombre.endsWith(SUFIJO_CARGA)) {
    throw new Error(`Me niego a usar "${nombre}": el nombre debe terminar en ${SUFIJO_CARGA}`);
  }
  url.pathname = `/${nombre}`;
  url.search = '';
  return { url, nombre };
}
