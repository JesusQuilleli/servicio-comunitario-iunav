"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarRange,
  Check,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Power,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Evidencia } from "@/components/Evidencia";
import { SubirDocumentoPlantilla } from "@/components/SubirDocumentoPlantilla";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import {
  TIPOS_PLANTILLA,
  tipoPlantillaLabels,
  type ConfiguracionSistema,
  type PeriodoAcademico,
  type PlantillaDocumento,
  type TipoPlantilla,
} from "@/lib/types";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const tipoBadge: Record<TipoPlantilla, "info" | "warning" | "secondary" | "success"> = {
  bitacora: "info",
  acta: "warning",
  informe: "secondary",
  certificado: "success",
};

interface FormReglas {
  horasDirectas: string;
  horasImpacto: string;
  limiteHorasDiarias: string;
  periodoActivoId: string;
}

const REGLAS_VACIAS: FormReglas = {
  horasDirectas: "",
  horasImpacto: "",
  limiteHorasDiarias: "",
  periodoActivoId: "",
};

interface FormPeriodo {
  nombrePeriodo: string;
  fechaInicio: string;
  fechaFin: string;
}

const PERIODO_VACIO: FormPeriodo = { nombrePeriodo: "", fechaInicio: "", fechaFin: "" };

interface FormPlantilla {
  nombre: string;
  descripcion: string;
  tipo: TipoPlantilla;
}

const PLANTILLA_VACIA: FormPlantilla = { nombre: "", descripcion: "", tipo: "bitacora" };

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto;
}

function formDesdeConfig(c: ConfiguracionSistema): FormReglas {
  return {
    horasDirectas: String(c.horasDirectas),
    horasImpacto: String(c.horasImpacto),
    limiteHorasDiarias: String(c.limiteHorasDiarias),
    periodoActivoId: c.periodoActivoId === null ? "" : String(c.periodoActivoId),
  };
}

function formDesdePlantilla(p: PlantillaDocumento): FormPlantilla {
  return {
    nombre: p.nombre,
    descripcion: p.descripcion ?? "",
    tipo: p.tipo,
  };
}

export function ConfiguracionesView() {
  const usuario = useAuthStore((s) => s.usuario);
  const esAdmin = usuario?.rol === "admin";

  const {
    data: configData,
    loading: loadingConfig,
    error: errorConfig,
    reload: reloadConfig,
  } = useApiData<{ configuracion: ConfiguracionSistema }>("/configuracion");

  const {
    data: periodosData,
    loading: loadingPeriodos,
    error: errorPeriodos,
    reload: reloadPeriodos,
  } = useApiData<{ periodos: PeriodoAcademico[] }>("/periodos?todos=true");

  const {
    data: plantillasData,
    loading: loadingPlantillas,
    error: errorPlantillas,
    reload: reloadPlantillas,
  } = useApiData<{ plantillas: PlantillaDocumento[] }>("/configuracion/plantillas?todas=true");

  const periodos = useMemo(() => periodosData?.periodos ?? [], [periodosData]);
  const plantillas = useMemo(() => plantillasData?.plantillas ?? [], [plantillasData]);
  const totalHoras = (configData?.configuracion.horasDirectas ?? 0) + (configData?.configuracion.horasImpacto ?? 0);

  const [formReglas, setFormReglas] = useState<FormReglas>(REGLAS_VACIAS);
  const [reglasSincronizadas, setReglasSincronizadas] = useState<ConfiguracionSistema | null>(null);
  const [guardandoReglas, setGuardandoReglas] = useState(false);
  const [errorReglas, setErrorReglas] = useState<string | null>(null);
  const [okReglas, setOkReglas] = useState(false);

  const [periodoEditando, setPeriodoEditando] = useState<PeriodoAcademico | null>(null);
  const [periodoAbierto, setPeriodoAbierto] = useState(false);
  const [formPeriodo, setFormPeriodo] = useState<FormPeriodo>(PERIODO_VACIO);
  const [errorPeriodo, setErrorPeriodo] = useState<string | null>(null);
  const [togglingPeriodo, setTogglingPeriodo] = useState<number | null>(null);

  const [plantillaEditando, setPlantillaEditando] = useState<PlantillaDocumento | null>(null);
  const [plantillaAbierta, setPlantillaAbierta] = useState(false);
  const [formPlantilla, setFormPlantilla] = useState<FormPlantilla>(PLANTILLA_VACIA);
  const [errorPlantilla, setErrorPlantilla] = useState<string | null>(null);
  const [togglingPlantilla, setTogglingPlantilla] = useState<number | null>(null);

  if (configData?.configuracion && configData.configuracion !== reglasSincronizadas) {
    setReglasSincronizadas(configData.configuracion);
    setFormReglas(formDesdeConfig(configData.configuracion));
  }

  const abrirPeriodo = (p: PeriodoAcademico | null) => {
    setPeriodoEditando(p);
    setFormPeriodo(p ? { nombrePeriodo: p.nombrePeriodo, fechaInicio: p.fechaInicio, fechaFin: p.fechaFin } : PERIODO_VACIO);
    setErrorPeriodo(null);
    setPeriodoAbierto(true);
  };

  const abrirPlantilla = (p: PlantillaDocumento | null) => {
    setPlantillaEditando(p);
    setFormPlantilla(p ? formDesdePlantilla(p) : PLANTILLA_VACIA);
    setErrorPlantilla(null);
    setPlantillaAbierta(true);
  };

  const guardarReglas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!esAdmin) return;
    setGuardandoReglas(true);
    setErrorReglas(null);
    setOkReglas(false);
    try {
      await api.patch("/configuracion", {
        horasDirectas: Number(formReglas.horasDirectas),
        horasImpacto: Number(formReglas.horasImpacto),
        limiteHorasDiarias: Number(formReglas.limiteHorasDiarias),
        periodoActivoId: formReglas.periodoActivoId === "" ? null : Number(formReglas.periodoActivoId),
      });
      reloadConfig();
      setOkReglas(true);
    } catch (err: unknown) {
      setErrorReglas(mensajeError(err, "No se pudo guardar la configuración."));
    } finally {
      setGuardandoReglas(false);
    }
  };

  const guardarPeriodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPeriodo(null);
    try {
      const cuerpo = {
        nombrePeriodo: formPeriodo.nombrePeriodo,
        fechaInicio: formPeriodo.fechaInicio,
        fechaFin: formPeriodo.fechaFin,
      };
      if (periodoEditando) {
        await api.patch(`/periodos/${periodoEditando.idPeriodo}`, cuerpo);
      } else {
        await api.post("/periodos", cuerpo);
      }
      setPeriodoAbierto(false);
      reloadPeriodos();
    } catch (err: unknown) {
      setErrorPeriodo(mensajeError(err, "No se pudo guardar el período."));
    }
  };

  const togglePeriodo = async (p: PeriodoAcademico) => {
    setTogglingPeriodo(p.idPeriodo);
    try {
      await api.patch(`/periodos/${p.idPeriodo}/activo`, { activo: !p.activo });
      reloadPeriodos();
    } catch (err: unknown) {
      setErrorPeriodo(mensajeError(err, "No se pudo actualizar el período."));
    } finally {
      setTogglingPeriodo(null);
    }
  };

  const guardarPlantilla = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorPlantilla(null);
    const cuerpo = {
      nombre: formPlantilla.nombre,
      descripcion: formPlantilla.descripcion === "" ? null : formPlantilla.descripcion,
      tipo: formPlantilla.tipo,
    };
    try {
      if (plantillaEditando) {
        await api.patch(`/configuracion/plantillas/${plantillaEditando.idPlantilla}`, cuerpo);
      } else {
        await api.post("/configuracion/plantillas", cuerpo);
      }
      setPlantillaAbierta(false);
      reloadPlantillas();
    } catch (err: unknown) {
      setErrorPlantilla(mensajeError(err, "No se pudo guardar la plantilla."));
    }
  };

  const togglePlantilla = async (p: PlantillaDocumento) => {
    setTogglingPlantilla(p.idPlantilla);
    try {
      await api.patch(`/configuracion/plantillas/${p.idPlantilla}/activo`, { activo: !p.activo });
      reloadPlantillas();
    } catch (err: unknown) {
      setErrorPlantilla(mensajeError(err, "No se pudo actualizar la plantilla."));
    } finally {
      setTogglingPlantilla(null);
    }
  };

  const hayCarga =
    loadingConfig || loadingPeriodos || loadingPlantillas;
  const hayError = errorConfig ?? errorPeriodos ?? errorPlantillas;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configuraciones y Plantillas</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Ajusta las metas del programa, los períodos académicos y los formatos documentales base.
        </p>
      </div>

      {hayError && !hayCarga && (
        <div className="flex flex-col items-center py-8 text-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground max-w-md">{hayError}</p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              reloadConfig();
              reloadPeriodos();
              reloadPlantillas();
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </div>
      )}

      {!hayError && (
        <Tabs defaultValue="reglas">
          <TabsList>
            <TabsTrigger value="reglas" className="gap-1.5">
              <Settings className="h-3.5 w-3.5" />
              Reglas del programa
            </TabsTrigger>
            <TabsTrigger value="periodos" className="gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" />
              Períodos académicos
            </TabsTrigger>
            <TabsTrigger value="plantillas" className="gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Plantillas
            </TabsTrigger>
          </TabsList>

          <TabsContent value="reglas" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Settings className="h-4 w-4 text-iunav-blue" />
                  Metas y reglas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingConfig ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando configuración...</span>
                  </div>
                ) : (
                  <form onSubmit={guardarReglas} className="space-y-4">
                    <div className="grid sm:grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="horas-directas" className="text-sm font-medium text-foreground">
                          Horas de trabajo directo
                        </label>
                        <Input
                          id="horas-directas"
                          type="number"
                          min={1}
                          max={1000}
                          disabled={!esAdmin}
                          value={formReglas.horasDirectas}
                          onChange={(e) => setFormReglas({ ...formReglas, horasDirectas: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="horas-impacto" className="text-sm font-medium text-foreground">
                          Horas de impacto social/ambiental
                        </label>
                        <Input
                          id="horas-impacto"
                          type="number"
                          min={0}
                          max={1000}
                          disabled={!esAdmin}
                          value={formReglas.horasImpacto}
                          onChange={(e) => setFormReglas({ ...formReglas, horasImpacto: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label htmlFor="limite-diario" className="text-sm font-medium text-foreground">
                          Límite de horas diarias
                        </label>
                        <Input
                          id="limite-diario"
                          type="number"
                          min={1}
                          max={24}
                          disabled={!esAdmin}
                          value={formReglas.limiteHorasDiarias}
                          onChange={(e) => setFormReglas({ ...formReglas, limiteHorasDiarias: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5 sm:max-w-md">
                      <label htmlFor="periodo-activo" className="text-sm font-medium text-foreground">
                        Período académico activo
                      </label>
                      <select
                        id="periodo-activo"
                        className={selectClass}
                        disabled={!esAdmin || loadingPeriodos}
                        value={formReglas.periodoActivoId}
                        onChange={(e) => setFormReglas({ ...formReglas, periodoActivoId: e.target.value })}
                      >
                        <option value="">Sin período activo</option>
                        {periodos.map((p) => (
                          <option key={p.idPeriodo} value={p.idPeriodo}>
                            {p.nombrePeriodo}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                      Meta total del programa:{" "}
                      <span className="font-semibold text-foreground">{totalHoras} horas</span> ({formReglas.horasDirectas || 0}{" "}
                      directas + {formReglas.horasImpacto || 0} de impacto)
                      {configData?.configuracion.periodoActivoNombre && (
                        <> · Período vigente: {configData.configuracion.periodoActivoNombre}</>
                      )}
                    </div>

                    {!esAdmin && (
                      <p className="text-xs text-muted-foreground">
                        Solo el administrador puede modificar las metas del programa.
                      </p>
                    )}

                    {errorReglas && (
                      <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {errorReglas}
                      </div>
                    )}

                    {okReglas && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                        <Check className="h-4 w-4 shrink-0" />
                        Configuración actualizada.
                      </div>
                    )}

                    {esAdmin && (
                      <Button type="submit" disabled={guardandoReglas} className="gap-1.5">
                        {guardandoReglas ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                        Guardar cambios
                      </Button>
                    )}
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="periodos" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <CalendarRange className="h-4 w-4 text-iunav-blue" />
                  Períodos académicos ({periodos.length})
                </CardTitle>
                <Button size="sm" className="gap-1.5" onClick={() => abrirPeriodo(null)}>
                  <Plus className="h-3.5 w-3.5" />
                  Nuevo período
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {errorPeriodo && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {errorPeriodo}
                  </div>
                )}

                {loadingPeriodos ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando períodos...</span>
                  </div>
                ) : periodos.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Todavía no hay períodos académicos registrados.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Período</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Inicio</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Fin</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Estado</th>
                          <th className="text-right font-medium text-muted-foreground px-4 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periodos.map((p) => (
                          <tr key={p.idPeriodo} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">
                              {p.nombrePeriodo}
                              {configData?.configuracion.periodoActivoId === p.idPeriodo && (
                                <Badge variant="info" className="ml-2">
                                  Vigente
                                </Badge>
                              )}
                            </td>
                            <td className="px-4 py-3">{p.fechaInicio}</td>
                            <td className="px-4 py-3">{p.fechaFin}</td>
                            <td className="px-4 py-3">
                              <Badge variant={p.activo ? "success" : "outline"}>
                                {p.activo ? "Activo" : "Inactivo"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => abrirPeriodo(p)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  disabled={togglingPeriodo === p.idPeriodo}
                                  onClick={() => togglePeriodo(p)}
                                >
                                  {togglingPeriodo === p.idPeriodo ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5" />
                                  )}
                                  {p.activo ? "Desactivar" : "Activar"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plantillas" className="mt-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-iunav-blue" />
                  Plantillas documentales ({plantillas.length})
                </CardTitle>
                <Button size="sm" className="gap-1.5" onClick={() => abrirPlantilla(null)}>
                  <Plus className="h-3.5 w-3.5" />
                  Nueva plantilla
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {errorPlantilla && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {errorPlantilla}
                  </div>
                )}

                {loadingPlantillas ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
                    <span className="ml-2 text-sm text-muted-foreground">Cargando plantillas...</span>
                  </div>
                ) : plantillas.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No hay plantillas registradas. Crea la primera para estandarizar los documentos.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Plantilla</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Tipo</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Archivo</th>
                          <th className="text-left font-medium text-muted-foreground px-4 py-3">Estado</th>
                          <th className="text-right font-medium text-muted-foreground px-4 py-3">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plantillas.map((p) => (
                          <tr key={p.idPlantilla} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                            <td className="px-4 py-3">
                              <p className="font-medium">{p.nombre}</p>
                              {p.descripcion && (
                                <p className="text-xs text-muted-foreground mt-0.5">{p.descripcion}</p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={tipoBadge[p.tipo]}>{tipoPlantillaLabels[p.tipo]}</Badge>
                            </td>
                            <td className="px-4 py-3">
                              {p.urlDocumento ? (
                                <div className="flex flex-col gap-1">
                                  <Evidencia ruta={p.urlDocumento} compacta />
                                  <SubirDocumentoPlantilla
                                    idPlantilla={p.idPlantilla}
                                    onSubido={reloadPlantillas}
                                  />
                                </div>
                              ) : (
                                <SubirDocumentoPlantilla
                                  idPlantilla={p.idPlantilla}
                                  onSubido={reloadPlantillas}
                                  soloBoton
                                />
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={p.activo ? "success" : "outline"}>
                                {p.activo ? "Activa" : "Inactiva"}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  onClick={() => abrirPlantilla(p)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1.5 text-xs"
                                  disabled={togglingPlantilla === p.idPlantilla}
                                  onClick={() => togglePlantilla(p)}
                                >
                                  {togglingPlantilla === p.idPlantilla ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Power className="h-3.5 w-3.5" />
                                  )}
                                  {p.activo ? "Desactivar" : "Activar"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={periodoAbierto} onOpenChange={(o) => !o && setPeriodoAbierto(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{periodoEditando ? "Editar período" : "Nuevo período académico"}</DialogTitle>
            <DialogDescription>
              Define el nombre y el rango de fechas del período académico.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarPeriodo} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="nombre-periodo" className="text-sm font-medium text-foreground">
                Nombre del período
              </label>
              <Input
                id="nombre-periodo"
                placeholder="Ej.: 2026-II"
                value={formPeriodo.nombrePeriodo}
                onChange={(e) => setFormPeriodo({ ...formPeriodo, nombrePeriodo: e.target.value })}
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="fecha-inicio" className="text-sm font-medium text-foreground">
                  Fecha de inicio
                </label>
                <Input
                  id="fecha-inicio"
                  type="date"
                  value={formPeriodo.fechaInicio}
                  onChange={(e) => setFormPeriodo({ ...formPeriodo, fechaInicio: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="fecha-fin" className="text-sm font-medium text-foreground">
                  Fecha de fin
                </label>
                <Input
                  id="fecha-fin"
                  type="date"
                  value={formPeriodo.fechaFin}
                  onChange={(e) => setFormPeriodo({ ...formPeriodo, fechaFin: e.target.value })}
                  required
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPeriodoAbierto(false)}>
                Cancelar
              </Button>
              <Button type="submit">{periodoEditando ? "Guardar cambios" : "Crear período"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={plantillaAbierta} onOpenChange={(o) => !o && setPlantillaAbierta(false)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{plantillaEditando ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
            <DialogDescription>
              Registra un formato base del programa y su enlace al documento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarPlantilla} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="nombre-plantilla" className="text-sm font-medium text-foreground">
                Nombre
              </label>
              <Input
                id="nombre-plantilla"
                placeholder="Ej.: Bitácora semanal de servicio comunitario"
                value={formPlantilla.nombre}
                onChange={(e) => setFormPlantilla({ ...formPlantilla, nombre: e.target.value })}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="descripcion-plantilla" className="text-sm font-medium text-foreground">
                Descripción
              </label>
              <Input
                id="descripcion-plantilla"
                placeholder="Uso esperado del formato"
                value={formPlantilla.descripcion}
                onChange={(e) => setFormPlantilla({ ...formPlantilla, descripcion: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="tipo-plantilla" className="text-sm font-medium text-foreground">
                Tipo
              </label>
              <select
                id="tipo-plantilla"
                className={selectClass}
                value={formPlantilla.tipo}
                onChange={(e) => setFormPlantilla({ ...formPlantilla, tipo: e.target.value as TipoPlantilla })}
              >
                {TIPOS_PLANTILLA.map((t) => (
                  <option key={t} value={t}>
                    {tipoPlantillaLabels[t]}
                  </option>
                ))}
              </select>
            </div>

            {plantillaEditando && (
              <p className="text-xs text-muted-foreground">
                El archivo del documento se sube en la tabla de plantillas, una vez guardada.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlantillaAbierta(false)}>
                Cancelar
              </Button>
              <Button type="submit">{plantillaEditando ? "Guardar cambios" : "Crear plantilla"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
