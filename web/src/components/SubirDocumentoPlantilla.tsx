"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Paperclip, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_DOCUMENTO_MB, motivoEvidenciaInvalida } from "@/lib/archivos";
import { api } from "@/lib/api";

/**
 * Adjunta el archivo de una plantilla documental.
 *
 * Es un endpoint aparte del alta y la edicion de la plantilla porque el archivo
 * se sube despues de crearla: al reemplazarlo, el servidor borra el anterior.
 */
export function SubirDocumentoPlantilla({
  idPlantilla,
  onSubido,
  soloBoton = false,
}: {
  idPlantilla: number;
  onSubido: () => void;
  /** Oculta la etiqueta del input cuando la tabla ya muestra que hay archivo. */
  soloBoton?: boolean;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    setExito(null);
    if (!elegido) {
      setArchivo(null);
      return;
    }
    const motivo = motivoEvidenciaInvalida(elegido, MAX_DOCUMENTO_MB);
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
      cuerpo.append("documento", archivo);
      await api.post(`/configuracion/plantillas/${idPlantilla}/documento`, cuerpo);
      setExito("Archivo actualizado.");
      setArchivo(null);
      if (input.current) input.current.value = "";
      onSubido();
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudo subir el archivo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {!soloBoton && (
          <span className="text-xs text-muted-foreground">
            PDF o imagen, hasta {MAX_DOCUMENTO_MB} MB
          </span>
        )}
        <input
          ref={input}
          id={`plantilla-doc-${idPlantilla}`}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={elegir}
          className="block w-full max-w-56 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-foreground hover:file:bg-primary/20"
        />
        {archivo && (
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={enviando} onClick={subir}>
            {enviando ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Upload className="h-3 w-3" />
            )}
            Subir
          </Button>
        )}
      </div>

      {archivo && !enviando && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          {archivo.name}
        </p>
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
          {exito}
        </p>
      )}
    </div>
  );
}