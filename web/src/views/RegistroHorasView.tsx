"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Leaf,
  Loader2,
  Paperclip,
  Pencil,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Evidencia } from "@/components/Evidencia";
import { MetasPanel } from "@/components/MetasPanel";
import { MAX_EVIDENCIA_MB, motivoEvidenciaInvalida } from "@/lib/archivos";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import { estadoRegistro, formatearHoras, mostrarFecha } from "@/lib/registro";
import {
  esEditable,
  type DashboardPayload,
  type GrupoEstudiante,
  type Metas,
  type RegistroHoras,
  type TipoRegistro,
} from "@/lib/types";

const TIPOS_SERVICIO: { value: "social" | "ambiental"; label: string }[] = [
  { value: "social", label: "Social" },
  { value: "ambiental", label: "Ambiental" },
];

const CAMPO_EVIDENCIA = "evidencia";

/** Estado del formulario, compartido por el alta y la edición. */
interface Borrador {
  tipo: TipoRegistro;
  idGrupo: string;
  semana: string;
  fecha: string;
  horas: string;
  descripcion: string;
}

const BORRADOR_VACIO: Borrador = {
  tipo: "social",
  idGrupo: "",
  semana: "",
  fecha: "",
  horas: "",
  descripcion: "",
};

function borradorDesde(r: RegistroHoras): Borrador {
  return {
    tipo: r.tipo,
    idGrupo: "",
    semana: r.semana ? String(r.semana) : "",
    fecha: r.fecha,
    horas: String(r.horas),
    descripcion: r.descripcion,
  };
}

function mensajeDeError(err: unknown, porDefecto: string): string {
  const detalle = err as { response?: { data?: { message?: string } } };
  return detalle?.response?.data?.message ?? porDefecto;
}

export function RegistroHorasView({ tipo }: { tipo: "comunitario" | "servicio" }) {
  const usuario = useAuthStore((s) => s.usuario);
  const esEstudiante = usuario?.rol === "estudiante";
  const esComunitario = tipo === "comunitario";

  const { data, loading, error, reload } = useApiData<{ registros: RegistroHoras[] }>("/bitacoras/mias");
  const { data: datosGrupos } = useApiData<{ grupos: GrupoEstudiante[] }>("/bitacoras/grupos");
  const { data: datosMetas } = useApiData<{ metas: Metas }>("/bitacoras/metas");
  const { data: dash } = useApiData<DashboardPayload>("/dashboard", esEstudiante);
  const grupos = datosGrupos?.grupos ?? [];

  const [borrador, setBorrador] = useState<Borrador>({
    ...BORRADOR_VACIO,
    tipo: esComunitario ? "comunitario" : "social",
    fecha: new Date().toISOString().slice(0, 10),
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [quitarEvidencia, setQuitarEvidencia] = useState(false);

  const [editando, setEditando] = useState<string | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<string>("todos");

  // Precarga desde la URL al llegar de un enlace (dashboard o búsqueda global):
  // /bitacora?estado=pendiente o /bitacora?q=...
  // Se lee `window.location` en un efecto de una sola vez a propósito:
  // `useSearchParams` exigiría un Suspense boundary en toda la vista.
  /* eslint-disable react-hooks/set-state-in-effect -- carga única al montar */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const estado = params.get("estado");
    if (q) setBusqueda(q);
    if (estado === "pendiente" || estado === "corregir" || estado === "aprobado" || estado === "rechazado") {
      setFiltroEstado(estado);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const inputArchivo = useRef<HTMLInputElement>(null);

  if (!usuario) return null;

  if (!esEstudiante) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            {esComunitario ? "Bitácora Comunitario" : "Servicio Social y Ambiental"}
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            El registro de horas es realizado por los estudiantes. Como {usuario.rol}, revisa la
            información en el Dashboard y en{" "}
            {usuario.rol === "tutor" ? "el módulo de Validación." : "Gestión de Usuarios."}
          </p>
        </div>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              {esComunitario ? (
                <Clock className="h-7 w-7 text-muted-foreground" />
              ) : (
                <Leaf className="h-7 w-7 text-muted-foreground" />
              )}
            </div>
            <p className="font-semibold text-foreground mt-4">Acceso exclusivo para estudiantes</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              {usuario.rol === "tutor"
                ? "Los estudiantes registran aquí sus horas de trabajo directo y de impacto; tú las validas en el módulo de Validación."
                : "El registro y el seguimiento de horas se monitorea desde el Dashboard y el módulo de usuario correspondiente."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const filtrados = (data?.registros ?? []).filter((r) => {
    const coincideTipo = esComunitario ? r.tipo === "comunitario" : r.tipo === "social" || r.tipo === "ambiental";
    const coincideEstado = filtroEstado === "todos" || r.estado === filtroEstado;
    const q = busqueda.trim().toLowerCase();
    const coincideTexto = q === "" || r.descripcion.toLowerCase().includes(q);
    return coincideTipo && coincideEstado && coincideTexto;
  });

  const editandoRegistro = filtrados.find((r) => r.id === editando) ?? null;

  function limpiarFormulario() {
    setBorrador({
      ...BORRADOR_VACIO,
      tipo: esComunitario ? "comunitario" : "social",
      fecha: new Date().toISOString().slice(0, 10),
    });
    setArchivo(null);
    setQuitarEvidencia(false);
    setEditando(null);
    if (inputArchivo.current) inputArchivo.current.value = "";
  }

  function elegirArchivo(e: React.ChangeEvent<HTMLInputElement>) {
    const elegido = e.target.files?.[0] ?? null;
    setErrorForm(null);
    if (!elegido) {
      setArchivo(null);
      return;
    }
    const motivo = motivoEvidenciaInvalida(elegido, MAX_EVIDENCIA_MB);
    if (motivo) {
      setArchivo(null);
      setErrorForm(motivo);
      if (inputArchivo.current) inputArchivo.current.value = "";
      return;
    }
    setArchivo(elegido);
    setQuitarEvidencia(false);
  }

  function editar(r: RegistroHoras) {
    setEditando(r.id);
    setBorrador(borradorDesde(r));
    setArchivo(null);
    setQuitarEvidencia(false);
    setErrorForm(null);
    setExito(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validar(horasNum: number): string | null {
    if (!horasNum || horasNum <= 0 || horasNum > 24) {
      return "Indica una cantidad de horas válida (mayor a 0 y hasta 24).";
    }
    if (!borrador.fecha) return "Indica la fecha de la actividad.";
    if (borrador.descripcion.trim().length < 3) {
      return "Describe la actividad (mínimo 3 caracteres).";
    }
    if (esComunitario) {
      if (!borrador.idGrupo && !editandoRegistro) {
        return "Selecciona el grupo/proyecto del trabajo comunitario.";
      }
      const semanaNum = Number(borrador.semana);
      if (!borrador.semana || !semanaNum || semanaNum < 1 || semanaNum > 52) {
        return "Indica la semana de la actividad (1 a 52).";
      }
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorForm(null);
    setExito(null);

    const horasNum = Number(borrador.horas);
    const problema = validar(horasNum);
    if (problema) {
      setErrorForm(problema);
      return;
    }

    // Siempre `multipart`: la misma ruta acepta alta y edición, y así el archivo
    // viaja con el resto de los campos sin cambiar de modo según el caso.
    const cuerpo = new FormData();
    cuerpo.append("fecha", borrador.fecha);
    cuerpo.append("descripcion", borrador.descripcion.trim());
    cuerpo.append("horas", String(horasNum));
    if (esComunitario) {
      if (borrador.semana) cuerpo.append("semana", borrador.semana);
      if (borrador.idGrupo) cuerpo.append("idGrupo", borrador.idGrupo);
    }
    if (archivo) cuerpo.append(CAMPO_EVIDENCIA, archivo);
    if (quitarEvidencia) cuerpo.append("quitarEvidencia", "true");

    const enCorreccion = editandoRegistro?.estado === "corregir";

    setEnviando(true);
    try {
      if (editandoRegistro) {
        await api.patch(`/bitacoras/${editandoRegistro.id}`, cuerpo);
        setExito(
          enCorreccion
            ? "Corrección guardada. Tu registro vuelve a la lista de pendientes del tutor."
            : "Registro actualizado."
        );
      } else {
        cuerpo.append("tipo", borrador.tipo);
        await api.post("/bitacoras", cuerpo);
        setExito("Registro guardado correctamente. Queda pendiente de validación por tu tutor/a.");
      }
      limpiarFormulario();
      reload();
    } catch (err: unknown) {
      setErrorForm(mensajeDeError(err, "No se pudo guardar el registro."));
    } finally {
      setEnviando(false);
    }
  }

  async function confirmarBorrado(r: RegistroHoras) {
    if (!window.confirm("¿Retirar este registro? También se eliminará su evidencia.")) return;

    setBorrando(r.id);
    try {
      await api.delete(`/bitacoras/${r.id}`);
      if (editando === r.id) limpiarFormulario();
      reload();
    } catch (err: unknown) {
      setErrorForm(mensajeDeError(err, "No se pudo eliminar el registro."));
    } finally {
      setBorrando(null);
    }
  }

  const progreso = dash && dash.rol === "estudiante" ? dash : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          {esComunitario ? "Bitácora Comunitario" : "Servicio Social y Ambiental"}
        </h2>
        <p className="text-muted-foreground text-sm mt-1">
          {esComunitario
            ? "Registra tus horas de trabajo directo en tu proyecto (meta 90h)."
            : "Registra tus horas de impacto social y ambiental (meta 30h)."}
        </p>
      </div>

      {datosMetas && progreso && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Mi avance</CardTitle>
          </CardHeader>
          <CardContent>
            <MetasPanel
              horasDirectas={progreso.horasDirectas}
              horasImpacto={progreso.horasImpacto}
              metas={datosMetas.metas}
            />
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {esComunitario ? (
              <Clock className="h-4 w-4 text-iunav-blue" />
            ) : (
              <Leaf className="h-4 w-4 text-emerald-600" />
            )}
            {editandoRegistro ? "Corregir registro" : "Registrar horas"}
            {editandoRegistro && (
              <span className="text-xs font-normal text-muted-foreground">
                (volvió a “{estadoRegistro[editandoRegistro.estado].label}”)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tus grupos activos:{" "}
            {grupos.length === 0
              ? "no perteneces a ningún proyecto activo."
              : grupos.map((g) => g.nombreProyecto).join(" • ")}
          </p>

          {editandoRegistro && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Estás corrigiendo un registro que tu tutor/a devolvió.
              {editandoRegistro.comentarioTutor && (
                <span className="font-medium">Comentario: {editandoRegistro.comentarioTutor}</span>
              )}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1"
                onClick={limpiarFormulario}
              >
                <X className="h-3 w-3" />
                Cancelar
              </Button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {esComunitario ? (
                <div className="space-y-1.5">
                  <label htmlFor="grupo" className="text-sm font-medium text-foreground">
                    Grupo / Proyecto
                  </label>
                  <select
                    id="grupo"
                    value={borrador.idGrupo}
                    onChange={(e) => setBorrador((b) => ({ ...b, idGrupo: e.target.value }))}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">
                      {editandoRegistro ? "Mantener el actual" : "Selecciona un grupo..."}
                    </option>
                    {grupos.map((g) => (
                      <option key={g.idGrupo} value={g.idGrupo}>
                        {g.nombreProyecto}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label htmlFor="subtipo" className="text-sm font-medium text-foreground">
                    Tipo de servicio
                  </label>
                  <select
                    id="subtipo"
                    value={borrador.tipo === "comunitario" ? "social" : borrador.tipo}
                    onChange={(e) =>
                      setBorrador((b) => ({ ...b, tipo: e.target.value as "social" | "ambiental" }))
                    }
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {TIPOS_SERVICIO.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {esComunitario && (
                <div className="space-y-1.5">
                  <label htmlFor="semana" className="text-sm font-medium text-foreground">
                    Semana
                  </label>
                  <Input
                    id="semana"
                    type="number"
                    min={1}
                    max={52}
                    placeholder="1-52"
                    value={borrador.semana}
                    onChange={(e) => setBorrador((b) => ({ ...b, semana: e.target.value }))}
                    required
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="fecha" className="text-sm font-medium text-foreground">
                  Fecha de la actividad
                </label>
                <Input
                  id="fecha"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={borrador.fecha}
                  onChange={(e) => setBorrador((b) => ({ ...b, fecha: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="horas" className="text-sm font-medium text-foreground">
                  Horas
                </label>
                <Input
                  id="horas"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="24"
                  placeholder="Ej. 6.5"
                  value={borrador.horas}
                  onChange={(e) => setBorrador((b) => ({ ...b, horas: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="descripcion" className="text-sm font-medium text-foreground">
                Descripción de la actividad
              </label>
              <textarea
                id="descripcion"
                rows={3}
                placeholder="Describe qué realizaste en la actividad..."
                value={borrador.descripcion}
                onChange={(e) => setBorrador((b) => ({ ...b, descripcion: e.target.value }))}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="evidencia" className="text-sm font-medium text-foreground">
                Evidencia (opcional)
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={inputArchivo}
                  id="evidencia"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={elegirArchivo}
                  className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-foreground hover:file:bg-primary/20 sm:w-auto"
                />
                {archivo && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Paperclip className="h-3 w-3" />
                    {archivo.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                JPG, PNG, WebP o PDF de hasta {MAX_EVIDENCIA_MB} MB.
              </p>

              {editandoRegistro?.evidenciaUrl && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={quitarEvidencia}
                    onChange={(e) => {
                      setQuitarEvidencia(e.target.checked);
                      if (e.target.checked) {
                        setArchivo(null);
                        if (inputArchivo.current) inputArchivo.current.value = "";
                      }
                    }}
                  />
                  Quitar la evidencia actual
                </label>
              )}
            </div>

            {errorForm && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                {errorForm}
              </div>
            )}
            {exito && (
              <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                {exito}
              </div>
            )}

            <div className="flex gap-2">
              <Button type="submit" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    {editandoRegistro ? "Guardar corrección" : "Guardar registro"}
                  </>
                )}
              </Button>
              {editandoRegistro && (
                <Button type="button" variant="outline" onClick={limpiarFormulario}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Mis registros ({filtrados.length})</CardTitle>
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por descripción..."
                className="pl-9 h-8 text-sm"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="corregir">Por corregir</option>
              <option value="aprobado">Aprobado</option>
              <option value="rechazado">Rechazado</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando registros...</span>
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
              {busqueda.trim() !== "" || filtroEstado !== "todos"
                ? "No se encontraron registros con los filtros aplicados."
                : <>Aún no has registrado{" "}
                    {esComunitario ? "horas de bitácora comunitaria" : "servicios sociales o ambientales"}.</>}
            </p>
          ) : (
            <div className="space-y-3">
              {filtrados.map((r) => {
                const editable = esEditable(r);
                return (
                  <div key={r.id} className="border rounded-lg p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={estadoRegistro[r.estado].variant}>
                          {estadoRegistro[r.estado].label}
                        </Badge>
                        {!esComunitario && (
                          <Badge variant="secondary">
                            {r.tipo === "social" ? "Social" : "Ambiental"}
                          </Badge>
                        )}
                        {r.semana && (
                          <span className="text-xs text-muted-foreground">Semana {r.semana}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {mostrarFecha(r.fecha)}
                        </span>
                        <span className="text-xs font-semibold text-iunav-blue">
                          {formatearHoras(r.horas)}
                        </span>
                      </div>
                      {r.proyecto && (
                        <span className="text-xs text-muted-foreground">{r.proyecto}</span>
                      )}
                    </div>

                    <p className="text-sm text-foreground mt-2 leading-snug">{r.descripcion}</p>

                    {r.comentarioTutor && (
                      <p className="text-xs text-sky-700 mt-2 italic">
                        Comentario del tutor: {r.comentarioTutor}
                      </p>
                    )}

                    <Evidencia ruta={r.evidenciaUrl} />

                    {editable && (
                      <div className="mt-3 flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => editar(r)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {r.estado === "corregir" ? "Corregir" : "Editar"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="gap-1.5 text-red-600 hover:bg-red-50"
                          disabled={borrando === r.id}
                          onClick={() => confirmarBorrado(r)}
                        >
                          {borrando === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Retirar
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}