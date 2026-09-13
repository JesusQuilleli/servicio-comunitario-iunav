import { Image, CheckCircle, XCircle, AlertTriangle, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { bitacoraSocial, bitacoraAmbiental, type EstadoBitacora } from '@/data/mockData';

const estadoConfig: Record<EstadoBitacora, { variant: 'warning' | 'success' | 'danger' | 'outline'; icon: React.ElementType; label: string }> = {
  Pendiente: { variant: 'warning', icon: AlertTriangle, label: 'Pendiente' },
  Aprobado: { variant: 'success', icon: CheckCircle, label: 'Aprobado' },
  Rechazado: { variant: 'danger', icon: XCircle, label: 'Rechazado' },
  Corregir: { variant: 'outline', icon: Pencil, label: 'Corregir' },
};

function ServiceTable({ entradas }: { entradas: typeof bitacoraSocial }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Semana</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Fecha</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Descripción</th>
            <th className="text-center font-medium text-muted-foreground px-5 py-3">Horas</th>
            <th className="text-center font-medium text-muted-foreground px-5 py-3">Evidencia</th>
            <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
          </tr>
        </thead>
        <tbody>
          {entradas.map((entrada) => {
            const config = estadoConfig[entrada.estado];
            const EstadoIcon = config.icon;
            return (
              <tr key={entrada.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-5 py-3 font-medium">Semana {entrada.semana}</td>
                <td className="px-5 py-3 text-muted-foreground">{entrada.fecha}</td>
                <td className="px-5 py-3 max-w-xs">
                  <p className="leading-snug">{entrada.descripcion}</p>
                </td>
                <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                <td className="px-5 py-3 text-center">
                  {entrada.evidenciaFotografica ? (
                    <button className="inline-flex items-center gap-1 text-iunav-blue hover:text-iunav-blue-light transition-colors">
                      <Image className="h-4 w-4" />
                      <span className="text-xs underline">Ver</span>
                    </button>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin evidencia</span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <Badge variant={config.variant} className="gap-1">
                    <EstadoIcon className="h-3 w-3" />
                    {config.label}
                  </Badge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ServicioView() {
  const estudianteId = 'u6';

  const socialEntradas = bitacoraSocial.filter((b) => b.estudianteId === estudianteId);
  const ambientalEntradas = bitacoraAmbiental.filter((b) => b.estudianteId === estudianteId);

  const socialAprobadas = socialEntradas.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0);
  const ambientalAprobadas = ambientalEntradas.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0);

  const socialTotal = 40;
  const ambientalTotal = 40;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Servicio Social y Ambiental</h2>
        <p className="text-muted-foreground text-sm mt-1">Registro de horas de servicio social y ambiental - Gabriela Martínez</p>
      </div>

      <Tabs defaultValue="social" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="social" className="flex-1 sm:flex-none gap-2">
            Servicio Social
          </TabsTrigger>
          <TabsTrigger value="ambiental" className="flex-1 sm:flex-none gap-2">
            Servicio Ambiental
          </TabsTrigger>
        </TabsList>

        <TabsContent value="social" className="space-y-4">
          {/* Social Progress */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-iunav-red to-iunav-red-light text-white">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-white/70 text-sm font-medium">Horas de Servicio Social</p>
                  <p className="text-4xl font-bold mt-1">
                    {socialAprobadas} <span className="text-lg font-normal text-white/60">/ {socialTotal} horas</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{Math.round((socialAprobadas / socialTotal) * 100)}%</p>
                  <p className="text-white/60 text-sm">completado</p>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={(socialAprobadas / socialTotal) * 100} className="h-3 bg-white/20 [&>div]:bg-white" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Registro de Servicio Social</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ServiceTable entradas={socialEntradas} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ambiental" className="space-y-4">
          {/* Ambiental Progress */}
          <Card className="border-0 shadow-sm bg-gradient-to-r from-emerald-700 to-emerald-600 text-white">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                <div>
                  <p className="text-white/70 text-sm font-medium">Horas de Servicio Ambiental</p>
                  <p className="text-4xl font-bold mt-1">
                    {ambientalAprobadas} <span className="text-lg font-normal text-white/60">/ {ambientalTotal} horas</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold">{Math.round((ambientalAprobadas / ambientalTotal) * 100)}%</p>
                  <p className="text-white/60 text-sm">completado</p>
                </div>
              </div>
              <div className="mt-4">
                <Progress value={(ambientalAprobadas / ambientalTotal) * 100} className="h-3 bg-white/20 [&>div]:bg-white" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Registro de Servicio Ambiental</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ServiceTable entradas={ambientalEntradas} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
