"use client";

import { useState } from "react";
import { Clock, Leaf, Loader2, RefreshCw, AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import { estadoRegistro, formatearHoras, mostrarFecha } from "@/lib/registro";
import type { GrupoEstudiante, RegistroHoras, TipoRegistro } from "@/lib/types";

const TIPOS_SERVICIO: { value: "social" | "ambiental"; label: string }[] = [
  { value: "social", label: "Social" },
  { value: "ambiental", label: "Ambiental" },
];

export function RegistroHorasView({ tipo }: { tipo: "comunitario" | "servicio" }) {
  const usuario = useAuthStore((s) => s.usuario);
  const esEstudiante = usuario?.rol === "estudiante";

  const { data, loading, error, reload } = useApiData<{ registros: RegistroHoras[] }>("/bitacoras/mias");
  const { data: datosGrupos } = useApiData<{ grupos: GrupoEstudiante[] }>("/bitacoras/grupos");
  const grupos = datosGrupos?.grupos ?? [];

  const esComunitario = tipo === "comunitario";
  const filtrados = (data?.registros ?? []).filter((r) =>
    esComunitario ? r.tipo === "comunitario" : r.tipo === "social" || r.tipo === "ambiental"
  );

  const [subTipo, setSubTipo] = useState<"social" | "ambiental">("social");
  const [idGrupo, setIdGrupo] = useState("");
  const [semana, setSemana] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [horas, setHoras] = useState("");
  const [descripcion, setDescripcion] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [errorForm, setErrorForm] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

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
            información en el Dashboard y en {usuario.rol === "tutor" ? "el módulo de Validación." : "Gestión de Usuarios."}
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorForm(null);
    setExito(null);

    const horasNum = Number(horas);
    if (!horasNum || horasNum <= 0 || horasNum > 24) {
      setErrorForm("Indica una cantidad de horas válida (mayor a 0 y hasta 24).");
      return;
    }

    const payload: {
      tipo: TipoRegistro;
      fecha: string;
      horas: number;
      descripcion: string;
      semana?: number;
      idGrupo?: string;
    } = {
      tipo: esComunitario ? "comunitario" : subTipo,
      fecha,
      horas: horasNum,
      descripcion: descripcion.trim(),
    };
    if (esComunitario) {
      if (!idGrupo) {
        setErrorForm("Selecciona el grupo/proyecto del trabajo comunitario.");
        return;
      }
      const semanaNum = Number(semana);
      if (!semanaNum || semanaNum < 1 || semanaNum > 52) {
        setErrorForm("Indica la semana de la actividad (1 a 52).");
        return;
      }
      payload.semana = semanaNum;
      payload.idGrupo = idGrupo;
    }

    setEnviando(true);
    try {
      await api.post("/bitacoras", payload);
      setExito("Registro guardado correctamente. Queda pendiente de validación por tu tutor/a.");
      setHoras("");
      setDescripcion("");
      setSemana("");
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorForm(msg ?? "No se pudo guardar el registro.");
    } finally {
      setEnviando(false);
    }
  };

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

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            {esComunitario ? <Clock className="h-4 w-4 text-iunav-blue" /> : <Leaf className="h-4 w-4 text-emerald-600" />}
            Registrar horas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tus grupos activos:{" "}
            {grupos.length === 0
              ? "no perteneces a ningún proyecto activo."
              : grupos.map((g) => g.nombreProyecto).join(" • ")}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {esComunitario ? (
                <div className="space-y-1.5">
                  <label htmlFor="grupo" className="text-sm font-medium text-foreground">
                    Grupo / Proyecto
                  </label>
                  <select
                    id="grupo"
                    value={idGrupo}
                    onChange={(e) => setIdGrupo(e.target.value)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">Selecciona un grupo...</option>
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
                    value={subTipo}
                    onChange={(e) => setSubTipo(e.target.value as "social" | "ambiental")}
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
                    value={semana}
                    onChange={(e) => setSemana(e.target.value)}
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
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
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
                  value={horas}
                  onChange={(e) => setHoras(e.target.value)}
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
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                required
              />
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

            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar registro
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Mis registros ({filtrados.length})
          </CardTitle>
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
              Aún no has registrado {esComunitario ? "horas de bitácora comunitaria" : "servicios sociales o ambientales"}.
            </p>
          ) : (
            <div className="space-y-3">
              {filtrados.map((r) => (
                <div key={r.id} className="border rounded-lg p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={estadoRegistro[r.estado].variant}>{estadoRegistro[r.estado].label}</Badge>
                      {!esComunitario && (
                        <Badge variant="secondary">{r.tipo === "social" ? "Social" : "Ambiental"}</Badge>
                      )}
                      {r.semana && <span className="text-xs text-muted-foreground">Semana {r.semana}</span>}
                      <span className="text-xs text-muted-foreground">{mostrarFecha(r.fecha)}</span>
                      <span className="text-xs font-semibold text-iunav-blue">{formatearHoras(r.horas)}</span>
                    </div>
                    {r.proyecto && <span className="text-xs text-muted-foreground">{r.proyecto}</span>}
                  </div>
                  <p className="text-sm text-foreground mt-2 leading-snug">{r.descripcion}</p>
                  {r.comentarioTutor && (
                    <p className="text-xs text-sky-700 mt-2 italic">Comentario del tutor: {r.comentarioTutor}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}