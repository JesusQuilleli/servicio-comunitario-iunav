"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, PenLine, Stamp, TriangleAlert } from "lucide-react";
import { MAX_EVIDENCIA_MB, motivoEvidenciaInvalida, useArchivoUrl } from "@/lib/archivos";
import { api } from "@/lib/api";

/**
 * Firma (y, para el admin, sello) de una cuenta.
 *
 * El sello solo lo sube la administracion y jamas se reparte en la API: por eso
 * `tipo: "sello"` se limita a quien ya tiene ese rol. Ambos endpoints aceptan
 * un unico campo `archivo` y reemplazan el anterior.
 */
export function FirmaSello({
  idUsuario,
  tipo,
  rutaActual,
  puedeSubir,
  alCambiar,
}: {
  idUsuario: string;
  tipo: "firma" | "sello";
  rutaActual: string | null;
  puedeSubir: boolean;
  alCambiar: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  // Solo se descarga la imagen cuando hay una: son imagenes pequenas y el token
  // va en la cabecera, no en la URL.
  const { url, cargando } = useArchivoUrl(rutaActual);

  const esSello = tipo === "sello";

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    setExito(false);
    if (!elegido) {
      setArchivo(null);
      return;
    }
    const motivo = motivoEvidenciaInvalida(elegido, MAX_EVIDENCIA_MB);
    if (motivo) {
      setArchivo(null);
      setError(motivo);
      if (input.current) input.current.value = "";
      return;
    }
    setError(null);
    setArchivo(elegido);
  }

  async function subir() {
    if (!archivo) return;
    setEnviando(true);
    setError(null);
    try {
      const cuerpo = new FormData();
      cuerpo.append("archivo", archivo);
      await api.post(`/usuarios/${idUsuario}/${esSello ? "sello" : "firma"}`, cuerpo);
      setArchivo(null);
      setExito(true);
      if (input.current) input.current.value = "";
      alCambiar();
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudo subir la imagen.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {esSello ? (
          <Stamp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <PenLine className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-xs font-medium">{esSello ? "Sello" : "Firma"}</span>
      </div>

      {cargando ? (
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
      ) : url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={esSello ? "Sello" : "Firma"}
          className="h-12 w-auto max-w-32 rounded border border-border bg-white object-contain"
        />
      ) : (
        <p className="text-xs text-muted-foreground">{rutaActual ? "Sin acceso al archivo" : "No cargada"}</p>
      )}

      {puedeSubir && (
        <div className="flex flex-col gap-1.5">
          <input
            ref={input}
            id={`${tipo}-${idUsuario}`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={elegir}
            className="block w-full max-w-44 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-primary/20"
          />
          {archivo && (
            <button
              type="button"
              disabled={enviando}
              onClick={subir}
              className="self-start inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs font-medium hover:bg-muted disabled:opacity-60"
            >
              {enviando ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Subir
            </button>
          )}
        </div>
      )}

      {error && (
        <p className="flex items-start gap-1 text-xs text-red-600">
          <TriangleAlert className="h-3 w-3 mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {exito && (
        <p className="flex items-center gap-1 text-xs text-emerald-700">
          <CheckCircle2 className="h-3 w-3" />
          Guardado.
        </p>
      )}
    </div>
  );
}