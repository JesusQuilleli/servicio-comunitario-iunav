"use client";

import { useState } from "react";
import {
  Award,
  CheckCircle2,
  FileSpreadsheet,
  FileText,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import {
  RUTA_CONSOLIDADO_PDF,
  RUTA_CONSOLIDADO_XLSX,
  descargarActa,
  descargarCertificado,
  descargarReporte,
  mensajeDeError,
} from "@/lib/reportes";
import { useAuthStore } from "@/stores/authStore";
import type { DetalleGrupo, Grupo, PeriodoAcademico } from "@/lib/types";

/**
 * Reportes y certificados.
 *
 * Todo se genera en el servidor a partir de las horas ya validadas: aqui solo
 * se eligen los filtros y se descarga el archivo. El listado de estudiantes
 * sale del detalle de cada grupo, que es la misma fuente que usa la validación.
 */
export function ReportesView() {
  const usuario = useAuthStore((s) => s.usuario);
  const esTutor = usuario?.rol === "tutor";

  const { data: datosPeriodos } = useApiData<{ periodos: PeriodoAcademico[] }>("/periodos");
  const { data: datosGrupos } = useApiData<{ grupos: Grupo[] }>(
    "/grupos",
    usuario?.rol === "admin" || usuario?.rol === "coordinador" || esTutor
  );

  const [periodoId, setPeriodoId] = useState<number | "">("");
  const [grupoId, setGrupoId] = useState<string>("");

  const grupos = datosGrupos?.grupos ?? [];
  const periodos = datosPeriodos?.periodos ?? [];

  // El tutor solo puede sacar el acta de sus grupos; el filtro se queda en los
  // suyos para no ofrecer una opcion que el servidor va a rechazar.
  const gruposVisibles = esTutor
    ? grupos.filter((g) => g.tutorId === usuario?.idUsuario)
    : grupos;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Reportes y certificados</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Documentos generados con las horas ya validadas. Los pendientes no cuentan para las metas.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Consolidado de horas</CardTitle>
          <CardDescription>
            Una fila por estudiante con sus horas aprobadas y pendientes, y el porcentaje sobre las
            metas del programa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Periodo</span>
              <select
                value={periodoId}
                onChange={(e) => setPeriodoId(e.target.value === "" ? "" : Number(e.target.value))}
                className="h-9 rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">Todos los periodos</option>
                {periodos.map((p) => (
                  <option key={p.idPeriodo} value={p.idPeriodo}>
                    {p.nombrePeriodo}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Grupo</span>
              <select
                value={grupoId}
                onChange={(e) => setGrupoId(e.target.value)}
                className="h-9 rounded-lg border bg-white px-3 text-sm"
              >
                <option value="">Todos los grupos</option>
                {gruposVisibles.map((g) => (
                  <option key={g.idGrupo} value={g.idGrupo}>
                    {g.nombreProyecto}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Botones
            etiqueta="Generar"
            onPdf={() =>
              descargarReporte(RUTA_CONSOLIDADO_PDF, {
                periodoId: periodoId === "" ? null : periodoId,
                grupoId: grupoId || null,
              })
            }
            onExcel={() =>
              descargarReporte(RUTA_CONSOLIDADO_XLSX, {
                periodoId: periodoId === "" ? null : periodoId,
                grupoId: grupoId || null,
              })
            }
          />
        </CardContent>
      </Card>

      <Actas grupos={gruposVisibles} />

      <Certificados grupos={gruposVisibles} periodos={periodos} />
    </div>
  );
}

/** Botones de PDF/Excel que comparten estado de carga y error. */
function Botones({
  etiqueta,
  onPdf,
  onExcel,
}: {
  etiqueta: string;
  onPdf: () => Promise<string>;
  onExcel?: () => Promise<string>;
}) {
  const [ocupado, setOcupado] = useState<"pdf" | "excel" | null>(null);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function ejecutar(clave: "pdf" | "excel", accion: () => Promise<string>) {
    setOcupado(clave);
    setMensaje(null);
    try {
      const nombre = await accion();
      setMensaje({ ok: true, texto: `Listo: ${nombre}` });
    } catch (err: unknown) {
      setMensaje({ ok: false, texto: await mensajeDeError(err) });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={ocupado !== null} onClick={() => ejecutar("pdf", onPdf)}>
          {ocupado === "pdf" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          {etiqueta} PDF
        </Button>
        {onExcel && (
          <Button
            size="sm"
            variant="outline"
            disabled={ocupado !== null}
            onClick={() => ejecutar("excel", onExcel)}
          >
            {ocupado === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="h-4 w-4" />
            )}
            {etiqueta} Excel
          </Button>
        )}
      </div>

      {mensaje && (
        <p
          className={
            mensaje.ok
              ? "flex items-center gap-2 text-sm text-emerald-700"
              : "flex items-center gap-2 text-sm text-red-600"
          }
        >
          {mensaje.ok ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <TriangleAlert className="h-4 w-4" />
          )}
          {mensaje.texto}
        </p>
      )}
    </div>
  );
}

/** Un bloque por grupo con su botón de acta. */
function Actas({ grupos }: { grupos: Grupo[] }) {
  if (grupos.length === 0) {
    return null;
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Actas de culminación</CardTitle>
        <CardDescription>
          Detalle de integrantes, horas por concepto y espacio para las firmas del tutor y la
          coordinación.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {grupos.map((g) => (
          <FilaReporte
            key={g.idGrupo}
            titulo={g.nombreProyecto}
            detalle={[g.periodo ?? "Sin periodo", `${g.integrantes} integrantes`].join(" · ")}
            onDescargar={() => descargarActa(g.idGrupo)}
            textoBoton="Acta"
          />
        ))}
      </CardContent>
    </Card>
  );
}

/** Un bloque por grupo con sus estudiantes y un certificado cada uno. */
function Certificados({
  grupos,
  periodos,
}: {
  grupos: Grupo[];
  periodos: PeriodoAcademico[];
}) {
  const [detalles, setDetalles] = useState<Record<string, DetalleGrupo>>({});
  const [cargando, setCargando] = useState<string | null>(null);
  const [periodoId, setPeriodoId] = useState<number | "">("");

  async function cargar(groupId: string) {
    if (detalles[groupId]) {
      setDetalles((prev) => {
        const copia = { ...prev };
        delete copia[groupId];
        return copia;
      });
      return;
    }
    setCargando(groupId);
    try {
      const res = await api.get<{ grupo: DetalleGrupo }>(`/grupos/${groupId}`);
      setDetalles((prev) => ({ ...prev, [groupId]: res.data.grupo }));
    } catch {
      // Si falla, el bloque sigue plegado: noRompe el resto de la pantalla.
    } finally {
      setCargando(null);
    }
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Certificados</CardTitle>
        <CardDescription>
          El certificado se marca como no acreditado si el estudiante no alcanza las metas, en vez
          de dar por bueno un requisito pendiente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Periodo del certificado</span>
          <select
            value={periodoId}
            onChange={(e) => setPeriodoId(e.target.value === "" ? "" : Number(e.target.value))}
            className="h-9 rounded-lg border bg-white px-3 text-sm"
          >
            <option value="">Todos los periodos</option>
            {periodos.map((p) => (
              <option key={p.idPeriodo} value={p.idPeriodo}>
                {p.nombrePeriodo}
              </option>
            ))}
          </select>
        </label>

        {grupos.map((g) => {
          const detalle = detalles[g.idGrupo];
          return (
            <div key={g.idGrupo} className="rounded-lg border">
              <button
                type="button"
                onClick={() => cargar(g.idGrupo)}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50"
              >
                {cargando === g.idGrupo ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Award className="h-4 w-4 text-muted-foreground" />
                )}
                {g.nombreProyecto}
                <span className="ml-auto text-xs text-muted-foreground">
                  {detalle ? "Ocultar" : "Ver estudiantes"}
                </span>
              </button>

              {detalle && (
                <div className="divide-y border-t">
                  {detalle.listaIntegrantes.map((i) => (
                    <FilaReporte
                      key={i.idUsuario}
                      titulo={i.nombreCompleto}
                      detalle={i.cedula}
                      onDescargar={() =>
                        descargarCertificado(
                          i.idUsuario,
                          periodoId === "" ? null : periodoId
                        )
                      }
                      textoBoton="Certificado"
                      plano
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FilaReporte({
  titulo,
  detalle,
  onDescargar,
  textoBoton,
  plano = false,
}: {
  titulo: string;
  detalle: string;
  onDescargar: () => Promise<string>;
  textoBoton: string;
  plano?: boolean;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState<{ ok: boolean; texto: string } | null>(null);

  async function descargar() {
    setOcupado(true);
    setMensaje(null);
    try {
      const nombre = await onDescargar();
      setMensaje({ ok: true, texto: nombre });
    } catch (err: unknown) {
      setMensaje({ ok: false, texto: await mensajeDeError(err) });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className={plano ? "flex items-center gap-3 px-3 py-2" : "rounded-lg border"}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{titulo}</p>
        {detalle && <p className="truncate text-xs text-muted-foreground">{detalle}</p>}
        {mensaje && (
          <p
            className={
              mensaje.ok ? "truncate text-xs text-emerald-700" : "truncate text-xs text-red-600"
            }
          >
            {mensaje.texto}
          </p>
        )}
      </div>

      <Button
        size="sm"
        variant={plano ? "outline" : "default"}
        disabled={ocupado}
        onClick={descargar}
      >
        {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
        {textoBoton}
      </Button>
    </div>
  );
}