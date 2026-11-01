"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, History, Loader2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApiData } from "@/lib/useApiData";
import {
  ENTIDADES_HISTORIAL,
  entidadHistorialLabels,
  type EntidadHistorial,
  type EventoHistorial,
  type RespuestaHistorial,
} from "@/lib/types";

/**
 * Historial de acciones administrativas y de configuración.
 *
 * Es de solo lectura: nada de esta pantalla escribe. Responde a la corrección
 * de que los cambios de configuración y las acciones administrativas tenían que
 * quedar visibles, con autor, fecha y hora.
 *
 * Los filtros viajan al servidor dentro de la URL de `useApiData`, que vuelve a
 * pedir los datos cuando la cadena cambia (mismo patrón que `ProyectosView`).
 */

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

const rolBadge: Record<string, "danger" | "warning" | "info" | "secondary"> = {
  admin: "danger",
  coordinador: "warning",
  tutor: "info",
  estudiante: "secondary",
};

const rolLabel: Record<string, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  tutor: "Tutor",
  estudiante: "Estudiante",
};

/** Pasa el timestamp del servidor a "25/10/2026, 14:03". */
function fechaYHora(iso: string): string {
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

/**
 * `datos.cambios` llega como un objeto campo -> { antes, despues }. Se despliega
 * en líneas legibles en vez de volcar el JSON crudo.
 */
function Cambios({ datos }: { datos: Record<string, unknown> | null }) {
  const cambios = datos?.cambios as
    | Record<string, { antes: unknown; despues: unknown }>
    | undefined;
  const motivo = typeof datos?.motivo === "string" ? datos.motivo : null;

  if (!cambios && !motivo) return null;

  return (
    <div className="mt-1 space-y-0.5">
      {cambios &&
        Object.entries(cambios).map(([campo, { antes, despues }]) => (
          <p key={campo} className="text-xs text-muted-foreground">
            <span className="font-medium">{campo}:</span>{" "}
            <span className="line-through">{String(antes ?? "sin definir")}</span>
            {" → "}
            <span className="text-foreground">{String(despues ?? "sin definir")}</span>
          </p>
        ))}
      {motivo && (
        <p className="text-xs text-amber-700">
          <span className="font-medium">Motivo:</span> {motivo}
        </p>
      )}
    </div>
  );
}

export function HistorialView() {
  const [entidad, setEntidad] = useState<EntidadHistorial | "todas">("todas");
  const [texto, setTexto] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [pagina, setPagina] = useState(1);

  // `useApiData` recarga cuando cambia la cadena de la URL, así que los filtros
  // se memorizan juntos: una cadena nueva en cada render dispararía peticiones
  // en bucle.
  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (entidad !== "todas") params.set("entidad", entidad);
    if (texto.trim()) params.set("q", texto.trim());
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    params.set("pagina", String(pagina));
    return `/historial?${params.toString()}`;
  }, [entidad, texto, desde, hasta, pagina]);

  const { data, loading, error, reload } = useApiData<RespuestaHistorial>(url);

  const eventos: EventoHistorial[] = data?.eventos ?? [];
  const total = data?.total ?? 0;
  const porPagina = data?.porPagina ?? 20;
  const ultimaPagina = Math.max(1, Math.ceil(total / porPagina));

  /** Cualquier cambio de filtro devuelve a la primera página. */
  function filtrar(accion: () => void) {
    accion();
    setPagina(1);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Historial de acciones</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Quién cambió qué y cuándo, en configuración, usuarios, proyectos, períodos y plantillas.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-muted-foreground" />
            Registro ({total})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3 mb-4">
            <div className="relative min-w-56 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por descripción o autor..."
                value={texto}
                onChange={(e) => filtrar(() => setTexto(e.target.value))}
              />
            </div>

            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Módulo</span>
              <select
                value={entidad}
                onChange={(e) =>
                  filtrar(() => setEntidad(e.target.value as EntidadHistorial | "todas"))
                }
                className={selectClass}
              >
                <option value="todas">Todos los módulos</option>
                {ENTIDADES_HISTORIAL.map((e) => (
                  <option key={e} value={e}>
                    {entidadHistorialLabels[e]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Desde</span>
              <Input
                type="date"
                value={desde}
                onChange={(e) => filtrar(() => setDesde(e.target.value))}
                className="w-40"
              />
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Hasta</span>
              <Input
                type="date"
                value={hasta}
                onChange={(e) => filtrar(() => setHasta(e.target.value))}
                className="w-40"
              />
            </label>
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial...
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-start gap-2 py-8">
              <p className="flex items-center gap-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </p>
              <Button variant="outline" size="sm" onClick={reload}>
                Reintentar
              </Button>
            </div>
          )}

          {!loading && !error && eventos.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay acciones registradas con esos filtros.
            </p>
          )}

          {!loading && !error && eventos.length > 0 && (
            <>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Fecha y hora
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Autor
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Módulo
                      </th>
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Acción
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventos.map((ev) => (
                      <tr
                        key={ev.idEvento}
                        className="border-b last:border-0 hover:bg-muted/30 transition-colors align-top"
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                          {fechaYHora(ev.creadoEn)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{ev.actorNombre}</div>
                          <Badge variant={rolBadge[ev.actorRol] ?? "secondary"}>
                            {rolLabel[ev.actorRol] ?? ev.actorRol}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {entidadHistorialLabels[ev.entidad] ?? ev.entidad}
                        </td>
                        <td className="px-4 py-3">
                          <span>{ev.descripcion}</span>
                          <Cambios datos={ev.datos} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {ultimaPagina > 1 && (
                <div className="flex items-center justify-between gap-3 pt-4">
                  <p className="text-xs text-muted-foreground">
                    Página {pagina} de {ultimaPagina}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagina <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pagina >= ultimaPagina}
                      onClick={() => setPagina((p) => p + 1)}
                    >
                      Siguiente
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
