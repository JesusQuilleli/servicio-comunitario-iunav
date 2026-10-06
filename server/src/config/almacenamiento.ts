import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './env.js';

/**
 * Configuracion del almacenamiento de archivos en disco.
 *
 * Decisiones ya tomadas (no reabrir):
 * - Disco local. El despliegue es un servidor del IUNAV con disco persistente,
 *   asi que no hay bucket externo que montar.
 * - Lo que se guarda en la columna `*_url` NO es una URL publica sino una ruta
 *   relativa con la forma `<carpeta>/<uuid>.<ext>`. Ver `src/lib/archivos.ts`.
 * - Los archivos se sirven por `GET /api/archivos/:carpeta/:nombre`, que exige
 *   token y comprueba que quien pregunta tiene derecho a verlos.
 */

/** Raiz de `server/`. `src/config/almacenamiento.ts` -> src/config -> src -> server. */
export const RAIZ_SERVIDOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Carpeta raiz donde se escriben los archivos. Configurable con `UPLOAD_DIR`. */
export const CARPETA_ARCHIVOS = path.resolve(RAIZ_SERVIDOR, env.uploadDir);

/**
 * Carpetas reconocidas. Es una lista blanca y no una carpeta arbitraria del
 * valor que llegue en la URL: sin esta comprobacion, un `../` en la URL abriria
 * archivos de fuera de la carpeta de subidas.
 */
export const CATEGORIAS = ['evidencias', 'proyectos', 'firmas', 'sellos', 'plantillas'] as const;

export type CategoriaArchivo = (typeof CATEGORIAS)[number];

/**
 * MIME aceptados y la extension con la que se guardan. La extension la decide
 * el servidor a partir del MIME declarado, nunca el nombre que envia el cliente.
 */
export const TIPOS_PERMITIDOS: Readonly<Record<string, string>> = Object.freeze({
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
});

/** Cuantos MB admite cada categoría. */
export function limiteMb(categoria: CategoriaArchivo): number {
  return categoria === 'evidencias' ? env.maxEvidenciaMb : env.maxDocumentoMb;
}

/**
 * La firma y el sello son imagenes por definicion: no tienen sentido como PDF ni
 * como cualquier otro formato. El resto de categorias aceptan la lista completa.
 */
const SOLO_IMAGENES: ReadonlySet<string> = new Set(['firmas', 'sellos']);

export function mimePermitido(categoria: CategoriaArchivo, mime: string): boolean {
  if (!(mime in TIPOS_PERMITIDOS)) return false;
  return !SOLO_IMAGENES.has(categoria) || mime !== 'application/pdf';
}

/** Lista de MIME admitidos en una categoria, para los mensajes de error. */
export function mimesDe(categoria: CategoriaArchivo): string {
  const lista = Object.keys(TIPOS_PERMITIDOS).filter((m) => mimePermitido(categoria, m));
  return lista.join(', ');
}

export function esCategoria(valor: string): valor is CategoriaArchivo {
  return (CATEGORIAS as readonly string[]).includes(valor);
}