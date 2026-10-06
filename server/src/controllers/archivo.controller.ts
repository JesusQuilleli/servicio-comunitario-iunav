import fs from 'node:fs';
import type { NextFunction, Response } from 'express';
import { esCategoria } from '../config/almacenamiento.js';
import { ApiError } from '../lib/errors.js';
import { absolutaDe, esRutaInterna } from '../lib/archivos.js';
import * as archivoModel from '../models/archivo.model.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * `GET /api/archivos/:carpeta/:nombre`
 *
 * La unica forma de descargar un archivo. Exige token y comprueba el derecho de
 * acceso antes de tocar el disco, asi que la carpeta de subidas nunca se sirve
 * como estatico y no se puede(listar ni adivinar contenido ajeno.
 */
export async function descargarArchivo(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuario = req.usuario;
    if (!usuario) {
      throw new ApiError(401, 'No autenticado');
    }

    const { carpeta, nombre } = req.params as { carpeta: string; nombre: string };
    if (!esCategoria(carpeta)) {
      throw new ApiError(404, 'Archivo no encontrado');
    }

    // `esRutaInterna` aplica el mismo patron estricto que usa el que escribe,
    // de modo que aqui no hay forma de colar `..`, `/` ni un nombre inventado.
    const ruta = `${carpeta}/${nombre}`;
    if (!esRutaInterna(ruta)) {
      throw new ApiError(404, 'Archivo no encontrado');
    }

    const decision = await archivoModel.decidirAcceso({
      rol: usuario.rol,
      idUsuario: usuario.idUsuario,
      ruta,
      categoria: carpeta,
    });
    if (!decision.permitido) {
      throw new ApiError(decision.status, decision.mensaje);
    }

    const absoluta = absolutaDe(ruta);
    let contenido: Buffer;
    try {
      contenido = await fs.promises.readFile(absoluta);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // La fila apunta a un archivo que ya no esta: no es un error del cliente.
        throw new ApiError(404, 'Archivo no encontrado');
      }
      throw err;
    }

    res.setHeader('Content-Type', contentTypeDe(ruta));
    res.setHeader('Content-Length', contenido.length);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(contenido);
  } catch (err) {
    next(err);
  }
}

const TIPOS: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
};

function contentTypeDe(ruta: string): string {
  const corte = ruta.lastIndexOf('.');
  return TIPOS[ruta.slice(corte).toLowerCase()] ?? 'application/octet-stream';
}