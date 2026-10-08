import { Users, Building2, AlertTriangle, TrendingUp, FileText, Loader2, RefreshCw } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { useApiData } from "@/lib/useApiData";
import { RUTAS } from "@/lib/rutas";
import type { DashGestion, Usuario } from "@/lib/types";

export function DashboardView({ user }: { user: Usuario }) {
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

  const total = data.horas.totalRegistradas;
  const totalEsperado = (data.horas.metaDirectas + data.horas.metaImpacto) * data.resumen.estudiantes;
  const pctTotal = Math.min(100, Math.round((total / Math.max(totalEsperado, 1)) * 100));
  const pctDirecto = data.resumen.estudiantes > 0 ? Math.round((data.horas.directas / (data.horas.metaDirectas * data.resumen.estudiantes)) * 100) : 0;
  const pctImpacto = data.resumen.estudiantes > 0 ? Math.round((data.horas.impacto / (data.horas.metaImpacto * data.resumen.estudiantes)) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Panel de Administración</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Bienvenido/a, {user.nombreCompleto} — Sistema de Servicio Comunitario IUNAV
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Metrica icon={<Users className="h-5 w-5 text-iunav-blue" />} bg="bg-blue-50" valor={data.resumen.estudiantes} etiqueta="Estudiantes" href={`${RUTAS.usuarios}?rol=estudiante`} />
        <Metrica icon={<Users className="h-5 w-5 text-violet-600" />} bg="bg-violet-50" valor={data.resumen.tutores} etiqueta="Tutores" href={`${RUTAS.usuarios}?rol=tutor`} />
        <Metrica icon={<Building2 className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-50" valor={data.resumen.proyectosEnCurso} etiqueta="Proyectos en curso" href={`${RUTAS.proyectos}?estado=en_curso`} />
        <Metrica icon={<AlertTriangle className="h-5 w-5 text-amber-600" />} bg="bg-amber-50" valor={data.resumen.pendientes} etiqueta="Bitácoras pendientes" href={RUTAS.reportes} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              <Link href={RUTAS.reportes} className="flex items-center gap-2 hover:text-iunav-blue transition-colors">
                <TrendingUp className="h-4 w-4 text-iunav-blue" />
                Indicadores del Servicio Comunitario
              </Link>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Horas totales del periodo ({total}h)</span>
                  <span className="text-xs text-muted-foreground">
                    meta {(data.horas.metaDirectas + data.horas.metaImpacto)}h por estudiante
                  </span>
                </div>
                <Progress value={pctTotal} className="h-2.5 bg-iunav-blue/10" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Trabajo directo ({data.horas.metaDirectas}h)</span>
                  <span className="text-xs text-muted-foreground">{data.horas.directas}h registradas</span>
                </div>
                <Progress value={Math.min(100, pctDirecto)} className="h-2.5 bg-iunav-blue/10" />
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium">Impacto social y ambiental ({data.horas.metaImpacto}h)</span>
                  <span className="text-xs text-muted-foreground">{data.horas.impacto}h registradas</span>
                </div>
                <Progress value={Math.min(100, pctImpacto)} className="h-2.5 bg-iunav-red/10 [&>div]:bg-iunav-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4 text-iunav-blue" />
              Actividad Reciente
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div>
              {data.actividad.slice(0, 5).map((actividad) => (
                <div
                  key={actividad.id}
                  className="flex items-start gap-3 px-5 py-3 border-b last:border-0 hover:bg-muted/30 transition-colors"
                >
                  <FileText className="h-4 w-4 mt-0.5 text-iunav-blue shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground leading-snug">{actividad.descripcion}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{actividad.usuario}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            <Link
              href={`${RUTAS.proyectos}?estado=pendiente_aprobacion`}
              className="flex items-center gap-2 hover:text-amber-600 transition-colors"
            >
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Proyectos por Aprobar ({data.proyectosPendientes.length})
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.proyectosPendientes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay proyectos pendientes.</p>
          ) : (
            data.proyectosPendientes.map((p) => (
              <Link
                key={p.idGrupo}
                href={`${RUTAS.proyectos}?estado=pendiente_aprobacion&q=${encodeURIComponent(p.nombre)}`}
                className="block border rounded-lg p-3 hover:border-amber-300 hover:bg-amber-50/50 transition-colors"
              >
                <p className="text-sm font-medium leading-snug">{p.nombre}</p>
                <p className="text-xs text-muted-foreground mt-1">Tutor: {p.tutorNombre ?? "Por asignar"}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="warning">Pendiente Aprobación</Badge>
                  {p.materialCompleto && <span className="text-xs text-emerald-600 font-medium">Material completo</span>}
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Metrica({
  icon,
  bg,
  valor,
  etiqueta,
  href,
}: {
  icon: React.ReactNode;
  bg: string;
  valor: number;
  etiqueta: string;
  href?: string;
}) {
  const contenido = (
    <Card className="border-0 shadow-sm h-full transition-all hover:shadow-md hover:border-iunav-blue/30">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-2xl font-bold">{valor}</p>
          <p className="text-xs text-muted-foreground">{etiqueta}</p>
        </div>
      </CardContent>
    </Card>
  );
  return href ? <Link href={href} className="block">{contenido}</Link> : contenido;
}