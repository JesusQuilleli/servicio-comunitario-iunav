import { FolderKanban, CheckCircle, AlertTriangle, TrendingUp, Image as ImageIcon, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useApiData } from "@/lib/useApiData";
import { RUTAS } from "@/lib/rutas";
import type { DashEstudiante, Usuario } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  comunitario: "Comunitario",
  social: "Social",
  ambiental: "Ambiental",
};

const estadoColor: Record<string, "warning" | "success" | "danger" | "outline"> = {
  pendiente: "warning",
  corregir: "outline",
  aprobado: "success",
  rechazado: "danger",
};

/** Cada tipo de registro vive en su propia sección del panel. */
function rutaDeTipo(tipo: string): string {
  return tipo === "comunitario" ? RUTAS.bitacora : RUTAS.servicio;
}

function formatoFecha(fecha?: string): string {
  if (!fecha) return "Sin fecha";
  const d = new Date(fecha.length === 10 ? `${fecha}T00:00:00` : fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function SessionMeta({ d }: { d: DashEstudiante }) {
  const router = useRouter();
  const total = d.totalHoras;
  const metaTotal = d.metas.directas + d.metas.impacto;
  const pctTotal = Math.min(100, Math.round((total / metaTotal) * 100));

  return (
    <>
      <Card className="border-0 shadow-sm bg-gradient-to-r from-iunav-blue to-iunav-blue-light text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium">Progreso Total del Servicio</p>
              <p className="text-4xl font-bold mt-1">
                {total} <span className="text-lg font-normal text-white/60">/ {metaTotal} horas</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{pctTotal}%</p>
              <p className="text-white/60 text-sm">completado</p>
            </div>
          </div>
          <Progress value={pctTotal} className="h-3 mt-4 bg-white/20 [&>div]:bg-white" />
          <div className="grid grid-cols-2 gap-4 mt-5">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/60 text-xs">Trabajo Directo</p>
              <p className="text-xl font-bold">
                {d.horasDirectas}/{d.metas.directas}h
              </p>
              <p className="text-[11px] text-white/50 mt-1">{d.pctDirecto}% de la meta</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/60 text-xs">Impacto (Social y Ambiental)</p>
              <p className="text-xl font-bold">
                {d.horasImpacto}/{d.metas.impacto}h
              </p>
              <p className="text-[11px] text-white/50 mt-1">{d.pctImpacto}% de la meta</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {d.pendientes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Actividades que Requieren Atención ({d.pendientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Tipo</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Semana</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Descripción</th>
                    <th className="text-center font-medium text-muted-foreground px-5 py-3">Horas</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {d.pendientes.map((entrada) => (
                    <tr
                      key={entrada.id}
                      onClick={() => router.push(`${rutaDeTipo(entrada.tipo)}?estado=${entrada.estado}`)}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            entrada.tipo === "comunitario" ? "info" : entrada.tipo === "social" ? "secondary" : "success"
                          }
                        >
                          {tipoLabel[entrada.tipo]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {entrada.semana ? `Semana ${entrada.semana}` : formatoFecha(entrada.fecha)}
                      </td>
                      <td className="px-5 py-3 max-w-xs leading-snug">{entrada.descripcion}</td>
                      <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                      <td className="px-5 py-3">
                        <Badge variant={estadoColor[entrada.estado]}>{entrada.estado}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Actividades Aprobadas Recientes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {d.aprobadasRecientes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 px-5">
              Aún no tienes actividades aprobadas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Tipo</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Semana</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Descripción</th>
                    <th className="text-center font-medium text-muted-foreground px-5 py-3">Horas</th>
                    <th className="text-center font-medium text-muted-foreground px-5 py-3">Evidencia</th>
                  </tr>
                </thead>
                <tbody>
                  {d.aprobadasRecientes.map((entrada) => (
                    <tr
                      key={entrada.id}
                      onClick={() => router.push(`${rutaDeTipo(entrada.tipo)}?estado=aprobado`)}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3">
                        <Badge
                          variant={
                            entrada.tipo === "comunitario" ? "info" : entrada.tipo === "social" ? "secondary" : "success"
                          }
                        >
                          {tipoLabel[entrada.tipo]}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-medium">
                        {entrada.semana ? `Semana ${entrada.semana}` : formatoFecha(entrada.fecha)}
                      </td>
                      <td className="px-5 py-3 max-w-xs leading-snug">{entrada.descripcion}</td>
                      <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                      <td className="px-5 py-3 text-center">
                        {entrada.evidencia ? (
                          <ImageIcon className="h-4 w-4 mx-auto text-iunav-blue" aria-hidden="true" />
                        ) : (
                          <span className="text-xs text-muted-foreground">--</span>
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
    </>
  );
}

export function EstudianteDashboard({ user }: { user: Usuario }) {
  const { data, loading, error, reload } = useApiData<DashEstudiante>("/dashboard");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando tu panel...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 flex flex-col items-center text-center gap-3">
          <AlertTriangle className="h-8 w-8 text-amber-500" />
          <p className="text-sm text-muted-foreground max-w-md">{error}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={reload}>
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </Button>
        </CardContent>
      </Card>
    );
  }

  const sinDatos =
    data.proyecto === null && data.pendientes.length === 0 && data.aprobadasRecientes.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mi Panel de Servicio</h2>
        <p className="text-muted-foreground text-sm mt-1">Bienvenido/a, {user.nombreCompleto}</p>
      </div>

      {sinDatos ? (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 flex flex-col items-center text-center gap-3">
            <CheckCircle className="h-10 w-10 text-emerald-500" />
            <div>
              <p className="font-semibold text-foreground">Tu panel está listo</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Aún no tienes horas registradas. Cuando el coordinador te asigne a un grupo y
                comiences a registrar actividades, aquí aparecerá tu progreso de 120h.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={RUTAS.bitacora}
                className="inline-flex h-9 items-center rounded-md bg-iunav-blue px-4 text-sm font-medium text-white hover:bg-iunav-blue/90 transition-colors"
              >
                Registrar en Bitácora
              </Link>
              <Link
                href={RUTAS.servicio}
                className="inline-flex h-9 items-center rounded-md border border-input bg-transparent px-4 text-sm font-medium hover:bg-muted transition-colors"
              >
                Registrar Servicio
              </Link>
            </div>
          </CardContent>
        </Card>
      ) : (
        <SessionMeta d={data} />
      )}

      {!sinDatos && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Ticker icon={<FolderKanban className="h-5 w-5 text-iunav-blue" />} bg="bg-blue-50" valor={data.proyecto ? "1" : "0"} etiqueta="Proyecto Activo" />
            <Ticker icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} bg="bg-amber-50" valor={String(data.pendientesCount)} etiqueta="Actividades Pendientes" />
            <Ticker icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-50" valor={`${data.pctDirecto}%`} etiqueta="Avance Trabajo Directo" href={RUTAS.bitacora} />
          </div>

          {data.proyecto && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Mi Proyecto Actual</CardTitle>
              </CardHeader>
              <CardContent>
                <h3 className="font-semibold text-foreground">{data.proyecto.nombreProyecto}</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Periodo: {data.proyecto.periodo} | Tutor: {data.proyecto.tutorNombre ?? "Por asignar"}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={data.proyecto.estado === "en_curso" ? "info" : "warning"}>
                    {data.proyecto.estado === "en_curso" ? "En Curso" : "Pendiente Aprobación"}
                  </Badge>
                  <Badge variant={data.proyecto.proyectoEscrito ? "success" : "outline"}>
                    {data.proyecto.proyectoEscrito ? "Escrito subido" : "Sin escrito"}
                  </Badge>
                  <Badge variant={data.proyecto.diapositivas ? "success" : "outline"}>
                    {data.proyecto.diapositivas ? "Diapositivas subidas" : "Sin diapositivas"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-xs text-muted-foreground">Integrantes:</span>
                  {data.proyecto.integrantes.map((i) => (
                    <span
                      key={i.id}
                      className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5"
                      title={i.nombre}
                    >
                      {i.iniciales}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Ticker({
  icon,
  bg,
  valor,
  etiqueta,
  href,
}: {
  icon: React.ReactNode;
  bg: string;
  valor: string;
  etiqueta: string;
  href?: string;
}) {
  const contenido = (
    <Card className="border-0 shadow-sm h-full transition-all hover:shadow-md hover:border-iunav-blue/30">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-lg font-bold">{valor}</p>
          <p className="text-xs text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{contenido}</Link> : contenido;
}