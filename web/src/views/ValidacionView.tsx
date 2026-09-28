"use client";

import { useState } from "react";
import {
  CheckCircle,
  Undo2,
  XCircle,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  GraduationCap,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import { estadoRegistro, formatearHoras, mostrarFecha } from "@/lib/registro";
import type { PendienteTutor, TipoRegistro } from "@/lib/types";

const tipoLabel: Record<TipoRegistro, string> = {
  comunitario: "Comunitario",
  social: "Social",
  ambiental: "Ambiental",
};

export function ValidacionView() {
  const usuario = useAuthStore((s) => s.usuario);
  const { data, loading, error, reload } = useApiData<{ pendientes: PendienteTutor[] }>(
    "/bitacoras/pendientes"
  );
  const pendientes = data?.pendientes ?? [];

  if (!usuario || usuario.rol !== "tutor") {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Validación de Registros</h2>
          <p className="text-muted-foreground text-sm mt-1">
            La validación de bitácoras y servicios la realizan los tutores de cada proyecto.
          </p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <CheckCircle className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mt-4">Acceso exclusivo para tutores</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              Inicia sesión con una cuenta de tutor para revisar y aprobar los registros de tus
              estudiantes.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Validación de Registros</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Revisa los registros de horas de tus estudiantes y aprueba, pide correcciones o rechaza.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-iunav-blue" />
            Pendientes por validar ({pendientes.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando pendientes...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={reload}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : pendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No tienes registros pendientes. ¡Todo al día!
            </p>
          ) : (
            <div className="space-y-3">
              {pendientes.map((p) => (
                <TarjetaPendiente key={p.id} pendiente={p} onCambio={reload} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TarjetaPendiente({
  pendiente,
  onCambio,
}: {
  pendiente: PendienteTutor;
  onCambio: () => void;
}) {
  const [accion, setAccion] = useState<"aprobar" | "corregir" | "rechazar" | null>(null);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const estadoSel = pendiente.estado as "pendiente" | "corregir";

  const ejecutar = async () => {
    if (!accion) return;
    setError(null);

    const estado = accion === "aprobar" ? "aprobado" : accion === "corregir" ? "corregir" : "rechazado";
    if ((estado === "corregir" || estado === "rechazado") && !comentario.trim()) {
      setError("Indica un comentario para el estudiante.");
      return;
    }

    setEnviando(true);
    try {
      await api.patch(`/bitacoras/${pendiente.id}/estado`, {
        tipo: pendiente.tipo,
        estado,
        comentario: estado === "aprobado" ? (comentario.trim() || null) : comentario.trim(),
      });
      setAccion(null);
      setComentario("");
      onCambio();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo procesar la validación.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={estadoRegistro[estadoSel]?.variant ?? "warning"}>
            {estadoRegistro[estadoSel]?.label ?? pendiente.estado}
          </Badge>
          <Badge variant="secondary">{tipoLabel[pendiente.tipo]}</Badge>
          {pendiente.semana && <span className="text-xs text-muted-foreground">Semana {pendiente.semana}</span>}
          <span className="text-xs text-muted-foreground">{mostrarFecha(pendiente.fecha)}</span>
          <span className="text-xs font-semibold text-iunav-blue">{formatearHoras(pendiente.horas)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <GraduationCap className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">{pendiente.estudianteNombre}</span>
        </div>
      </div>

      <p className="text-sm text-foreground mt-2 leading-snug">{pendiente.descripcion}</p>

      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
        {pendiente.proyectoNombre && <span className="font-medium">{pendiente.proyectoNombre}</span>}
        {pendiente.evidenciaUrl && (
          <a
            href={pendiente.evidenciaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-iunav-blue hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Ver evidencia
          </a>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {accion ? (
        <div className="mt-3 space-y-2">
          <textarea
            rows={2}
            placeholder={
              accion === "corregir"
                ? "Indica qué debe corregir el estudiante..."
                : accion === "rechazar"
                  ? "Indica el motivo del rechazo..."
                  : "Comentario opcional..."
            }
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" disabled={enviando} onClick={ejecutar}>
              {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Confirmar
            </Button>
            <Button size="sm" variant="ghost" disabled={enviando} onClick={() => setAccion(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" className="gap-1.5" onClick={() => setAccion("aprobar")}>
            <CheckCircle className="h-4 w-4" />
            Aprobar
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setAccion("corregir")}>
            <Undo2 className="h-4 w-4" />
            Corregir
          </Button>
          <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => setAccion("rechazar")}>
            <XCircle className="h-4 w-4" />
            Rechazar
          </Button>
        </div>
      )}
    </div>
  );
}