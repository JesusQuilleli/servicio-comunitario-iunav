"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Archivos en disco local, no URLs públicas.
 *
 * Lo que llega del servidor es una ruta relativa (`evidencias/<uuid>.jpg`) y se
 * descarga por `GET /api/archivos/:carpeta/:nombre`, que exige token. Como un
 * `<img src>` no puede mandar la cabecera `Authorization`, la imagen se pide con
 * axios y se muestra desde un `blob:` URL que hay que liberar al desmontar.
 *
 * Los límites y tipos de aquí son una cortesía para el usuario: el servidor los
 * vuelve a comprobar y es él quien manda.
 */

export const MAX_EVIDENCIA_MB = 10;
export const MAX_DOCUMENTO_MB = 25;

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp"];
export const TIPOS_EVIDENCIA = [...TIPOS_IMAGEN, "application/pdf"];

const ETIQUETA_TIPO: Record<string, string> = {
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "application/pdf": "PDF",
};

export function esEvidenciaValida(archivo: File, maxMb = MAX_EVIDENCIA_MB): boolean {
  return TIPOS_EVIDENCIA.includes(archivo.type) && archivo.size <= maxMb * 1024 * 1024;
}

/** Motivo por el que no se admite el archivo, o `null` si vale. */
export function motivoEvidenciaInvalida(archivo: File, maxMb = MAX_EVIDENCIA_MB): string | null {
  if (!TIPOS_EVIDENCIA.includes(archivo.type)) {
    const admitidos = TIPOS_EVIDENCIA.map((t) => ETIQUETA_TIPO[t]).join(", ");
    return `Formato no admitido (${archivo.type || "desconocido"}). Se aceptan: ${admitidos}.`;
  }
  if (archivo.size > maxMb * 1024 * 1024) {
    return `El archivo pesa ${(archivo.size / 1024 / 1024).toFixed(1)} MB y el máximo es ${maxMb} MB.`;
  }
  return null;
}

/** Una ruta del servidor es `carpeta/uuid.ext`. */
export function esRutaArchivo(ruta: string | null | undefined): ruta is string {
  return Boolean(ruta) && /^[a-z]+\/[0-9a-f-]{36}\.[a-z0-9]+$/i.test(ruta as string);
}

export function esImagen(ruta: string | null | undefined): boolean {
  if (!ruta) return false;
  return /\.(jpe?g|png|webp)$/i.test(ruta);
}

/** Nombre del archivo tal como se descargó, sin la carpeta. */
export function nombreArchivo(ruta: string): string {
  return ruta.split("/")[1] ?? ruta;
}

/**
 * Descarga un archivo protegido y devuelve un `blob:` URL listo para `<img src>`
 * o un `<a href>`. Libera el anterior cuando cambia la ruta o al desmontar.
 *
 * El estado guarda la ruta a la que pertenece la URL para poder derivar
 * "cargando" en vez de ponerlo desde el efecto.
 */
export function useArchivoUrl(ruta: string | null): { url: string | null; cargando: boolean } {
  const [descarga, setDescarga] = useState<{ ruta: string | null; url: string | null }>({
    ruta: null,
    url: null,
  });

  useEffect(() => {
    if (!ruta) return;

    let vigente = true;
    let creado: string | null = null;

    api
      .get(`/${ruta}`, { responseType: "blob" })
      .then((res) => {
        if (!vigente) return;
        creado = URL.createObjectURL(res.data as Blob);
        setDescarga({ ruta, url: creado });
      })
      .catch(() => {
        // Sin acceso o ya no existe: la interfaz avisa, no rompe la vista.
        if (vigente) setDescarga({ ruta, url: null });
      });

    return () => {
      vigente = false;
      if (creado) URL.revokeObjectURL(creado);
    };
  }, [ruta]);

  if (!ruta) return { url: null, cargando: false };
  const listo = descarga.ruta === ruta;
  return { url: listo ? descarga.url : null, cargando: !listo };
}