import { Users, FolderKanban, Clock, TrendingUp, CheckCircle, FileUp, UserPlus, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { estadisticas, actividadesRecientes } from '@/data/mockData';

const statCards = [
  {
    title: 'Estudiantes Activos',
    value: estadisticas.totalEstudiantesActivos,
    icon: Users,
    color: 'bg-iunav-blue',
    lightColor: 'bg-blue-50',
    textColor: 'text-iunav-blue',
  },
  {
    title: 'Proyectos en Curso',
    value: estadisticas.proyectosEnCurso,
    icon: FolderKanban,
    color: 'bg-iunav-red',
    lightColor: 'bg-red-50',
    textColor: 'text-iunav-red',
  },
  {
    title: 'Horas Validadas (Mes)',
    value: estadisticas.horasValidadasMes,
    icon: Clock,
    color: 'bg-emerald-600',
    lightColor: 'bg-emerald-50',
    textColor: 'text-emerald-600',
  },
  {
    title: 'Tasa de Aprobación',
    value: `${estadisticas.tasaAprobacion}%`,
    icon: TrendingUp,
    color: 'bg-amber-600',
    lightColor: 'bg-amber-50',
    textColor: 'text-amber-600',
  },
];

const tipoIcons: Record<string, React.ElementType> = {
  aprobacion: CheckCircle,
  registro: Clock,
  subida: FileUp,
  inscripcion: UserPlus,
};

const tipoColors: Record<string, string> = {
  aprobacion: 'text-emerald-600 bg-emerald-50',
  registro: 'text-iunav-blue bg-blue-50',
  subida: 'text-amber-600 bg-amber-50',
  inscripcion: 'text-iunav-red bg-red-50',
};

export function DashboardView() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
        <p className="text-muted-foreground text-sm mt-1">Resumen general del Servicio Comunitario IUNAV</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title} className="border-0 shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground font-medium">{card.title}</p>
                    <p className="text-3xl font-bold mt-2 text-foreground">{card.value}</p>
                  </div>
                  <div className={`${card.lightColor} p-2.5 rounded-xl`}>
                    <Icon className={`h-5 w-5 ${card.textColor}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Feed */}
        <Card className="lg:col-span-2 border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Actividades Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {actividadesRecientes.map((act) => {
                const Icon = tipoIcons[act.tipo] || AlertCircle;
                const colorClass = tipoColors[act.tipo] || 'text-gray-600 bg-gray-50';
                return (
                  <div key={act.id} className="flex items-start gap-3 group">
                    <div className={`shrink-0 p-2 rounded-lg ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground leading-snug">{act.descripcion}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.fecha}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Resumen Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total horas registradas</span>
                <span className="text-sm font-semibold">{estadisticas.totalHorasRegistradas}h</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Bitácoras pendientes</span>
                <Badge variant="warning">{estadisticas.bitacorasPendientes}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Proyectos finalizados</span>
                <span className="text-sm font-semibold">1</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Pendientes de aprobación</span>
                <Badge variant="info">1</Badge>
              </div>
            </div>

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Distribución por tipo de servicio</p>
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Comunitario</span>
                    <span className="font-medium">68%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-iunav-blue rounded-full" style={{ width: '68%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Social</span>
                    <span className="font-medium">20%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-iunav-red rounded-full" style={{ width: '20%' }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Ambiental</span>
                    <span className="font-medium">12%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: '12%' }} />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
