import { Plus, Image, CheckCircle, XCircle, AlertTriangle, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { bitacoraComunitario, type EstadoBitacora } from '@/data/mockData';

const estadoConfig: Record<EstadoBitacora, { variant: 'warning' | 'success' | 'danger' | 'outline'; icon: React.ElementType; label: string }> = {
  Pendiente: { variant: 'warning', icon: AlertTriangle, label: 'Pendiente' },
  Aprobado: { variant: 'success', icon: CheckCircle, label: 'Aprobado' },
  Rechazado: { variant: 'danger', icon: XCircle, label: 'Rechazado' },
  Corregir: { variant: 'outline', icon: Pencil, label: 'Corregir' },
};

export function BitacoraView() {
  const [showRegister, setShowRegister] = useState(false);
  const estudianteId = 'u6';
  const entradas = bitacoraComunitario.filter((b) => b.estudianteId === estudianteId);
  const horasCompletadas = entradas.filter((e) => e.estado === 'Aprobado').reduce((sum, e) => sum + e.horas, 0);
  const totalHoras = 120;
  const porcentaje = Math.round((horasCompletadas / totalHoras) * 100);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Bitácora Comunitario (120h)</h2>
          <p className="text-muted-foreground text-sm mt-1">Registro de horas de servicio comunitario - Gabriela Martínez</p>
        </div>
        <Button className="gap-2" onClick={() => setShowRegister(true)}>
          <Plus className="h-4 w-4" />
          Registrar Actividad
        </Button>
      </div>

      {/* Progress Card */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-iunav-blue to-iunav-blue-light text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium">Progreso del Servicio Comunitario</p>
              <p className="text-4xl font-bold mt-1">
                {horasCompletadas} <span className="text-lg font-normal text-white/60">/ {totalHoras} horas</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{porcentaje}%</p>
              <p className="text-white/60 text-sm">completado</p>
            </div>
          </div>
          <div className="mt-4">
            <Progress value={porcentaje} className="h-3 bg-white/20 [&>div]:bg-white" />
          </div>
          <div className="flex gap-6 mt-4 text-sm">
            <div>
              <span className="text-white/60">Aprobadas:</span>{' '}
              <span className="font-semibold">{horasCompletadas}h</span>
            </div>
            <div>
              <span className="text-white/60">Pendientes:</span>{' '}
              <span className="font-semibold">{entradas.filter(e => e.estado === 'Pendiente').reduce((s, e) => s + e.horas, 0)}h</span>
            </div>
            <div>
              <span className="text-white/60">Rechazadas:</span>{' '}
              <span className="font-semibold">{entradas.filter(e => e.estado === 'Rechazado' || e.estado === 'Corregir').reduce((s, e) => s + e.horas, 0)}h</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bitacora Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Registro de Actividades</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
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
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Comentario del Tutor</th>
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
                      <td className="px-5 py-3 text-muted-foreground text-xs max-w-[200px]">
                        {entrada.comentarioTutor || <span className="italic">Sin comentario</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Register Activity Dialog */}
      <Dialog open={showRegister} onOpenChange={setShowRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Actividad</DialogTitle>
            <DialogDescription>Ingresa los datos de la actividad de servicio comunitario realizada</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Semana</label>
              <Input type="number" placeholder="Ej: 12" className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha</label>
              <Input type="date" className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Descripción de la actividad</label>
              <textarea
                className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5"
                rows={3}
                placeholder="Describe la actividad realizada..."
              />
            </div>
            <div>
              <label className="text-sm font-medium">Horas (máx. 8)</label>
              <Input type="number" min={1} max={8} placeholder="Ej: 6" className="mt-1.5" />
            </div>
            <div>
              <label className="text-sm font-medium">Evidencia Fotográfica</label>
              <div className="border-2 border-dashed border-muted rounded-lg p-4 text-center mt-1.5 cursor-pointer hover:border-iunav-blue/40 transition-colors">
                <Image className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">Subir foto de evidencia</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRegister(false)}>Cancelar</Button>
            <Button onClick={() => setShowRegister(false)}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
