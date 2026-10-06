"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Loader2, Paperclip, TriangleAlert, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_DOCUMENTO_MB, motivoEvidenciaInvalida } from "@/lib/archivos";
import { api } from "@/lib/api";

/**
 * Sube el proyecto escrito y/o las diapositivas de un grupo.
 *
 * Cada archivo va en su propio campo del mismo `FormData`: el servidor acepta
 * uno o los dos y guarda solo los que llegan. Al reemplazar uno, se borra el
 * anterior en el servidor.
 */
export function SubirDocumentosGrupo({
  idGrupo,
  onSubido,
}: {
  idGrupo: string;
  onSubido: () => void;
}) {
  const [escrito, setEscrito] = useState<File | null>(null);
  const [diapositivas, setDiapositivas] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const inputs = useRef<{ escrito?: HTMLInputElement; diapositivas?: HTMLInputElement }>({});

  function elegir(que: "escrito" | "diapositivas", archivo: File | null) {
    setExito(null);
    if (!archivo) {
      if (que === "escrito") setEscrito(null);
      else setDiapositivas(null);
      return;
    }
    // Los documentos del proyecto no admiten imagenes: son PDF.
    const motivo =
      archivo.type === "application/pdf"
        ? motivoEvidenciaInvalida(archivo, MAX_DOCUMENTO_MB)
        : "El documento debe ser un PDF.";
    if (motivo) {
      setError(motivo);
      const input = inputs.current[que];
      if (input) input.value = "";
      if (que === "escrito") setEscrito(null);
      else setDiapositivas(null);
      return;
    }
    setError(null);
    if (que === "escrito") setEscrito(archivo);
    else setDiapositivas(archivo);
  }

  async function subir() {
    if (!escrito && !diapositivas) {
      setError("Selecciona al menos un archivo.");
      return;
    }
    setError(null);
    setEnviando(true);
    try {
      const cuerpo = new FormData();
      if (escrito) cuerpo.append("proyectoEscrito", escrito);
      if (diapositivas) cuerpo.append("diapositivas", diapositivas);

      await api.post(`/grupos/${idGrupo}/documentos`, cuerpo);
      setExito("Documentos actualizados.");
      setEscrito(null);
      setDiapositivas(null);
      if (inputs.current.escrito) inputs.current.escrito.value = "";
      if (inputs.current.diapositivas) inputs.current.diapositivas.value = "";
      onSubido();
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudieron subir los documentos.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-3 space-y-2">
      <p className="text-xs text-muted-foreground">
        PDF de hasta {MAX_DOCUMENTO_MB} MB. Subir un archivo de nuevo reemplaza al anterior.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Campo
          id="proyecto-escrito"
          etiqueta="Proyecto escrito"
          seleccionado={escrito}
          onChange={(f) => elegir("escrito", f)}
          inputRef={(el) => {
            inputs.current.escrito = el ?? undefined;
          }}
        />
        <Campo
          id="diapositivas"
          etiqueta="Diapositivas"
          seleccionado={diapositivas}
          onChange={(f) => elegir("diapositivas", f)}
          inputRef={(el) => {
            inputs.current.diapositivas = el ?? undefined;
          }}
        />
      </div>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-red-600">
          <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </p>
      )}
      {exito && (
        <p className="flex items-start gap-1.5 text-xs text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {exito}
        </p>
      )}

      <Button type="button" size="sm" disabled={enviando} onClick={subir}>
        {enviando ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Subiendo...
          </>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5" />
            Subir documentos
          </>
        )}
      </Button>
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  seleccionado,
  onChange,
  inputRef,
}: {
  id: string;
  etiqueta: string;
  seleccionado: File | null;
  onChange: (archivo: File | null) => void;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-medium text-foreground">
        {etiqueta}
      </label>
      <input
        id={id}
        type="file"
        accept="application/pdf"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        ref={inputRef}
        className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-primary/20"
      />
      {seleccionado && (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Paperclip className="h-3 w-3" />
          {seleccionado.name}
        </p>
      )}
    </div>
  );
}