import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  CARPETA_ARCHIVOS,
  TIPOS_PERMITIDOS,
  esCategoria,
  mimePermitido,
  mimesDe,
  type CategoriaArchivo,
} from '../config/almacenamiento.js';
import { ApiError } from './errors.js';

/**
 * Lo que se guarda en las columnas `*_url`:
 *
 *   "evidencias/9f1c...-....-....jpg"
 *
 * No es una URL. El nombre lo genera el servidor con `randomUUID()` y una
 * extension derivada del MIME declarado, de modo que el nombre que envie el
 * cliente nunca toca el disco. Un archivo antiguo o importado desde el seed
 * puede contener una URL externa (`https://...`); `esRutaInterna` la distingue
 * para que cada vista la muestre como enlace y nunca intente servirla.
 */

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXTENSION = /^\.[a-z0-9]{2,5}$/i;

export interface ArchivoRecibido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface ArchivoGuardado {
  /** Valor para la columna: `<carpeta>/<uuid><ext>`. */
  ruta: string;
  carpeta: CategoriaArchivo;
  nombre: string;
  mime: string;
  bytes: number;
}

/** Comprobacion de forma. No dice nada sobre permisos: eso lo decide el modelo. */
export function esRutaInterna(valor: string | null | undefined): valor is string {
  if (!valor) return false;
  const partes = valor.split('/');
  if (partes.length !== 2) return false;
  const [carpeta, nombre] = partes as [string, string];
  return esCategoria(carpeta) && PATRON_NOMBRE.test(nombre);
}

/** Un UUID v4 con extension. El nombre lo genera el servidor, nunca el cliente. */
const PATRON_NOMBRE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.[a-z0-9]{2,5}$/i;
const PATRON_EXTENSION = /^\.[a-z0-9]{2,5}$/i;

function comprobarNombre(nombre: string): void {
  const corte = nombre.lastIndexOf('.');
  const sinExtension = nombre.slice(0, corte);
  const extension = nombre.slice(corte);
  if (corte <= 0 || !PATRON_EXTENSION.test(extension)) {
    throw new ApiError(400, 'Nombre de archivo no valido');
  }
  if (!UUID_V4.test(sinExtension)) {
    throw new ApiError(400, 'Nombre de archivo no valido');
  }
}

/** Ruta absoluta en disco, garantindo que no se sale de la carpeta de subidas. */
export function rutaAbsoluta(carpeta: string, nombre: string): string {
  if (!esCategoria(carpeta)) {
    throw new ApiError(400, 'Carpeta de archivo no valida');
  }
  if (nombre.includes('/') || nombre.includes('\\') || nombre.includes('\0')) {
    throw new ApiError(400, 'Nombre de archivo no valido');
  }
  comprobarNombre(nombre);

  const absoluta = path.resolve(CARPETA_ARCHIVOS, carpeta, nombre);
  const raiz = path.resolve(CARPETA_ARCHIVOS) + path.sep;
  if (!absoluta.startsWith(raiz)) {
    // Red de seguridad: con la validacion anterior no deberia ser alcanzable.
    throw new ApiError(400, 'Ruta de archivo no valida');
  }
  return absoluta;
}

/** Escribe el archivo en disco. Lanza ApiError si el MIME no esta permitido. */
export async function guardarArchivo(
  categoria: CategoriaArchivo,
  archivo: ArchivoRecibido
): Promise<ArchivoGuardado> {
  const extension = TIPOS_PERMITIDOS[archivo.mimetype];
  if (!extension) {
    throw new ApiError(
      400,
      `Tipo de archivo no permitido: ${archivo.mimetype}. Se aceptan imagenes (jpg, png, webp) y PDF.`
    );
  }
  if (!mimePermitido(categoria, archivo.mimetype)) {
    throw new ApiError(
      400,
      `En "${categoria}" solo se admiten imagenes. Se aceptan: ${mimesDe(categoria)}.`
    );
  }

  const nombre = `${crypto.randomUUID()}${extension}`;
  const destino = rutaAbsoluta(categoria, nombre);
  await fs.mkdir(path.dirname(destino), { recursive: true });
  await fs.writeFile(destino, archivo.buffer, { flag: 'wx' });

  return {
    ruta: `${categoria}/${nombre}`,
    carpeta: categoria,
    nombre,
    mime: archivo.mimetype,
    bytes: archivo.size,
  };
}

/** Borra un archivo. Silencioso si ya no existe: nunca es un error fatal. */
export async function borrarArchivo(ruta: string | null | undefined): Promise<void> {
  if (!esRutaInterna(ruta)) return;
  const [carpeta, nombre] = ruta.split('/') as [string, string];
  try {
    await fs.unlink(rutaAbsoluta(carpeta, nombre));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`No se pudo borrar el archivo ${ruta}:`, err);
    }
  }
}

/** Ruta absoluta de un valor ya validado con `esRutaInterna`. */
export function absolutaDe(ruta: string): string {
  const [carpeta, nombre] = ruta.split('/') as [string, string];
  return rutaAbsoluta(carpeta, nombre);
}