import { FolderKanban, CheckCircle, AlertTriangle, Plus, Image, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { bitacoraComunitario, bitacoraSocial, bitacoraAmbiental, proyectos } from '@/data/mockData';

export function EstudianteDashboard() {
  const estudianteId = 'u6';
  const estudianteNombre = 'Gabriela Martínez';

  const comunitario = bitacoraComunitario.filter((b) => b.estudianteId === estudianteId);
  const social = bitacoraSocial.filter((b) => b.estudianteId === estudianteId);
  const ambiental = bitacoraAmbiental.filter((b) => b.estudianteId === estudianteId);

  const horasComunitariasAprobadas = comunitario.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0);
  const horasSocialesAprobadas = social.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0);
  const horasAmbientalesAprobadas = ambiental.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0);

  const totalAprobadas = horasComunitariasAprobadas + horasSocialesAprobadas + horasAmbientalesAprobadas;
  const totalRequeridas = 200;
  const porcentajeTotal = Math.round((totalAprobadas / totalRequeridas) * 100);

  const pendientes = [...comunitario, ...social, ...ambiental].filter(e => e.estado === 'Pendiente' || e.estado === 'Corregir');

  const miProyecto = proyectos.find(p => p.integrantes.some(i => i.id === estudianteId) && p.estado === 'En Curso');

  const estadoColor: Record<string, 'warning' | 'success' | 'danger' | 'outline'> = {
    Pendiente: 'warning', Aprobado: 'success', Rechazado: 'danger', Corregir: 'outline',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mi Panel de Servicio</h2>
        <p className="text-muted-foreground text-sm mt-1">Bienvenida, {estudianteNombre}</p>
      </div>

      {/* Overall Progress */}
      <Card className="border-0 shadow-sm bg-gradient-to-r from-iunav-blue to-iunav-blue-light text-white">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <p className="text-white/70 text-sm font-medium">Progreso Total del Servicio</p>
              <p className="text-4xl font-bold mt-1">
                {totalAprobadas} <span className="text-lg font-normal text-white/60">/ {totalRequeridas} horas</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{porcentajeTotal}%</p>
              <p className="text-white/60 text-sm">completado</p>
            </div>
          </div>
          <Progress value={porcentajeTotal} className="h-3 mt-4 bg-white/20 [&>div]:bg-white" />
          <div className="grid grid-cols-3 gap-4 mt-5">
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/60 text-xs">Comunitario</p>
              <p className="text-xl font-bold">{horasComunitariasAprobadas}/120h</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/60 text-xs">Social</p>
              <p className="text-xl font-bold">{horasSocialesAprobadas}/40h</p>
            </div>
            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-white/60 text-xs">Ambiental</p>
              <p className="text-xl font-bold">{horasAmbientalesAprobadas}/40h</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <FolderKanban className="h-5 w-5 text-iunav-blue" />
            </div>
            <div>
              <p className="text-lg font-bold">{miProyecto ? '1' : '0'}</p>
              <p className="text-xs text-muted-foreground">Proyecto Activo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{pendientes.length}</p>
              <p className="text-xs text-muted-foreground">Actividades Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-lg font-bold">{Math.round((horasComunitariasAprobadas / 120) * 100)}%</p>
              <p className="text-xs text-muted-foreground">Avance Comunitario</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Project */}
      {miProyecto && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Mi Proyecto Actual</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-foreground">{miProyecto.nombre}</h3>
                <p className="text-sm text-muted-foreground mt-1">Periodo: {miProyecto.periodo} | Tutor: {miProyecto.tutorNombre}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="info">En Curso</Badge>
                  {miProyecto.proyectoEscritoSubido ? (
                    <Badge variant="success">Escrito subido</Badge>
                  ) : (
                    <Badge variant="outline">Sin escrito</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-xs text-muted-foreground">Integrantes:</span>
                  {miProyecto.integrantes.map(i => (
                    <span key={i.id} className="inline-flex items-center gap-1 text-xs bg-muted rounded-full px-2 py-0.5">
                      {i.nombre.split(' ')[0]}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Registrar Horas
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pending Activities */}
      {pendientes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Actividades que Requieren Atención ({pendientes.length})
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
                    <th className="text-left font-medium text-muted-foreground px-5 py-3">Comentario</th>
                  </tr>
                </thead>
                <tbody>
                  {pendientes.map((entrada) => (
                    <tr key={entrada.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-5 py-3">
                        <Badge variant={entrada.tipo === 'comunitario' ? 'info' : entrada.tipo === 'social' ? 'secondary' : 'success'}>
                          {entrada.tipo.charAt(0).toUpperCase() + entrada.tipo.slice(1)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 font-medium">Semana {entrada.semana}</td>
                      <td className="px-5 py-3 max-w-xs leading-snug">{entrada.descripcion}</td>
                      <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                      <td className="px-5 py-3">
                        <Badge variant={estadoColor[entrada.estado]}>{entrada.estado}</Badge>
                      </td>
                      <td className="px-5 py-3 text-xs text-muted-foreground max-w-[200px]">
                        {entrada.comentarioTutor || <span className="italic">Sin comentario</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Approved */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-500" />
            Actividades Aprobadas Recientes
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
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Evidencia</th>
                </tr>
              </thead>
              <tbody>
                {[...comunitario, ...social, ...ambiental].filter(e => e.estado === 'Aprobado').slice(-5).reverse().map((entrada) => (
                  <tr key={entrada.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <Badge variant={entrada.tipo === 'comunitario' ? 'info' : entrada.tipo === 'social' ? 'secondary' : 'success'}>
                        {entrada.tipo.charAt(0).toUpperCase() + entrada.tipo.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 font-medium">Semana {entrada.semana}</td>
                    <td className="px-5 py-3 max-w-xs leading-snug">{entrada.descripcion}</td>
                    <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                    <td className="px-5 py-3 text-center">
                      {entrada.evidenciaFotografica ? (
                        <button className="inline-flex items-center gap-1 text-iunav-blue hover:text-iunav-blue-light transition-colors">
                          <Image className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-muted-foreground">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
