import { Download, FileText, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { plantillas, configuracion } from '@/data/mockData';
import { useState } from 'react';

const tipoIcon: Record<string, string> = {
  PDF: 'text-red-500',
  DOCX: 'text-blue-500',
  PPTX: 'text-orange-500',
};

export function ConfiguracionView() {
  const [config, setConfig] = useState(configuracion);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Configuraciones y Plantillas</h2>
        <p className="text-muted-foreground text-sm mt-1">Administrar plantillas y configuración del sistema</p>
      </div>

      <Tabs defaultValue="plantillas" className="space-y-6">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="plantillas" className="flex-1 sm:flex-none gap-2">
            <FileText className="h-4 w-4" />
            Plantillas y Guías
          </TabsTrigger>
          <TabsTrigger value="configuracion" className="flex-1 sm:flex-none gap-2">
            Configuraciones del Sistema
          </TabsTrigger>
        </TabsList>

        <TabsContent value="plantillas">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Documentos y Plantillas Disponibles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {plantillas.map((plantilla) => (
                  <div
                    key={plantilla.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:border-iunav-blue/30 hover:shadow-sm transition-all group"
                  >
                    <div className={`shrink-0 p-2.5 rounded-lg bg-muted ${tipoIcon[plantilla.tipo] || 'text-gray-500'}`}>
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm leading-snug">{plantilla.nombre}</p>
                      <p className="text-xs text-muted-foreground mt-1 leading-snug">{plantilla.descripcion}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{plantilla.tipo}</Badge>
                        <span className="text-[10px] text-muted-foreground">{plantilla.tamano}</span>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download className="h-3.5 w-3.5" />
                      Descargar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuracion">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Configuración General del Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-lg space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-2">Parámetros del Servicio Comunitario</h3>
                  <div>
                    <label className="text-sm font-medium">Horas Totales Requeridas</label>
                    <Input
                      type="number"
                      value={config.horasTotalesRequeridas}
                      onChange={(e) => setConfig({ ...config, horasTotalesRequeridas: Number(e.target.value) })}
                      className="mt-1.5 max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Total de horas que debe completar cada estudiante</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Límite de Horas Diarias</label>
                    <Input
                      type="number"
                      value={config.limiteHorasDiarias}
                      onChange={(e) => setConfig({ ...config, limiteHorasDiarias: Number(e.target.value) })}
                      className="mt-1.5 max-w-xs"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Máximo de horas que un estudiante puede registrar por día</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-foreground border-b pb-2">Periodo Académico</h3>
                  <div>
                    <label className="text-sm font-medium">Periodo Actual</label>
                    <Input
                      value={config.periodoActual}
                      onChange={(e) => setConfig({ ...config, periodoActual: e.target.value })}
                      className="mt-1.5 max-w-xs"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Fecha de Inicio</label>
                      <Input
                        type="date"
                        value={config.fechaInicioPeriodo}
                        onChange={(e) => setConfig({ ...config, fechaInicioPeriodo: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Fecha de Fin</label>
                      <Input
                        type="date"
                        value={config.fechaFinPeriodo}
                        onChange={(e) => setConfig({ ...config, fechaFinPeriodo: e.target.value })}
                        className="mt-1.5"
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button className="gap-2">
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
