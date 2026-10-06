"use client";

import { useState } from "react";
import { CheckCircle2, KeyRound, Loader2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MIN_PASSWORD, newPasswordError } from "@/lib/password";
import type { Usuario } from "@/lib/types";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";

/**
 * Cambio de contraseña por el propio usuario.
 *
 * El servidor devuelve un token nuevo porque el anterior llevaba la marca de
 * clave temporal y ya no dejaría operar: hay que guardarlo, no solo avisar.
 */
export function CambiarPassword({ obligatorio = false }: { obligatorio?: boolean }) {
  const setSession = useAuthStore((s) => s.setSession);

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetida, setRepetida] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(false);

    const problema = newPasswordError(nueva);
    if (problema) {
      setError(problema);
      return;
    }
    if (nueva !== repetida) {
      setError("Las contraseñas nuevas no coinciden");
      return;
    }
    if (nueva === actual) {
      setError("La contraseña nueva debe ser distinta de la actual");
      return;
    }

    setEnviando(true);
    try {
      const { data } = await api.patch<{ token: string; usuario: Usuario }>(
        "/auth/password",
        { passwordActual: actual, passwordNueva: nueva }
      );
      setSession(data.token, data.usuario);
      setActual("");
      setNueva("");
      setRepetida("");
      setExito(true);
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudo cambiar la contraseña.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form
      onSubmit={enviar}
      className={
        obligatorio
          ? "mx-auto max-w-md rounded-xl border border-amber-300 bg-amber-50 p-6 space-y-4"
          : "space-y-4"
      }
    >
      {obligatorio && (
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
            <KeyRound className="h-5 w-5 text-amber-600" />
            Cambia tu contraseña temporal
          </h2>
          <p className="text-sm text-muted-foreground">
            Es la clave que te entregó la administración. El sistema no te deja usar el sistema
            hasta que elijas una propia.
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="password-actual" className="text-sm font-medium text-foreground">
          Contraseña actual
        </label>
        <Input
          id="password-actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
          required
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password-nueva" className="text-sm font-medium text-foreground">
          Contraseña nueva
        </label>
        <Input
          id="password-nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Mínimo {MIN_PASSWORD} caracteres, con al menos una letra y un número.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password-repetida" className="text-sm font-medium text-foreground">
          Repite la contraseña nueva
        </label>
        <Input
          id="password-repetida"
          type="password"
          autoComplete="new-password"
          value={repetida}
          onChange={(e) => setRepetida(e.target.value)}
          required
        />
      </div>

      {error && (
        <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
          <TriangleAlert className="h-4 w-4 shrink-0 mt-0.5" />
          {error}
        </p>
      )}
      {exito && (
        <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          Contraseña actualizada.
        </p>
      )}

      <Button type="submit" disabled={enviando}>
        {enviando ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Guardando...
          </>
        ) : (
          "Guardar contraseña"
        )}
      </Button>
    </form>
  );
}