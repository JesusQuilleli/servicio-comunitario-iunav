"use client";

import { useEffect, useMemo, useState } from "react";
import {
  FolderKanban,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Plus,
  Search,
  Pencil,
  Eye,
  UserMinus,
  FileText,
  Presentation,
  CheckCircle2,
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
import { Evidencia } from "@/components/Evidencia";
import { SubirDocumentosGrupo } from "@/components/SubirDocumentosGrupo";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import { formatearHoras } from "@/lib/registro";
import {
  ESTADOS_FINAL,
  ESTADOS_GRUPO,
  estadoFinalLabels,
  estadoGrupoLabels,
  type DetalleGrupo,
  type EstadoFinal,
  type EstadoGrupo,
  type Grupo,
  type PeriodoAcademico,
  type Usuario,
} from "@/lib/types";

type BadgeVariant = "info" | "warning" | "success" | "danger";

const estadoGrupoBadge: Record<EstadoGrupo, BadgeVariant> = {
  en_curso: "info",
  pendiente_aprobacion: "warning",
  finalizado: "success",
  suspendido: "danger",
};

const estadoFinalBadge: Record<EstadoFinal, BadgeVariant> = {
  en_curso: "info",
  aprobado: "success",
  reprobado: "danger",
};

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function mensajeError(err: unknown, porDefecto: string): string {
  return (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? porDefecto;
}

function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

interface FormGrupo {
  nombreProyecto: string;
  periodoId: string;
  tutorId: string;
  coordinadorId: string;
  estado: EstadoGrupo;
  integrantesIds: string[];
}

const FORMULARIO_VACIO: FormGrupo = {
  nombreProyecto: "",
  periodoId: "",
  tutorId: "",
  coordinadorId: "",
  estado: "en_curso",
  integrantesIds: [],
};

export function ProyectosView() {
  const usuario = useAuthStore((s) => s.usuario);
  const puedeGestionar = usuario?.rol === "admin" || usuario?.rol === "coordinador";
  const esTutor = usuario?.rol === "tutor";
  // Los documentos del proyecto los sube quien lo gestiona, y tambien el tutor
  // del grupo (el servidor lo comprueba; esto solo evita mostrar el formulario).
  const puedeSubirDocumentos = puedeGestionar || esTutor;

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<EstadoGrupo | "todos">("todos");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("todos");

  // Precarga desde la URL cuando se llega de un enlace (dashboard o búsqueda
  // global): /proyectos?estado=pendiente_aprobacion&q=...
  // Se lee `window.location` en un efecto de una sola vez a propósito:
  // `useSearchParams` exigiría un Suspense boundary en toda la vista.
  /* eslint-disable react-hooks/set-state-in-effect -- carga única al montar */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const estado = params.get("estado");
    if (q) setBusqueda(q);
    if (estado && (ESTADOS_GRUPO as readonly string[]).includes(estado)) {
      setFiltroEstado(estado as EstadoGrupo);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (filtroEstado !== "todos") params.set("estado", filtroEstado);
    if (filtroPeriodo !== "todos") params.set("periodo", filtroPeriodo);
    const query = params.toString();
    return `/grupos${query ? `?${query}` : ""}`;
  }, [filtroEstado, filtroPeriodo]);

  const { data, loading, error, reload } = useApiData<{ grupos: Grupo[] }>(url);
  const { data: datosPeriodos } = useApiData<{ periodos: PeriodoAcademico[] }>("/periodos");
  const { data: datosUsuarios } = useApiData<{ usuarios: Usuario[] }>("/usuarios", puedeGestionar);

  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const grupos = useMemo(() => data?.grupos ?? [], [data]);
  const periodos = useMemo(() => datosPeriodos?.periodos ?? [], [datosPeriodos]);
  const usuarios = useMemo(() => datosUsuarios?.usuarios ?? [], [datosUsuarios]);

  const tutores = useMemo(
    () => usuarios.filter((u) => u.rol === "tutor" && u.activo),
    [usuarios]
  );
  const coordinadores = useMemo(
    () => usuarios.filter((u) => (u.rol === "coordinador" || u.rol === "admin") && u.activo),
    [usuarios]
  );
  const estudiantes = useMemo(
    () => usuarios.filter((u) => u.rol === "estudiante" && u.activo),
    [usuarios]
  );

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (q === "") return grupos;
    return grupos.filter(
      (g) =>
        g.nombreProyecto.toLowerCase().includes(q) ||
        (g.tutorNombre ?? "").toLowerCase().includes(q) ||
        (g.periodo ?? "").toLowerCase().includes(q)
    );
  }, [grupos, busqueda]);

  // ---------------------------------------------------------------
  // Detalle del proyecto
  // ---------------------------------------------------------------
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nuevosIntegrantes, setNuevosIntegrantes] = useState<string[]>([]);

  const {
    data: datosDetalle,
    loading: cargandoDetalle,
    error: errorDetalle,
    reload: reloadDetalle,
  } = useApiData<{ grupo: DetalleGrupo }>(detalleId ? `/grupos/${detalleId}` : "", detalleId !== null);

  const detalle = datosDetalle?.grupo ?? null;

  const abrirDetalle = (idGrupo: string) => {
    setDetalleId(idGrupo);
    setNuevosIntegrantes([]);
    setErrorAccion(null);
  };

  const cerrarDetalle = () => {
    setDetalleId(null);
    setOcupado(null);
    setErrorAccion(null);
  };

  const ejecutarDetalle = async (
    clave: string,
    accion: () => Promise<unknown>,
    mensaje: string
  ): Promise<boolean> => {
    setOcupado(clave);
    setErrorAccion(null);
    try {
      await accion();
      setExito(mensaje);
      reloadDetalle();
      reload();
      return true;
    } catch (err: unknown) {
      setErrorAccion(mensajeError(err, "No se pudo completar la operación."));
      return false;
    } finally {
      setOcupado(null);
    }
  };

  const cambiarEstadoProyecto = async (estado: EstadoGrupo) => {
    if (!detalle) return;
    await ejecutarDetalle(
      "estado",
      () => api.patch(`/grupos/${detalle.idGrupo}/estado`, { estado }),
      `Estado del proyecto actualizado a "${estadoGrupoLabels[estado]}".`
    );
  };

  const cambiarEstadoFinal = async (integrante: string, estadoFinal: EstadoFinal) => {
    if (!detalle) return;
    await ejecutarDetalle(
      `final-${integrante}`,
      () => api.patch(`/grupos/${detalle.idGrupo}/integrantes/${integrante}`, { estadoFinal }),
      "Estado final del integrante actualizado."
    );
  };

  const quitarIntegrante = async (integrante: { idUsuario: string; nombreCompleto: string }) => {
    if (!detalle) return;
    await ejecutarDetalle(
      `quitar-${integrante.idUsuario}`,
      () => api.delete(`/grupos/${detalle.idGrupo}/integrantes/${integrante.idUsuario}`),
      `${integrante.nombreCompleto} fue removido del grupo.`
    );
  };

  const agregarIntegrantes = async () => {
    if (!detalle || nuevosIntegrantes.length === 0) return;
    const total = nuevosIntegrantes.length;
    const ok = await ejecutarDetalle(
      "agregar",
      () => api.post(`/grupos/${detalle.idGrupo}/integrantes`, { estudiantesIds: nuevosIntegrantes }),
      `${total} estudiante(s) agregados al grupo.`
    );
    if (ok) setNuevosIntegrantes([]);
  };

  const candidatosIntegrante = useMemo(() => {
    if (!detalle) return [];
    const yaIntegrantes = new Set(detalle.listaIntegrantes.map((i) => i.idUsuario));
    return estudiantes.filter((e) => !yaIntegrantes.has(e.idUsuario));
  }, [detalle, estudiantes]);

  // ---------------------------------------------------------------
  // Alta / edición
  // ---------------------------------------------------------------
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [form, setForm] = useState<FormGrupo>(FORMULARIO_VACIO);
  const [busquedaEstudiante, setBusquedaEstudiante] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);

  const abrirNuevo = () => {
    setEditandoId(null);
    setForm({
      ...FORMULARIO_VACIO,
      periodoId: periodos[0] ? String(periodos[0].idPeriodo) : "",
    });
    setBusquedaEstudiante("");
    setErrorForm(null);
    setFormAbierto(true);
  };

  const abrirEdicion = async (idGrupo: string) => {
    setEditandoId(idGrupo);
    setErrorForm(null);
    setFormAbierto(true);
    try {
      const { data: res } = await api.get<{ grupo: DetalleGrupo }>(`/grupos/${idGrupo}`);
      const g = res.grupo;
      setForm({
        nombreProyecto: g.nombreProyecto,
        periodoId: g.periodoId ? String(g.periodoId) : "",
        tutorId: g.tutorId ?? "",
        coordinadorId: g.coordinadorId ?? "",
        estado: g.estado,
        integrantesIds: g.listaIntegrantes.map((i) => i.idUsuario),
      });
    } catch (err: unknown) {
      setErrorForm(mensajeError(err, "No se pudo cargar el proyecto."));
      setFormAbierto(false);
    }
  };

  const cerrarFormulario = () => {
    if (enviando) return;
    setFormAbierto(false);
    setEditandoId(null);
    setForm(FORMULARIO_VACIO);
    setErrorForm(null);
  };

  const candidatosFormulario = useMemo(() => {
    const q = busquedaEstudiante.trim().toLowerCase();
    if (q === "") return estudiantes;
    return estudiantes.filter(
      (e) => e.nombreCompleto.toLowerCase().includes(q) || e.cedula.toLowerCase().includes(q)
    );
  }, [estudiantes, busquedaEstudiante]);

  const alternarIntegrante = (id: string) => {
    setForm((f) => ({
      ...f,
      integrantesIds: f.integrantesIds.includes(id)
        ? f.integrantesIds.filter((x) => x !== id)
        : [...f.integrantesIds, id],
    }));
  };

  const guardarGrupo = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setErrorForm(null);
    try {
      const payload = {
        nombreProyecto: form.nombreProyecto.trim(),
        periodoId: form.periodoId ? Number(form.periodoId) : null,
        tutorId: form.tutorId || null,
        coordinadorId: form.coordinadorId || null,
        estado: form.estado,
        integrantesIds: form.integrantesIds,
      };

      if (editandoId) {
        await api.patch(`/grupos/${editandoId}`, payload);
        setExito(`Proyecto "${payload.nombreProyecto}" actualizado.`);
      } else {
        await api.post("/grupos", payload);
        setExito(`Proyecto "${payload.nombreProyecto}" creado correctamente.`);
      }

      reload();
      setFormAbierto(false);
      setForm(FORMULARIO_VACIO);
      setEditandoId(null);
    } catch (err: unknown) {
      setErrorForm(mensajeError(err, "No se pudo guardar el proyecto."));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Grupos y Proyectos</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {esTutor
              ? "Consulta los proyectos que tutorizas y los integrantes de cada equipo."
              : "Crea los grupos de trabajo, asigna tutores, integrantes y controla el material del proyecto."}
          </p>
        </div>
        {puedeGestionar && (
          <Button onClick={abrirNuevo} className="gap-1.5 self-start">
            <Plus className="h-4 w-4" />
            Nuevo proyecto
          </Button>
        )}
      </div>

      {exito && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span className="flex-1">{exito}</span>
          <button onClick={() => setExito(null)} className="text-emerald-700/70 hover:text-emerald-700">
            ×
          </button>
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <FolderKanban className="h-4 w-4 text-iunav-blue" />
            Proyectos ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por proyecto, tutor o período..."
                className="pl-9"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select
              value={filtroPeriodo}
              onChange={(e) => setFiltroPeriodo(e.target.value)}
              className={selectClass}
              aria-label="Filtrar por período"
            >
              <option value="todos">Todos los períodos</option>
              {periodos.map((p) => (
                <option key={p.idPeriodo} value={p.idPeriodo}>
                  {p.nombrePeriodo}
                </option>
              ))}
            </select>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value as EstadoGrupo | "todos")}
              className={selectClass}
              aria-label="Filtrar por estado"
            >
              <option value="todos">Todos los estados</option>
              {ESTADOS_GRUPO.map((e) => (
                <option key={e} value={e}>
                  {estadoGrupoLabels[e]}
                </option>
              ))}
            </select>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando proyectos...</span>
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
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No se encontraron proyectos que coincidan con los filtros aplicados.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Proyecto</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Período</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Tutor</th>
                    <th className="text-center font-medium text-muted-foreground px-4 py-3">
                      Integrantes
                    </th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Horas</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Estado</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((g) => (
                    <tr
                      key={g.idGrupo}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{g.nombreProyecto}</span>
                          {g.proyectoEscritoUrl && g.diapositivasUrl && (
                            <span title="Material completo">
                              <FileText className="h-3.5 w-3.5 text-emerald-600" />
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {g.coordinadorNombre ? `Coord. ${g.coordinadorNombre}` : "Sin coordinador"}
                        </span>
                      </td>
                      <td className="px-4 py-3">{g.periodo ?? "—"}</td>
                      <td className="px-4 py-3">{g.tutorNombre ?? "Sin tutor"}</td>
                      <td className="px-4 py-3 text-center">{g.integrantes}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col leading-tight">
                          <span className="text-emerald-700">
                            {formatearHoras(g.horasAprobadas)} aprobadas
                          </span>
                          {g.horasPendientes > 0 && (
                            <span className="text-xs text-amber-700">
                              {formatearHoras(g.horasPendientes)} pendientes
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={estadoGrupoBadge[g.estado]}>{estadoGrupoLabels[g.estado]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5 text-xs"
                            onClick={() => abrirDetalle(g.idGrupo)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            Ver
                          </Button>
                          {puedeGestionar && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => void abrirEdicion(g.idGrupo)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </Button>
                          )}
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

      {/* Detalle del proyecto */}
      <Dialog open={detalleId !== null} onOpenChange={(o) => !o && cerrarDetalle()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detalle?.nombreProyecto ?? "Proyecto"}</DialogTitle>
            <DialogDescription>
              {detalle
                ? `${detalle.periodo ?? "Sin período"} · ${detalle.integrantes} integrante(s)`
                : "Cargando información del proyecto..."}
            </DialogDescription>
          </DialogHeader>

          {cargandoDetalle ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
            </div>
          ) : errorDetalle ? (
            <div className="flex flex-col items-center py-8 text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground">{errorDetalle}</p>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={reloadDetalle}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : detalle ? (
            <div className="space-y-5">
              {errorAccion && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {errorAccion}
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tutor</p>
                  <p className="font-medium">{detalle.tutorNombre ?? "Sin tutor asignado"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Coordinador</p>
                  <p className="font-medium">{detalle.coordinadorNombre ?? "Sin coordinador"}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Horas aprobadas</p>
                  <p className="font-medium text-emerald-700">
                    {formatearHoras(detalle.horasAprobadas)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Horas pendientes de validar</p>
                  <p className="font-medium text-amber-700">
                    {formatearHoras(detalle.horasPendientes)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">Material del proyecto</p>
                <div className="grid sm:grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-iunav-blue shrink-0" />
                      <span className="font-medium">Proyecto escrito</span>
                    </div>
                    {detalle.proyectoEscritoUrl ? (
                      <Evidencia ruta={detalle.proyectoEscritoUrl} />
                    ) : (
                      <p className="text-muted-foreground text-xs mt-1">Pendiente de subir</p>
                    )}
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Presentation className="h-4 w-4 text-iunav-blue shrink-0" />
                      <span className="font-medium">Diapositivas</span>
                    </div>
                    {detalle.diapositivasUrl ? (
                      <Evidencia ruta={detalle.diapositivasUrl} />
                    ) : (
                      <p className="text-muted-foreground text-xs mt-1">Pendiente de subir</p>
                    )}
                  </div>
                </div>

                {puedeSubirDocumentos && (
                  <SubirDocumentosGrupo idGrupo={detalle.idGrupo} onSubido={reloadDetalle} />
                )}
              </div>

              {puedeGestionar && (
                <div className="space-y-1.5">
                  <label htmlFor="estado-proyecto" className="text-sm font-medium text-foreground">
                    Estado del proyecto
                  </label>
                  <select
                    id="estado-proyecto"
                    className={selectClass}
                    value={detalle.estado}
                    disabled={ocupado === "estado"}
                    onChange={(e) => void cambiarEstadoProyecto(e.target.value as EstadoGrupo)}
                  >
                    {ESTADOS_GRUPO.map((e) => (
                      <option key={e} value={e}>
                        {estadoGrupoLabels[e]}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Integrantes ({detalle.listaIntegrantes.length})
                </p>
                {detalle.listaIntegrantes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este proyecto aún no tiene estudiantes asignados.
                  </p>
                ) : (
                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left font-medium text-muted-foreground px-3 py-2">
                            Estudiante
                          </th>
                          <th className="text-left font-medium text-muted-foreground px-3 py-2">
                            Cédula
                          </th>
                          <th className="text-left font-medium text-muted-foreground px-3 py-2">
                            Horas
                          </th>
                          <th className="text-left font-medium text-muted-foreground px-3 py-2">
                            Estado final
                          </th>
                          {puedeGestionar && (
                            <th className="text-right font-medium text-muted-foreground px-3 py-2">
                              Acciones
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.listaIntegrantes.map((i) => (
                          <tr key={i.idUsuario} className="border-b last:border-0">
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-iunav-blue/10 text-[10px] font-bold text-iunav-blue">
                                  {iniciales(i.nombreCompleto)}
                                </span>
                                <span className="font-medium">{i.nombreCompleto}</span>
                                {!i.activo && <Badge variant="danger">Inactivo</Badge>}
                              </div>
                            </td>
                            <td className="px-3 py-2">{i.cedula}</td>
                            <td className="px-3 py-2">
                              <span className="text-emerald-700">
                                {formatearHoras(i.horasAprobadas)}
                              </span>
                              {i.horasPendientes > 0 && (
                                <span className="text-xs text-amber-700">
                                  {" "}
                                  + {formatearHoras(i.horasPendientes)} pend.
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {puedeGestionar ? (
                                <select
                                  className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                  value={i.estadoFinal ?? "en_curso"}
                                  disabled={ocupado === `final-${i.idUsuario}`}
                                  onChange={(e) =>
                                    void cambiarEstadoFinal(i.idUsuario, e.target.value as EstadoFinal)
                                  }
                                >
                                  {ESTADOS_FINAL.map((e) => (
                                    <option key={e} value={e}>
                                      {estadoFinalLabels[e]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <Badge variant={estadoFinalBadge[i.estadoFinal ?? "en_curso"]}>
                                  {estadoFinalLabels[i.estadoFinal ?? "en_curso"]}
                                </Badge>
                              )}
                            </td>
                            {puedeGestionar && (
                              <td className="px-3 py-2 text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700"
                                  disabled={ocupado === `quitar-${i.idUsuario}`}
                                  onClick={() => void quitarIntegrante(i)}
                                >
                                  {ocupado === `quitar-${i.idUsuario}` ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <UserMinus className="h-3.5 w-3.5" />
                                  )}
                                  Quitar
                                </Button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {puedeGestionar && candidatosIntegrante.length > 0 && (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-sm font-semibold text-foreground">Agregar estudiantes</p>
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                    {candidatosIntegrante.map((e) => (
                      <label
                        key={e.idUsuario}
                        className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-input accent-[#1b3a5c]"
                          checked={nuevosIntegrantes.includes(e.idUsuario)}
                          onChange={() =>
                            setNuevosIntegrantes((prev) =>
                              prev.includes(e.idUsuario)
                                ? prev.filter((x) => x !== e.idUsuario)
                                : [...prev, e.idUsuario]
                            )
                          }
                        />
                        <span className="flex-1 truncate">{e.nombreCompleto}</span>
                        <span className="text-xs text-muted-foreground">{e.cedula}</span>
                      </label>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={nuevosIntegrantes.length === 0 || ocupado === "agregar"}
                    onClick={() => void agregarIntegrantes()}
                  >
                    {ocupado === "agregar" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Agregar {nuevosIntegrantes.length > 0 ? `(${nuevosIntegrantes.length})` : ""}
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={cerrarDetalle}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alta / edición */}
      <Dialog open={formAbierto} onOpenChange={(o) => !o && cerrarFormulario()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editandoId ? "Editar proyecto" : "Nuevo proyecto"}</DialogTitle>
            <DialogDescription>
              Define el equipo, el tutor responsable y los integrantes del grupo de trabajo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={guardarGrupo} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="nombre-proyecto" className="text-sm font-medium text-foreground">
                Nombre del proyecto
              </label>
              <Input
                id="nombre-proyecto"
                placeholder="Ej..Red de datos para la escuela rural"
                value={form.nombreProyecto}
                onChange={(e) => setForm({ ...form, nombreProyecto: e.target.value })}
                required
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="periodo" className="text-sm font-medium text-foreground">
                  Período académico
                </label>
                <select
                  id="periodo"
                  className={selectClass}
                  value={form.periodoId}
                  onChange={(e) => setForm({ ...form, periodoId: e.target.value })}
                >
                  <option value="">Sin período</option>
                  {periodos.map((p) => (
                    <option key={p.idPeriodo} value={p.idPeriodo}>
                      {p.nombrePeriodo}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="estado-proyecto-form" className="text-sm font-medium text-foreground">
                  Estado
                </label>
                <select
                  id="estado-proyecto-form"
                  className={selectClass}
                  value={form.estado}
                  onChange={(e) => setForm({ ...form, estado: e.target.value as EstadoGrupo })}
                >
                  {ESTADOS_GRUPO.map((e) => (
                    <option key={e} value={e}>
                      {estadoGrupoLabels[e]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="tutor" className="text-sm font-medium text-foreground">
                  Tutor responsable
                </label>
                <select
                  id="tutor"
                  className={selectClass}
                  value={form.tutorId}
                  onChange={(e) => setForm({ ...form, tutorId: e.target.value })}
                >
                  <option value="">Sin tutor</option>
                  {tutores.map((t) => (
                    <option key={t.idUsuario} value={t.idUsuario}>
                      {t.nombreCompleto}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="coordinador" className="text-sm font-medium text-foreground">
                  Coordinador
                </label>
                <select
                  id="coordinador"
                  className={selectClass}
                  value={form.coordinadorId}
                  onChange={(e) => setForm({ ...form, coordinadorId: e.target.value })}
                >
                  <option value="">Sin coordinador</option>
                  {coordinadores.map((c) => (
                    <option key={c.idUsuario} value={c.idUsuario}>
                      {c.nombreCompleto}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Los documentos no se pegan como URL: se suben al proyecto ya
                creado, porque es un endpoint aparte. */}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="buscar-estudiante" className="text-sm font-medium text-foreground">
                  Integrantes ({form.integrantesIds.length})
                </label>
                <div className="relative w-48">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    id="buscar-estudiante"
                    placeholder="Filtrar..."
                    className="pl-8 h-8 text-xs"
                    value={busquedaEstudiante}
                    onChange={(e) => setBusquedaEstudiante(e.target.value)}
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto rounded-lg border p-2 space-y-1 scrollbar-thin">
                {candidatosFormulario.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    {puedeGestionar
                      ? "No hay estudiantes activos para asignar."
                      : "Solo el administrador y la coordinación pueden asignar integrantes."}
                  </p>
                ) : (
                  candidatosFormulario.map((e) => (
                    <label
                      key={e.idUsuario}
                      className="flex items-center gap-2 text-sm rounded-md px-2 py-1.5 hover:bg-muted/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-[#1b3a5c]"
                        checked={form.integrantesIds.includes(e.idUsuario)}
                        onChange={() => alternarIntegrante(e.idUsuario)}
                      />
                      <span className="flex-1 truncate">{e.nombreCompleto}</span>
                      <span className="text-xs text-muted-foreground">{e.cedula}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {errorForm && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorForm}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={cerrarFormulario} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    {editandoId ? "Guardar cambios" : "Crear proyecto"}
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
