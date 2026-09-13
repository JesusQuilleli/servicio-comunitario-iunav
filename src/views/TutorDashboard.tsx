import { CheckCircle, XCircle, Pencil, Eye, Image, Clock, Users, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { bitacoraComunitario, bitacoraSocial, bitacoraAmbiental, proyectos } from '@/data/mockData';
import { useState } from 'react';

type Action = 'approve' | 'reject' | 'correct' | null;

export function TutorDashboard() {
  const tutorId = 'u3';
  const tutorNombre = 'José Rafael Pérez';

  const misProyectos = proyectos.filter(p => p.tutorId === tutorId);
  const misEstudiantes = misProyectos.flatMap(p => p.integrantes);
  const estudianteIds = misEstudiantes.map(i => i.id);

  const todasEntradas = [...bitacoraComunitario, ...bitacoraSocial, ...bitacoraAmbiental]
    .filter(b => estudianteIds.includes(b.estudianteId));

  const pendientes = todasEntradas.filter(b => b.estado === 'Pendiente' || b.estado === 'Corregir');
  const aprobadas = todasEntradas.filter(b => b.estado === 'Aprobado');
  const rechazadas = todasEntradas.filter(b => b.estado === 'Rechazado');

  const [actionDialog, setActionDialog] = useState<{ entrada: typeof pendientes[0]; action: Action } | null>(null);

  const tipoLabel: Record<string, string> = { comunitario: 'Comunitario', social: 'Social', ambiental: 'Ambiental' };
  const tipoColor: Record<string, string> = {
    comunitario: 'bg-iunav-blue/10 text-iunav-blue',
    social: 'bg-iunav-red/10 text-iunav-red',
    ambiental: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Panel del Tutor</h2>
        <p className="text-muted-foreground text-sm mt-1">Bienvenido, {tutorNombre}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-amber-50">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendientes.length}</p>
              <p className="text-xs text-muted-foreground">Pendientes por revisar</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{aprobadas.length}</p>
              <p className="text-xs text-muted-foreground">Actividades aprobadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-50">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{rechazadas.length}</p>
              <p className="text-xs text-muted-foreground">Actividades rechazadas</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <Users className="h-5 w-5 text-iunav-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{misEstudiantes.length}</p>
              <p className="text-xs text-muted-foreground">Estudiantes asignados</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* My Projects */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Mis Proyectos ({misProyectos.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {misProyectos.map(proyecto => (
              <div key={proyecto.id} className="border rounded-lg p-4 hover:border-iunav-blue/30 transition-colors">
                <h4 className="font-medium text-sm leading-snug">{proyecto.nombre}</h4>
                <p className="text-xs text-muted-foreground mt-1">{proyecto.periodo}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant={proyecto.estado === 'En Curso' ? 'info' : proyecto.estado === 'Finalizado' ? 'success' : 'warning'}>
                    {proyecto.estado}
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 mt-3">
                  <span className="text-xs text-muted-foreground">Integrantes:</span>
                  {proyecto.integrantes.map(i => (
                    <span key={i.id} className="text-xs bg-muted rounded-full px-2 py-0.5">{i.nombre.split(' ')[0]}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending Review */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Actividades Pendientes de Revisión ({pendientes.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Estudiante</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Tipo</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Semana</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Descripción</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Horas</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Evidencia</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pendientes.map(entrada => (
                  <tr key={entrada.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{entrada.estudianteNombre}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tipoColor[entrada.tipo]}`}>
                        {tipoLabel[entrada.tipo]}
                      </span>
                    </td>
                    <td className="px-5 py-3">Semana {entrada.semana}</td>
                    <td className="px-5 py-3 max-w-xs leading-snug">{entrada.descripcion}</td>
                    <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                    <td className="px-5 py-3 text-center">
                      {entrada.evidenciaFotografica ? (
                        <button className="text-iunav-blue hover:text-iunav-blue-light transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : (
                        <Image className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={entrada.estado === 'Pendiente' ? 'warning' : 'outline'}>{entrada.estado}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-emerald-600 hover:bg-emerald-50" onClick={() => setActionDialog({ entrada, action: 'approve' })} title="Aprobar">
                          <CheckCircle className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setActionDialog({ entrada, action: 'reject' })} title="Rechazar">
                          <XCircle className="h-5 w-5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-amber-600 hover:bg-amber-50" onClick={() => setActionDialog({ entrada, action: 'correct' })} title="Pedir Corrección">
                          <Pencil className="h-5 w-5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => setActionDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog?.action === 'approve' && 'Aprobar Actividad'}
              {actionDialog?.action === 'reject' && 'Rechazar Actividad'}
              {actionDialog?.action === 'correct' && 'Pedir Corrección'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog?.action === 'approve' && 'Confirma la aprobación de las horas registradas.'}
              {actionDialog?.action === 'reject' && 'Indica el motivo del rechazo de esta actividad.'}
              {actionDialog?.action === 'correct' && 'Indica las correcciones necesarias para esta actividad.'}
            </DialogDescription>
          </DialogHeader>
          {actionDialog && (
            <div className="space-y-4 pt-2">
              <div className="bg-muted rounded-lg p-3 text-sm">
                <p className="font-medium">{actionDialog.entrada.estudianteNombre}</p>
                <p className="text-muted-foreground mt-1">{actionDialog.entrada.descripcion}</p>
                <p className="text-muted-foreground mt-1">{actionDialog.entrada.horas} horas - Semana {actionDialog.entrada.semana}</p>
              </div>
              {(actionDialog.action === 'reject' || actionDialog.action === 'correct') && (
                <div>
                  <label className="text-sm font-medium">
                    {actionDialog.action === 'reject' ? 'Motivo del rechazo' : 'Correcciones solicitadas'}
                  </label>
                  <textarea
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring mt-1.5"
                    rows={3}
                    placeholder={actionDialog.action === 'reject' ? 'Ej: No se evidencia la actividad en las fotos.' : 'Ej: Falta foto de la instalación terminada.'}
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button
              className={actionDialog?.action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : actionDialog?.action === 'reject' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'}
              onClick={() => setActionDialog(null)}
            >
              {actionDialog?.action === 'approve' && 'Aprobar'}
              {actionDialog?.action === 'reject' && 'Rechazar'}
              {actionDialog?.action === 'correct' && 'Pedir Corrección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
