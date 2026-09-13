import { FileUp, Presentation, Upload } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useState } from 'react';
import { proyectos } from '@/data/mockData';

const estadoVariant: Record<string, 'success' | 'info' | 'warning' | 'danger'> = {
  'En Curso': 'info',
  'Finalizado': 'success',
  'Pendiente Aprobación': 'warning',
  'Suspendido': 'danger',
};

export function ProyectosView() {
  const [uploadDialog, setUploadDialog] = useState<{ tipo: string; proyecto: string } | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Grupos y Proyectos</h2>
        <p className="text-muted-foreground text-sm mt-1">Proyectos de servicio comunitario del periodo actual</p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Proyectos Registrados ({proyectos.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Proyecto</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Periodo</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Tutor</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Integrantes</th>
                  <th className="text-left font-medium text-muted-foreground px-5 py-3">Estado</th>
                  <th className="text-center font-medium text-muted-foreground px-5 py-3">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((proyecto) => (
                  <tr key={proyecto.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="max-w-xs">
                        <p className="font-medium text-foreground leading-snug">{proyecto.nombre}</p>
                        <div className="flex gap-1.5 mt-1">
                          {proyecto.proyectoEscritoSubido ? (
                            <Badge variant="success" className="text-[10px] py-0">Escrito subido</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0">Sin escrito</Badge>
                          )}
                          {proyecto.diapositivasSubidas ? (
                            <Badge variant="success" className="text-[10px] py-0">Diapositivas subidas</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] py-0">Sin diapositivas</Badge>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{proyecto.periodo}</td>
                    <td className="px-5 py-3 text-muted-foreground">{proyecto.tutorNombre}</td>
                    <td className="px-5 py-3">
                      <div className="flex -space-x-2">
                        {proyecto.integrantes.slice(0, 4).map((int) => (
                          <Avatar key={int.id} className="h-7 w-7 border-2 border-white">
                            <AvatarFallback className="text-[10px] bg-iunav-blue/10 text-iunav-blue font-semibold">
                              {int.iniciales}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {proyecto.integrantes.length > 4 && (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-muted text-[10px] font-medium">
                            +{proyecto.integrantes.length - 4}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {proyecto.integrantes.map(i => i.nombre.split(' ')[0]).join(', ')}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={estadoVariant[proyecto.estado] || 'outline'}>
                        {proyecto.estado}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => setUploadDialog({ tipo: 'proyecto', proyecto: proyecto.nombre })}
                        >
                          <FileUp className="h-3.5 w-3.5" />
                          Proyecto
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-xs h-8"
                          onClick={() => setUploadDialog({ tipo: 'diapositivas', proyecto: proyecto.nombre })}
                        >
                          <Presentation className="h-3.5 w-3.5" />
                          Diapositivas
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

      <Dialog open={!!uploadDialog} onOpenChange={() => setUploadDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Subir {uploadDialog?.tipo === 'proyecto' ? 'Proyecto Escrito' : 'Diapositivas'}
            </DialogTitle>
            <DialogDescription>
              {uploadDialog?.tipo === 'proyecto'
                ? 'Sube el documento PDF del proyecto escrito para revisión.'
                : 'Sube las diapositivas de presentación del proyecto.'}
            </DialogDescription>
          </DialogHeader>
          <div className="border-2 border-dashed border-muted rounded-lg p-8 text-center hover:border-iunav-blue/40 transition-colors cursor-pointer">
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Arrastra el archivo aquí o haz clic para seleccionar</p>
            <p className="text-xs text-muted-foreground mt-1">
              {uploadDialog?.tipo === 'proyecto' ? 'PDF, DOCX (máx. 10MB)' : 'PPTX, PDF (máx. 20MB)'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog(null)}>Cancelar</Button>
            <Button onClick={() => setUploadDialog(null)}>Subir Archivo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
