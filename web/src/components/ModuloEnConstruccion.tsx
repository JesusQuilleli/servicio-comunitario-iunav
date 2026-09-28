import { Hammer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function ModuloEnConstruccion({ titulo }: { titulo: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">{titulo}</h2>
        <p className="text-muted-foreground text-sm mt-1">
          Este módulo se conectará al backend en una próxima fase.
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-12 flex flex-col items-center justify-center text-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Hammer className="h-8 w-8 text-muted-foreground" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Módulo en construcción</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-md">
              La autenticación, el enrutamiento protegido por rol y el dashboard ya están operativos.
              Este módulo se implementará en las siguientes fases del proyecto.
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.history.back()}>
            Volver
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const viewTitles: Record<string, string> = {
  dashboard: "Dashboard",
  "registro-usuarios": "Registro de Usuarios",
  usuarios: "Gestión de Usuarios",
  proyectos: "Grupos y Proyectos",
  bitacora: "Bitácora Comunitario",
  servicio: "Servicio Social y Ambiental",
  validacion: "Validación",
  configuracion: "Configuraciones y Plantillas",
};

export { viewTitles };