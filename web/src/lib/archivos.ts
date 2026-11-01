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
/**
 * La firma y el sello son imágenes por definición: el servidor rechaza el PDF
 * en esas dos categorías (`server/src/config/almacenamiento.ts`).
 */
export const TIPOS_SOLO_IMAGEN = TIPOS_IMAGEN;

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
export function motivoEvidenciaInvalida(
  archivo: File,
  maxMb = MAX_EVIDENCIA_MB,
  tipos: string[] = TIPOS_EVIDENCIA
): string | null {
  if (!tipos.includes(archivo.type)) {
    const admitidos = tipos.map((t) => ETIQUETA_TIPO[t] ?? t).join(", ");
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
 * Por qué no hay imagen que mostrar. Sirve para que la interfaz diga la verdad
 * en vez de echarle siempre la culpa a los permisos.
 */
export type EstadoArchivo =
  | "vacio"
  | "cargando"
  | "listo"
  | "externa"
  | "ausente"
  | "denegado"
  | "error";

/**
 * Descarga un archivo protegido y devuelve un `blob:` URL listo para `<img src>`
 * o un `<a href>`. Libera el anterior cuando cambia la ruta o al desmontar.
 *
 * El estado guarda la ruta a la que pertenece la URL para poder derivar
 * "cargando" en vez de ponerlo desde el efecto.
 */
export function useArchivoUrl(ruta: string | null): {
  url: string | null;
  cargando: boolean;
  estado: EstadoArchivo;
} {
  const [descarga, setDescarga] = useState<{
    ruta: string | null;
    url: string | null;
    estado: EstadoArchivo;
  }>({ ruta: null, url: null, estado: "vacio" });

  // Una ruta que no tiene la forma `carpeta/uuid.ext` no la sirve esta API: son
  // los datos de ejemplo antiguos, que guardaban una URL externa. Pedirla sería
  // un 404 garantizado.
  const interna = esRutaArchivo(ruta);

  useEffect(() => {
    if (!ruta || !interna) return;

    let vigente = true;
    let creado: string | null = null;

    api
      .get(`/archivos/${ruta}`, { responseType: "blob" })
      .then((res) => {
        if (!vigente) return;
        creado = URL.createObjectURL(res.data as Blob);
        setDescarga({ ruta, url: creado, estado: "listo" });
      })
      .catch((err: unknown) => {
        if (!vigente) return;
        const status = (err as { response?: { status?: number } })?.response?.status;
        const estado: EstadoArchivo =
          status === 404 ? "ausente" : status === 403 ? "denegado" : "error";
        setDescarga({ ruta, url: null, estado });
      });

    return () => {
      vigente = false;
      if (creado) URL.revokeObjectURL(creado);
    };
  }, [ruta, interna]);

  if (!ruta) return { url: null, cargando: false, estado: "vacio" };
  if (!interna) return { url: null, cargando: false, estado: "externa" };

  const listo = descarga.ruta === ruta;
  if (!listo) return { url: null, cargando: true, estado: "cargando" };
  return { url: descarga.url, cargando: false, estado: descarga.estado };
}

/** Frase para el usuario cuando no hay imagen que mostrar. */
export function mensajeEstadoArchivo(estado: EstadoArchivo): string | null {
  switch (estado) {
    case "externa":
      return "El archivo no está guardado en el sistema.";
    case "ausente":
      return "El archivo ya no está en el servidor.";
    case "denegado":
      return "No tienes permiso para ver este archivo.";
    case "error":
      return "No se pudo cargar el archivo.";
    default:
      return null;
  }
}
