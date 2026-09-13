import { CheckCircle, XCircle, Pencil, Image, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';
import { bitacoraComunitario, bitacoraSocial, bitacoraAmbiental } from '@/data/mockData';

type Action = 'approve' | 'reject' | 'correct' | null;

export function ValidacionView() {
  const tutorName = 'José Rafael Pérez';

  const pendientesComunitario = bitacoraComunitario.filter(
    (b) => b.estado === 'Pendiente' || b.estado === 'Corregir'
  );
  const pendientesSocial = bitacoraSocial.filter(
    (b) => b.estado === 'Pendiente' || b.estado === 'Corregir'
  );
  const pendientesAmbiental = bitacoraAmbiental.filter(
    (b) => b.estado === 'Pendiente' || b.estado === 'Corregir'
  );

  const allPendientes = [...pendientesComunitario, ...pendientesSocial, ...pendientesAmbiental];

  const [actionDialog, setActionDialog] = useState<{
    entrada: typeof allPendientes[0];
    action: Action;
  } | null>(null);

  const tipoLabel: Record<string, string> = {
    comunitario: 'Comunitario',
    social: 'Social',
    ambiental: 'Ambiental',
  };

  const tipoColor: Record<string, string> = {
    comunitario: 'bg-iunav-blue/10 text-iunav-blue',
    social: 'bg-iunav-red/10 text-iunav-red',
    ambiental: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Validación de Horas</h2>
        <p className="text-muted-foreground text-sm mt-1">Panel del Tutor - {tutorName}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-blue-50">
              <CheckCircle className="h-6 w-6 text-iunav-blue" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendientesComunitario.length}</p>
              <p className="text-sm text-muted-foreground">Comunitario pendiente</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-red-50">
              <XCircle className="h-6 w-6 text-iunav-red" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendientesSocial.length}</p>
              <p className="text-sm text-muted-foreground">Social pendiente</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-50">
              <Pencil className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendientesAmbiental.length}</p>
              <p className="text-sm text-muted-foreground">Ambiental pendiente</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Activities Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Actividades Pendientes de Revisión ({allPendientes.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Estudiante</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Tipo</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Semana</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Fecha</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Descripción</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Horas</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Evidencia</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {allPendientes.map((entrada) => (
                  <tr key={entrada.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3 font-medium">{entrada.estudianteNombre}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tipoColor[entrada.tipo]}`}>
                        {tipoLabel[entrada.tipo]}
                      </span>
                    </td>
                    <td className="px-5 py-3">Semana {entrada.semana}</td>
                    <td className="px-5 py-3 text-muted-foreground">{entrada.fecha}</td>
                    <td className="px-5 py-3 max-w-xs">
                      <p className="leading-snug">{entrada.descripcion}</p>
                    </td>
                    <td className="px-5 py-3 text-center font-semibold">{entrada.horas}h</td>
                    <td className="px-5 py-3 text-center">
                      {entrada.evidenciaFotografica ? (
                        <button className="inline-flex items-center gap-1 text-iunav-blue hover:text-iunav-blue-light transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : (
                        <Image className="h-4 w-4 mx-auto text-muted-foreground" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={entrada.estado === 'Pendiente' ? 'warning' : 'outline'}>
                        {entrada.estado}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                          onClick={() => setActionDialog({ entrada, action: 'approve' })}
                          title="Aprobar"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setActionDialog({ entrada, action: 'reject' })}
                          title="Rechazar"
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                          onClick={() => setActionDialog({ entrada, action: 'correct' })}
                          title="Pedir Corrección"
                        >
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

      {/* Action Confirmation Dialog */}
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
                    placeholder={
                      actionDialog.action === 'reject'
                        ? 'Ej: No se evidencia la actividad en las fotos proporcionadas.'
                        : 'Ej: Falta foto de la instalación terminada.'
                    }
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog(null)}>Cancelar</Button>
            <Button
              className={
                actionDialog?.action === 'approve'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : actionDialog?.action === 'reject'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-amber-600 hover:bg-amber-700 text-white'
              }
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
