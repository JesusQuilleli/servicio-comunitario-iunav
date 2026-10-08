"use client";

import { useRef, useState } from "react";
import { Upload, Loader2, FileDown, Check, Copy, Plus, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { mensajeDeError } from "@/lib/reportes";
import type { ResultadoImportacion } from "@/lib/types";

/**
 * Carga masiva de estudiantes desde una plantilla .xlsx.
 *
 * La plantilla se descarga desde el servidor (trae la estructura + instrucciones)
 * y la clave inicial de cada cuenta nueva es la cédula, con cambio obligatorio
 * en el primer ingreso. Las claves generadas se muestran una sola vez.
 */
export function CargaMasivaEstudiantes({ onImportado }: { onImportado: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [copiadaPorEmail, setCopiadaPorEmail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function abrir() {
    setArchivo(null);
    setError(null);
    setResultado(null);
    setCopiadaPorEmail(null);
    setAbierto(true);
  }

  async function descargarPlantilla() {
    setError(null);
    try {
      const res = await api.get("/usuarios/plantilla.xlsx", { responseType: "blob" });
      const disposicion = res.headers["content-disposition"] as string | undefined;
      const conNombre = /filename="([^"]+)"/.exec(disposicion ?? "");
      const nombre = conNombre?.[1] ?? "plantilla-estudiantes.xlsx";

      const url = URL.createObjectURL(res.data as Blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: unknown) {
      setError(await mensajeDeError(err, "No se pudo descargar la plantilla."));
    }
  }

  async function importar() {
    if (!archivo) return;
    setOcupado(true);
    setError(null);
    setResultado(null);
    try {
      const datos = new FormData();
      datos.append("archivo", archivo);
      const { data } = await api.post<ResultadoImportacion>("/usuarios/importar", datos);
      setResultado(data);
      onImportado();
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudo importar la plantilla.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiarClave(email: string, clave: string) {
    try {
      await navigator.clipboard.writeText(clave);
      setCopiadaPorEmail(email);
    } catch {
      // Sin permiso de portapapeles: la clave queda visible para copiarla a mano.
      setError("No se pudo copiar. Cópiala manualmente.");
    }
  }

  const conErrores = resultado ? resultado.errores.length > 0 : false;

  return (
    <>
      <Button size="sm" className="gap-1.5" onClick={abrir}>
        <Plus className="h-4 w-4" />
        Carga masiva
      </Button>

      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent className="max-w-2xl">
          {resultado ? (
            <>
              <DialogHeader>
                <DialogTitle>Resultado de la carga</DialogTitle>
                <DialogDescription>
                  Se importaron {resultado.creados}{" "}
                  {resultado.creados === 1 ? "estudiante" : "estudiantes"} (
                  {resultado.asignados} a un proyecto) y hubo {resultado.errores.length}{" "}
                  {resultado.errores.length === 1 ? "fila con errores" : "filas con errores"}.
                </DialogDescription>
              </DialogHeader>

              {resultado.claves.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm">
                    Claves iniciales entregadas a los nuevos estudiantes. Cada uno deberá
                    cambiarlas al entrar por primera vez:
                  </p>
                  <div className="max-h-56 overflow-y-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                          <th className="px-3 py-2">Correo</th>
                          <th className="px-3 py-2">Clave inicial</th>
                          <th className="px-3 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.claves.map((c) => (
                          <tr key={c.email} className="border-b last:border-0">
                            <td className="px-3 py-2">{c.email}</td>
                            <td className="px-3 py-2 font-mono text-xs">{c.claveInicial}</td>
                            <td className="px-3 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-xs"
                                onClick={() => copiarClave(c.email, c.claveInicial)}
                              >
                                {copiadaPorEmail === c.email ? (
                                  <Check className="h-3.5 w-3.5" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                                {copiadaPorEmail === c.email ? "Copiada" : "Copiar"}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {conErrores && (
                <div className="space-y-2">
                  <p className="text-sm">Estas filas no se importaron; corregilas y repetí la carga:</p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-amber-200 bg-amber-50">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-xs uppercase text-amber-800">
                          <th className="px-3 py-2">Fila</th>
                          <th className="px-3 py-2">Campo</th>
                          <th className="px-3 py-2">Motivo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultado.errores.map((e, i) => (
                          <tr key={`${e.fila}-${e.campo}-${i}`} className="border-b last:border-0">
                            <td className="px-3 py-2">{e.fila}</td>
                            <td className="px-3 py-2 capitalize">{e.campo}</td>
                            <td className="px-3 py-2">{e.mensaje}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button onClick={() => setAbierto(false)}>Listo</Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Carga masiva de estudiantes</DialogTitle>
                <DialogDescription>
                  Descargá la plantilla, completá una fila por estudiante y subí el archivo. La
                  clave inicial será la cédula y se pedirá cambiarla en el primer ingreso. La
                  columna «grupo» es opcional: si la llenás con el nombre de un proyecto existente,
                  el estudiante queda asignado en esa carga.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={descargarPlantilla}>
                  <FileDown className="h-4 w-4" />
                  Descargar plantilla (.xlsx)
                </Button>

                <div className="space-y-1">
                  <label className="text-sm font-medium">Archivo .xlsx</label>
                  <Input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx"
                    onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {archivo
                      ? `Se importará "${archivo.name}" (${archivo.size} bytes).`
                      : "Aún no elegiste ningún archivo."}
                  </p>
                </div>

                {error && (
                  <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    {error}
                  </p>
                )}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button onClick={importar} disabled={!archivo || ocupado} className="gap-1.5">
                  {ocupado ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Importar
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}