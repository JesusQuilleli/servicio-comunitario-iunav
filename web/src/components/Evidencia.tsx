"use client";

import { useState } from "react";
import { Download, Eye, EyeOff, FileText, Loader2, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { esImagen, nombreArchivo, useArchivoUrl } from "@/lib/archivos";

/**
 * Muestra la evidencia de un registro.
 *
 * El archivo no se enlaza con `href` a propósito: la ruta necesita el token
 * JWT, que un `<img>` o un `<a>` no pueden mandar. Por eso se pide con axios y
 * se muestra desde un `blob:` URL.
 */
export function Evidencia({
  ruta,
  compacta = false,
}: {
  ruta: string | null;
  compacta?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const { url, cargando } = useArchivoUrl(abierto ? ruta : null);

  if (!ruta) return null;

  const esImagenArchivo = esImagen(ruta);
  const etiqueta = esImagenArchivo ? "Ver evidencia" : "Abrir documento";

  return (
    <div className={compacta ? "mt-2" : "mt-3"}>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setAbierto((v) => !v)}
        >
          {esImagenArchivo ? (
            abierto ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />
          ) : (
            <FileText className="h-3.5 w-3.5" />
          )}
          {abierto ? "Ocultar evidencia" : etiqueta}
        </Button>
        {esImagenArchivo && url && (
          <a
            href={url}
            download={nombreArchivo(ruta)}
            className="inline-flex items-center gap-1 text-xs text-iunav-blue hover:underline"
          >
            <Download className="h-3.5 w-3.5" />
            Descargar
          </a>
        )}
      </div>

      {abierto && (
        <div className="mt-3">
          {cargando && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando evidencia...
            </div>
          )}
          {!cargando && url && esImagenArchivo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="Evidencia de la actividad"
              className="max-h-96 w-auto rounded-lg border border-border"
            />
          )}
          {!cargando && url && !esImagenArchivo && (
            <object
              data={url}
              type="application/pdf"
              className="h-96 w-full rounded-lg border border-border"
            >
              <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                <Paperclip className="h-3.5 w-3.5" />
                Tu navegador no puede mostrar el PDF.
              </div>
            </object>
          )}
          {!cargando && !url && (
            <p className="text-xs text-muted-foreground">
              No se pudo cargar la evidencia: el archivo ya no está en el servidor o no tienes
              permiso para verlo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}