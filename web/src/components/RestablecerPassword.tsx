"use client";

import { useState } from "react";
import { Check, Copy, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

/**
 * Restablecimiento de contraseña de una cuenta.
 *
 * El admin no elige la clave: la genera el servidor y se muestra una sola vez,
 * porque en la base solo queda el hash. Después el usuario tiene que cambiarla
 * al entrar.
 */
export function RestablecerPassword({
  idUsuario,
  nombre,
  onRestablecido,
}: {
  idUsuario: string;
  nombre: string;
  onRestablecido: () => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [clave, setClave] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiada, setCopiada] = useState(false);

  function abrir() {
    setClave(null);
    setError(null);
    setCopiada(false);
    setAbierto(true);
  }

  async function restablecer() {
    setOcupado(true);
    setError(null);
    try {
      const { data } = await api.post<{ passwordTemporal: string }>(
        `/usuarios/${idUsuario}/password`
      );
      setClave(data.passwordTemporal);
      onRestablecido();
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudo restablecer la contraseña.");
    } finally {
      setOcupado(false);
    }
  }

  async function copiar() {
    if (!clave) return;
    try {
      await navigator.clipboard.writeText(clave);
      setCopiada(true);
    } catch {
      // Sin permiso de portapapeles: la clave sigue visible para copiarla a mano.
      setError("No se pudo copiar. Cópiala manualmente.");
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1.5 text-xs"
        onClick={abrir}
      >
        <KeyRound className="h-3.5 w-3.5" />
        Restablecer clave
      </Button>

      <Dialog open={abierto} onOpenChange={(o) => !o && setAbierto(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
            <DialogDescription>
              Se generará una clave temporal para <span className="font-medium">{nombre}</span>.
              Tendrás que entregársela en mano: solo se muestra una vez y el usuario deberá
              cambiarla al iniciar sesión.
            </DialogDescription>
          </DialogHeader>

          {!clave ? (
            <>
              {error && (
                <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                  <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
                  {error}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setAbierto(false)}>
                  Cancelar
                </Button>
                <Button onClick={restablecer} disabled={ocupado}>
                  {ocupado ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generando...
                    </>
                  ) : (
                    "Generar clave temporal"
                  )}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
                <p className="text-xs font-medium text-amber-800">Clave temporal</p>
                <p className="font-mono text-lg font-bold tracking-wide text-foreground">{clave}</p>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copiar}>
                  {copiada ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiada ? "Copiada" : "Copiar"}
                </Button>
              </div>

              {error && (
                <p className="flex items-start gap-2 text-xs text-red-600">
                  <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {error}
                </p>
              )}

              <DialogFooter>
                <Button onClick={() => setAbierto(false)}>Listo</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}