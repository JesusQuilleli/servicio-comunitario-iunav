import { Users, Building2, Clock, TrendingUp, FileText, AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/lib/useApiData";
import type { DashGestion, Usuario } from "@/lib/types";

export function CoordinadorDashboard({ user }: { user: Usuario }) {
  const { data, loading, error, reload } = useApiData<DashGestion>("/dashboard");

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
        <span className="ml-2 text-sm text-muted-foreground">Cargando el panel...</span>
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

  const horasObj = data.horas;
  const pctDirectasGlobal = Math.min(
    100,
    Math.round((horasObj.directas / Math.max(horasObj.metaDirectas * data.resumen.estudiantes, 1)) * 100)
  );
  const pctImpactoGlobal = Math.min(
    100,
    Math.round((horasObj.impacto / Math.max(horasObj.metaImpacto * data.resumen.estudiantes, 1)) * 100)
  );
  const pctTotalGlobal = Math.min(
    100,
    Math.round(
      (horasObj.totalRegistradas / Math.max((horasObj.metaDirectas + horasObj.metaImpacto) * data.resumen.estudiantes, 1)) * 100
    )
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Panel de Coordinación</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Bienvenido/a, {user.nombreCompleto} — Periodo 2026-I
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metrica icon={<Users className="h-5 w-5 text-iunav-blue" />} bg="bg-blue-50" valor={data.resumen.estudiantes} etiqueta="Estudiantes activos" />
        <Metrica icon={<Building2 className="h-5 w-5 text-violet-600" />} bg="bg-violet-50" valor={data.resumen.proyectosEnCurso} etiqueta="Proyectos en curso" />
        <Metrica icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-50" valor={data.resumen.horasValidadas} etiqueta="Horas validadas" />
        <Metrica icon={<Clock className="h-5 w-5 text-amber-600" />} bg="bg-amber-50" valor={data.resumen.pendientes} etiqueta="Bitácoras pendientes" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-iunav-blue" />
              Resumen de Horas por Tipo de Servicio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Trabajo Directo</span>
                  <span className="text-muted-foreground">
                    {horasObj.directas}h <span className="text-xs">/ {horasObj.metaDirectas}h por estudiante</span>
                  </span>
                </div>
                <Progress value={pctDirectasGlobal} className="h-2.5 bg-iunav-blue/10" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Impacto Social y Ambiental</span>
                  <span className="text-muted-foreground">
                    {horasObj.impacto}h <span className="text-xs">/ {horasObj.metaImpacto}h por estudiante</span>
                  </span>
                </div>
                <Progress value={pctImpactoGlobal} className="h-2.5 bg-iunav-red/10 [&>div]:bg-iunav-red" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Horas totales registradas (periodo)</span>
                  <span className="text-muted-foreground">{horasObj.totalRegistradas}h</span>
                </div>
                <Progress value={pctTotalGlobal} className="h-2.5 bg-emerald-100 [&>div]:bg-emerald-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Proyectos por Aprobar ({data.proyectosPendientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.proyectosPendientes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay proyectos pendientes.</p>
            ) : (
              data.proyectosPendientes.map((p) => (
                <div key={p.idGrupo} className="border rounded-lg p-3">
                  <p className="text-sm font-medium leading-snug">{p.nombre}</p>
                  <p className="text-xs text-muted-foreground mt-1">Tutor: {p.tutorNombre ?? "Por asignar"}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="warning">Pendiente Aprobación</Badge>
                    {p.materialCompleto ? (
                      <span className="text-xs text-emerald-600 font-medium">Material completo</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Falta material</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Tutores Registrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Nombre</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Cédula</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Firma</th>
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Sello</th>
                  </tr>
                </thead>
                <tbody>
                  {data.tutores.map((tutor) => (
                    <tr key={tutor.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3 font-medium">{tutor.nombre}</td>
                      <td className="px-5 py-3">{tutor.cedula}</td>
                      <td className="px-5 py-3">
                        <Badge variant={tutor.firma ? "success" : "warning"}>
                          {tutor.firma ? "Registrada" : "Pendiente"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={tutor.sello ? "success" : "outline"}>
                          {tutor.sello ? "Registrado" : "N/A"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actividad Reciente</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {data.actividad.map((actividad) => (
                <div
                  key={actividad.id}
                  className="flex items-start gap-3 px-5 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <FileText className="h-4 w-4 mt-0.5 text-iunav-blue shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground leading-snug">{actividad.descripcion}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {actividad.usuario} · {actividad.tipo}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Metrica({
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