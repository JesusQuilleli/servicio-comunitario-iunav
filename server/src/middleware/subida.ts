import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { limiteMb, type CategoriaArchivo } from '../config/almacenamiento.js';
import { ApiError } from '../lib/errors.js';

/**
 * Subida de archivos con `multer`.
 *
 * Tres decisiones importantes:
 *
 * 1. `memoryStorage`, no `diskStorage`. Asi el archivo se valida (MIME) ANTES
 *    de escribir nada en disco; si el tipo no esta permitido, no queda ningun
 *    archivo huerfano en el servidor.
 *
 * 2. El limite de tamano lo aplica `multer`. `express.json()` NO hay que
 *    tocarlo: nunca ve el archivo, que viaja como `multipart/form-data`. El
 *    limite de JSON sigue sirviendo para el resto de endpoints.
 *
 * 3. La validacion de MIME vive en `src/lib/archivos.ts` (`guardarArchivo`), no
 *    en un `fileFilter` de multer. Asi el mensaje de error sale por el mismo
 *    camino que todos los demas (`ApiError`) y hay un solo sitio que decide que
 *    extensiones se aceptan.
 */

export interface ArchivoSubido {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

function manillar(next: NextFunction, err?: unknown): void {
  if (!err) {
    next();
    return;
  }
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const limite = (err as multer.MulterError & { limit?: number }).limit ?? 0;
      next(
        new ApiError(413, `El archivo supera el tamano maximo permitido (${Math.round(limite / 1024 / 1024)} MB)`)
      );
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      next(
        new ApiError(
          400,
          `Campo de archivo inesperado: "${err.field}". Revisa el formulario que lo envia.`
        )
      );
      return;
    }
    next(new ApiError(400, `No se pudo leer el archivo: ${err.message}`));
    return;
  }
  next(err);
}

function aArchivoSubido(archivo: Express.Multer.File): ArchivoSubido {
  return {
    originalname: archivo.originalname,
    mimetype: archivo.mimetype,
    size: archivo.size,
    buffer: archivo.buffer,
  };
}

/** Middleware para un unico archivo en el campo indicado. */
export function subirArchivo(categoria: CategoriaArchivo, campo: string) {
  const instancia = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limiteMb(categoria) * 1024 * 1024, files: 1 },
  }).single(campo);

  return (req: Request, res: Response, next: NextFunction) => {
    instancia(req, res, (err) => manillar(next, err));
  };
}

/** Middleware para varios archivos, cada uno en su propio campo. */
export function subirArchivos(categoria: CategoriaArchivo, campos: string[]) {
  const instancia = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: limiteMb(categoria) * 1024 * 1024, files: campos.length },
  }).fields(campos.map((nombre) => ({ name: nombre, maxCount: 1 })));

  return (req: Request, res: Response, next: NextFunction) => {
    instancia(req, res, (err) => manillar(next, err));
  };
}

/** Archivo del campo pedido, o `null` si no se envio. Para `subirArchivo`. */
export function archivoDe(req: Request, campo: string): ArchivoSubido | null {
  const archivo = req.file;
  if (!archivo || archivo.fieldname !== campo) return null;
  return aArchivoSubido(archivo);
}

/** Archivo del campo pedido, o `null` si no se envio. Para `subirArchivos`. */
export function archivoDeCampo(req: Request, campo: string): ArchivoSubido | null {
  const archivos = req.files as Record<string, Express.Multer.File[]> | undefined;
  const archivo = archivos?.[campo]?.[0];
  return archivo ? aArchivoSubido(archivo) : null;
}