"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, Mail, RefreshCw, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import {
  ESTADOS_NOTIFICACION,
  TIPOS_NOTIFICACION,
  estadoNotificacionLabels,
  tipoNotificacionLabels,
  type EstadoNotificacion,
  type Notificacion,
  type RespuestaNotificaciones,
} from "@/lib/types";

/**
 * Bandeja de salida del correo.
 *
 * Existe porque el envío puede fallar y hay que poder verlo: sin esta pantalla,
 * un SMTP mal configurado se traduce en estudiantes que nunca reciben su clave
 * temporal y en nadie enterándose.
 *
 * Solo la abre el administrador: cada fila guarda el cuerpo del mensaje, y el
 * de bienvenida lleva la clave temporal del destinatario.
 */

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const estadoBadge: Record<EstadoNotificacion, "success" | "warning" | "danger"> = {
  enviada: "success",
  pendiente: "warning",
  fallida: "danger",
};

function fechaYHora(iso: string | null): string {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PanelNotificaciones() {
  const [estado, setEstado] = useState<EstadoNotificacion | "todas">("todas");
  const [tipo, setTipo] = useState<string>("todos");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (estado !== "todas") params.set("estado", estado);
    if (tipo !== "todos") params.set("tipo", tipo);
    const query = params.toString();
    return `/notificaciones${query ? `?${query}` : ""}`;
  }, [estado, tipo]);

  const { data, loading, error: errorCarga, reload } = useApiData<RespuestaNotificaciones>(url);

  const notificaciones: Notificacion[] = data?.notificaciones ?? [];
  const resumen = data?.resumen ?? { pendiente: 0, enviada: 0, fallida: 0 };
  const correoConfigurado = data?.correoConfigurado ?? false;

  async function ejecutar(clave: string, accion: () => Promise<unknown>) {
    setOcupado(clave);
    setError(null);
    try {
      await accion();
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? "No se pudo completar el reintento.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Mail className="h-4 w-4 text-iunav-blue" />
          Correos enviados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!correoConfigurado && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              No hay servidor de correo configurado (<code>SMTP_HOST</code> en{" "}
              <code>server/.env</code>), así que no sale ningún mensaje. Los avisos se siguen
              guardando aquí y se pueden reintentar en cuanto se configure uno.
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-2">
            <Badge variant="success">{resumen.enviada} enviadas</Badge>
            <Badge variant="warning">{resumen.pendiente} pendientes</Badge>
            <Badge variant="danger">{resumen.fallida} fallidas</Badge>
          </div>

          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Estado</span>
            <select
              value={estado}
              onChange={(e) => setEstado(e.target.value as EstadoNotificacion | "todas")}
              className={selectClass}
            >
              <option value="todas">Todos los estados</option>
              {ESTADOS_NOTIFICACION.map((e) => (
                <option key={e} value={e}>
                  {estadoNotificacionLabels[e]}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Tipo</span>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className={selectClass}
            >
              <option value="todos">Todos los tipos</option>
              {TIPOS_NOTIFICACION.map((t) => (
                <option key={t} value={t}>
                  {tipoNotificacionLabels[t]}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="outline"
            size="sm"
            disabled={ocupado !== null || resumen.pendiente + resumen.fallida === 0}
            onClick={() =>
              void ejecutar("todas", () => api.post("/notificaciones/reintentar-todas", {}))
            }
          >
            {ocupado === "todas" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Reintentar las que faltan
          </Button>
        </div>

        {error && (
          <p className="flex items-center gap-2 text-sm text-red-600">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </p>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Cargando correos...
          </div>
        )}

        {!loading && errorCarga && (
          <div className="flex flex-col items-start gap-2 py-6">
            <p className="flex items-center gap-2 text-sm text-red-600">
              <AlertTriangle className="h-4 w-4" />
              {errorCarga}
            </p>
            <Button variant="outline" size="sm" onClick={reload}>
              Reintentar
            </Button>
          </div>
        )}

        {!loading && !errorCarga && notificaciones.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Todavía no se ha enviado ningún correo.
          </p>
        )}

        {!loading && !errorCarga && notificaciones.length > 0 && (
          <div className="overflow-x-auto -mx-2 px-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">
                    Destinatario
                  </th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Asunto</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Tipo</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Estado</th>
                  <th className="text-left font-medium text-muted-foreground px-4 py-3">Fecha</th>
                  <th className="text-right font-medium text-muted-foreground px-4 py-3">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {notificaciones.map((n) => (
                  <tr
                    key={n.idNotificacion}
                    className="border-b last:border-0 align-top transition-colors hover:bg-muted/30"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{n.destinatarioNombre}</div>
                      <div className="text-xs text-muted-foreground">{n.destinatarioEmail}</div>
                    </td>
                    <td className="px-4 py-3">{n.asunto}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {tipoNotificacionLabels[n.tipo] ?? n.tipo}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={estadoBadge[n.estado]}>
                        {estadoNotificacionLabels[n.estado]}
                      </Badge>
                      {n.error && (
                        <p className="mt-1 max-w-64 text-xs text-red-600">{n.error}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {fechaYHora(n.enviadoEn ?? n.creadoEn)}
                      {n.intentos > 1 && (
                        <div className="text-xs">{n.intentos} intentos</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {n.estado !== "enviada" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs"
                          disabled={ocupado === n.idNotificacion}
                          onClick={() =>
                            void ejecutar(n.idNotificacion, () =>
                              api.post(`/notificaciones/${n.idNotificacion}/reintentar`, {})
                            )
                          }
                        >
                          {ocupado === n.idNotificacion ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                          Reintentar
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
