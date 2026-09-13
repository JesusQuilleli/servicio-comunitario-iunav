import { Users, FolderKanban, Clock, AlertTriangle, TrendingUp, Ligature as FileSignature } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { usuarios, proyectos, bitacoraComunitario, bitacoraSocial, bitacoraAmbiental, actividadesRecientes } from '@/data/mockData';

export function CoordinadorDashboard() {
  const coordinadorNombre = 'María Fernanda López';

  const estudiantes = usuarios.filter(u => u.rol === 'Estudiante' && u.activo);
  const tutores = usuarios.filter(u => u.rol === 'Tutor' && u.activo);
  const proyectosEnCurso = proyectos.filter(p => p.estado === 'En Curso');
  const proyectosPendientes = proyectos.filter(p => p.estado === 'Pendiente Aprobación');

  const todasEntradas = [...bitacoraComunitario, ...bitacoraSocial, ...bitacoraAmbiental];
  const totalHorasAprobadas = todasEntradas.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0);
  const pendientesRevision = todasEntradas.filter(e => e.estado === 'Pendiente').length;
  const tasaAprobacion = todasEntradas.length > 0
    ? Math.round((todasEntradas.filter(e => e.estado === 'Aprobado').length / todasEntradas.filter(e => e.estado !== 'Pendiente').length) * 100)
    : 0;

  const tutoresConFirma = tutores.filter(t => t.firmaDigital);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Panel del Coordinador</h2>
        <p className="text-muted-foreground text-sm mt-1">Bienvenida, {coordinadorNombre}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <Users className="h-5 w-5 text-iunav-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{estudiantes.length}</p>
              <p className="text-xs text-muted-foreground">Estudiantes Activos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50">
              <FolderKanban className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{proyectosEnCurso.length}</p>
              <p className="text-xs text-muted-foreground">Proyectos en Curso</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendientesRevision}</p>
              <p className="text-xs text-muted-foreground">Bitácoras Pendientes</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-50">
              <TrendingUp className="h-5 w-5 text-iunav-red" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tasaAprobacion}%</p>
              <p className="text-xs text-muted-foreground">Tasa de Aprobación</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hours Overview */}
        <Card className="border-0 shadow-sm lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Resumen de Horas por Tipo de Servicio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Servicio Comunitario</span>
                <span className="text-muted-foreground">{bitacoraComunitario.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0)}h aprobadas</span>
              </div>
              <Progress value={Math.min(100, (bitacoraComunitario.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0) / (estudiantes.length * 120)) * 100)} className="h-3" />
              <p className="text-xs text-muted-foreground mt-1">Meta: {estudiantes.length * 120}h totales</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Servicio Social</span>
                <span className="text-muted-foreground">{bitacoraSocial.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0)}h aprobadas</span>
              </div>
              <Progress value={Math.min(100, (bitacoraSocial.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0) / (estudiantes.length * 40)) * 100)} className="h-3 [&>div]:bg-iunav-red" />
              <p className="text-xs text-muted-foreground mt-1">Meta: {estudiantes.length * 40}h totales</p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="font-medium">Servicio Ambiental</span>
                <span className="text-muted-foreground">{bitacoraAmbiental.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0)}h aprobadas</span>
              </div>
              <Progress value={Math.min(100, (bitacoraAmbiental.filter(e => e.estado === 'Aprobado').reduce((s, e) => s + e.horas, 0) / (estudiantes.length * 40)) * 100)} className="h-3 [&>div]:bg-emerald-500" />
              <p className="text-xs text-muted-foreground mt-1">Meta: {estudiantes.length * 40}h totales</p>
            </div>
            <div className="pt-3 border-t">
              <div className="flex justify-between items-center">
                <span className="font-semibold">Total horas validadas</span>
                <span className="text-xl font-bold text-iunav-blue">{totalHorasAprobadas}h</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tutors Status */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Estado de Tutores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {tutores.map(tutor => {
              const tutorPendientes = [...bitacoraComunitario, ...bitacoraSocial, ...bitacoraAmbiental]
                .filter(b => proyectos.filter(p => p.tutorId === tutor.id).flatMap(p => p.integrantes.map(i => i.id)).includes(b.estudianteId))
                .filter(b => b.estado === 'Pendiente' || b.estado === 'Corregir').length;
              return (
                <div key={tutor.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-iunav-blue/10 text-iunav-blue text-xs font-bold">
                      {tutor.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tutor.nombre.split(' ').slice(0, 2).join(' ')}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {tutor.firmaDigital ? (
                          <Badge variant="success" className="text-[10px] py-0 gap-0.5"><FileSignature className="h-2.5 w-2.5" />Firma</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0">Sin firma</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {tutorPendientes > 0 ? (
                      <Badge variant="warning">{tutorPendientes} pend.</Badge>
                    ) : (
                      <Badge variant="success">Al día</Badge>
                    )}
                  </div>
                </div>
              );
            })}
            <div className="pt-2 border-t text-xs text-muted-foreground">
              <p>{tutoresConFirma.length}/{tutores.length} tutores con firma digital registrada</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projects Pending Approval */}
      {proyectosPendientes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Proyectos Pendientes de Aprobación ({proyectosPendientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proyectosPendientes.map(proyecto => (
                <div key={proyecto.id} className="flex items-center justify-between p-4 border rounded-lg hover:border-iunav-blue/30 transition-colors">
                  <div>
                    <h4 className="font-medium text-sm">{proyecto.nombre}</h4>
                    <p className="text-xs text-muted-foreground mt-1">Tutor: {proyecto.tutorNombre} | {proyecto.periodo} | {proyecto.integrantes.length} integrantes</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="success" className="cursor-pointer">Aprobar</Badge>
                    <Badge variant="danger" className="cursor-pointer">Rechazar</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Actividad Reciente del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {actividadesRecientes.slice(0, 6).map(act => (
              <div key={act.id} className="flex items-center gap-3 text-sm">
                <div className="h-2 w-2 rounded-full bg-iunav-blue shrink-0" />
                <p className="flex-1 text-muted-foreground">{act.descripcion}</p>
                <span className="text-xs text-muted-foreground shrink-0">{act.fecha}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
