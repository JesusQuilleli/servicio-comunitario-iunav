"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Sidebar, type ViewKey } from "@/components/Sidebar";
import { ModuloEnConstruccion, viewTitles } from "@/components/ModuloEnConstruccion";
import { RegistroUsuariosView } from "@/views/RegistroUsuariosView";
import { UsuariosView } from "@/views/UsuariosView";
import { ProyectosView } from "@/views/ProyectosView";
import { RegistroHorasView } from "@/views/RegistroHorasView";
import { ValidacionView } from "@/views/ValidacionView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/authStore";

export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { usuario, logout } = useAuthStore();
  const [activeView, setActiveView] = useState<ViewKey>("dashboard");

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
    }
  }, [usuario, router]);

  if (!usuario) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  const renderView = (view: ViewKey, contenido: React.ReactNode) => {
    switch (view) {
      case "dashboard":
        return contenido;
      case "registro-usuarios":
        return <RegistroUsuariosView />;
      case "usuarios":
        return <UsuariosView />;
      case "proyectos":
        return <ProyectosView />;
      case "bitacora":
        return <RegistroHorasView tipo="comunitario" />;
      case "servicio":
        return <RegistroHorasView tipo="servicio" />;
      case "validacion":
        return <ValidacionView />;
      default:
        return <ModuloEnConstruccion titulo={viewTitles[view]} />;
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        userRole={usuario.rol}
        userName={usuario.nombreCompleto}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{viewTitles[activeView]}</h2>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." className="pl-9 w-56 h-8 text-sm" />
            </div>
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-iunav-red text-[10px] font-bold text-white">
                3
              </span>
            </Button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {renderView(activeView, children)}
        </main>
      </div>
    </div>
  );
}