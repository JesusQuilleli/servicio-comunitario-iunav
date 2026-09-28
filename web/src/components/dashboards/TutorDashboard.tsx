import { CheckCircle, XCircle, Clock, Users, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/lib/useApiData";
import type { DashTutor, Usuario } from "@/lib/types";

const tipoLabel: Record<string, string> = {
  comunitario: "Comunitario",
  social: "Social",
  ambiental: "Ambiental",
};

const tipoColor: Record<string, string> = {
  comunitario: "bg-iunav-blue/10 text-iunav-blue",
  social: "bg-iunav-red/10 text-iunav-red",
  ambiental: "bg-emerald-100 text-emerald-700",
};

const estadoColor: Record<string, "warning" | "outline"> = {
  Pendiente: "warning",
  Corregir: "outline",
};

function formatoFecha(fecha?: string): string {
  if (!fecha) return "Sin fecha";
  const d = new Date(fecha.length === 10 ? `${fecha}T00:00:00` : fecha);
  if (Number.isNaN(d.getTime())) return fecha;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

function EstadoProyecto({ estado }: { estado: string }) {
  const mapa: Record<string, { label: string; variant: "info" | "success" | "warning" | "danger" }> = {
    en_curso: { label: "En Curso", variant: "info" },
    finalizado: { label: "Finalizado", variant: "success" },
    pendiente_aprobacion: { label: "Pendiente Aprobación", variant: "warning" },
    suspendido: { label: "Suspendido", variant: "danger" },
  };
  const info = mapa[estado] ?? { label: estado, variant: "info" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export function TutorDashboard({ user }: { user: Usuario }) {
  const { data, loading, error, reload } = useApiData<DashTutor>("/dashboard");

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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Panel del Tutor</h2>
        <p className="text-muted-foreground text-sm mt-1">Bienvenido, {user.nombreCompleto}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TarjetaMetrica icon={<Clock className="h-5 w-5 text-amber-600" />} bg="bg-amber-50" valor={data.resumen.pendientes} etiqueta="Pendientes por revisar" />
        <TarjetaMetrica icon={<CheckCircle className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-50" valor={data.resumen.aprobadas} etiqueta="Actividades aprobadas" />
        <TarjetaMetrica icon={<XCircle className="h-5 w-5 text-red-600" />} bg="bg-red-50" valor={data.resumen.rechazadas} etiqueta="Actividades rechazadas" />
        <TarjetaMetrica icon={<Users className="h-5 w-5 text-iunav-blue" />} bg="bg-blue-50" valor={data.resumen.estudiantes} etiqueta="Estudiantes asignados" />
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Mis Proyectos ({data.proyectos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {data.proyectos.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center border border-dashed rounded-lg">
              Aún no tienes proyectos asignados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.proyectos.map((proyecto) => (
                <div key={proyecto.id} className="border rounded-lg p-4 hover:border-iunav-blue/30 transition-colors">
                  <h4 className="font-medium text-sm leading-snug">{proyecto.nombre}</h4>
                  <p className="text-xs text-muted-foreground mt-1">{proyecto.periodo}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <EstadoProyecto estado={proyecto.estado} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                    <span className="text-xs text-muted-foreground">Integrantes:</span>
                    {proyecto.integrantes.map((i) => (
                      <span key={i.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5" title={i.nombre}>
                        {i.iniciales}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Actividades Pendientes de Revisión ({data.pendientes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.pendientes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 px-5">No hay actividades pendientes. ¡Todo al día!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Estudiante</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Tipo</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Semana</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Descripción</th>
                    <th className="text-center font-medium text-muted-foreground px-5 py-3">Horas</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {data.pendientes.map((entrada) => (
                    <tr key={entrada.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{entrada.estudianteNombre}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tipoColor[entrada.tipo]}`}>
                          {tipoLabel[entrada.tipo]}
                        </span>
                      </td>
                      <td className="px-5 py-3">
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TarjetaMetrica({
  icon,
  bg,
  valor,
  etiqueta,
}: {
  icon: React.ReactNode;
  bg: string;
  valor: number;
  etiqueta: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{valor}</p>
          <p className="text-xs text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
}