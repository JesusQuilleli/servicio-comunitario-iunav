"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Search } from "lucide-react";
import { Sidebar } from "@/components/Sidebar";
import { CambiarPassword } from "@/components/CambiarPassword";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/authStore";
import { TITULOS, viewDeRuta } from "@/lib/rutas";

/**
 * Marco del panel: barra lateral, encabezado y la pantalla que toca ver.
 *
 * Las vistas ya no se eligen con estado local sino por la ruta, asi que `children`
 * es la pagina de App Router que se esta mostrando. Aqui solo quedan las dos
 * comprovaciones que el servidor no puede hacer por si mismo: que haya sesion y
 * que la clave temporal este cambiada.
 */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { usuario, logout } = useAuthStore();

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

  // Con clave temporal el servidor responde 403 a todo menos al cambio de
  // contraseña, asi que la pantalla se muestra sola en vez de dejar al usuario
  // descubriendolo con errores.
  if (usuario.passwordTemporal) {
    return (
      <div className="flex h-screen items-center justify-center overflow-y-auto bg-background p-6">
        <div className="w-full space-y-4">
          <p className="text-center text-sm text-muted-foreground">
            Sesión de <span className="font-medium text-foreground">{usuario.nombreCompleto}</span>
          </p>
          <CambiarPassword obligatorio />
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Cerrar sesión
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const vista = viewDeRuta(pathname);
  const titulo = vista ? TITULOS[vista] : "Comunidad IUNAV";

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        userRole={usuario.rol}
        userName={usuario.nombreCompleto}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{titulo}</h2>
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

        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">{children}</main>
      </div>
    </div>
  );
}