import {
  LayoutDashboard,
  Users,
  FolderKanban,
  Clock,
  Leaf,
  CheckCircle,
  Settings,
  GraduationCap,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  LogOut,
  User,
  FileBarChart,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/lib/types";
import { ROLES_POR_RUTA, RUTAS, viewDeRuta } from "@/lib/rutas";

interface NavItem {
  key: keyof typeof RUTAS;
  label: string;
  icon: React.ElementType;
}

// Los roles no se repiten aqui: salen de `ROLES_POR_RUTA`, la misma tabla que
// usa `proxy.ts` para cortar la ruta. Si el menu y el proxy se olvidaran de un
// rol, el menu ofreceria una pantalla que el servidor va a rechazar.
const navItems: NavItem[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "registro-usuarios", label: "Registro de Usuarios", icon: UserPlus },
  { key: "usuarios", label: "Gestión de Usuarios", icon: Users },
  { key: "proyectos", label: "Grupos y Proyectos", icon: FolderKanban },
  { key: "bitacora", label: "Bitácora Comunitario", icon: Clock },
  { key: "servicio", label: "Servicio Social y Ambiental", icon: Leaf },
  { key: "validacion", label: "Validación", icon: CheckCircle },
  { key: "configuracion", label: "Configuraciones", icon: Settings },
  { key: "reportes", label: "Reportes", icon: FileBarChart },
  { key: "perfil", label: "Mi perfil", icon: User },
];

const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  tutor: "Tutor",
  estudiante: "Estudiante",
};

interface SidebarProps {
  userRole: UserRole;
  userName: string;
  onLogout: () => void;
}

export function Sidebar({ userRole, userName, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const vistaActual = viewDeRuta(pathname);

  const visibleItems = navItems.filter((item) => ROLES_POR_RUTA[item.key].includes(userRole));
  const initials = userName.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <aside
      className={cn(
        "flex flex-col bg-iunav-blue text-white transition-all duration-300 ease-in-out h-screen sticky top-0",
        collapsed ? "w-[68px]" : "w-[260px]"
      )}
    >
      <div className="flex items-center gap-3 px-4 py-5 border-b border-white/10">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-iunav-red">
          <GraduationCap className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold leading-tight tracking-tight">Comunidad IUNAV</h1>
            <p className="text-[11px] text-white/60 leading-tight">{roleLabels[userRole]}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = vistaActual === item.key;
            return (
              <li key={item.key}>
                <Link
                  href={RUTAS[item.key]}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-white/15 text-white shadow-sm"
                      : "text-white/70 hover:bg-white/10 hover:text-white"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-white")} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-3">
          <Link
            href={RUTAS.perfil}
            aria-label="Mi perfil"
            title="Mi perfil"
            className="flex items-center gap-3 flex-1 min-w-0 rounded-md py-1 pr-1 transition-colors hover:bg-white/5"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iunav-red text-xs font-bold">
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden text-left">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-[11px] text-white/50 truncate">{roleLabels[userRole]}</p>
              </div>
            )}
          </Link>
          {!collapsed && (
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
                onClick={onLogout}
                title="Cerrar Sesión"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-2 border-t border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}