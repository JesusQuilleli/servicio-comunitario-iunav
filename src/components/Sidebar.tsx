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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import type { UserRole } from '@/data/mockData';

export type ViewKey =
  | 'dashboard'
  | 'usuarios'
  | 'proyectos'
  | 'bitacora'
  | 'servicio'
  | 'validacion'
  | 'configuracion'
  | 'registro-usuarios';

interface NavItem {
  key: ViewKey;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const navItems: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Admin', 'Coordinador', 'Tutor', 'Estudiante'] },
  { key: 'registro-usuarios', label: 'Registro de Usuarios', icon: UserPlus, roles: ['Admin'] },
  { key: 'usuarios', label: 'Gestión de Usuarios', icon: Users, roles: ['Admin', 'Coordinador'] },
  { key: 'proyectos', label: 'Grupos y Proyectos', icon: FolderKanban, roles: ['Admin', 'Coordinador', 'Tutor'] },
  { key: 'bitacora', label: 'Bitácora Comunitario', icon: Clock, roles: ['Admin', 'Coordinador', 'Tutor', 'Estudiante'] },
  { key: 'servicio', label: 'Servicio Social y Ambiental', icon: Leaf, roles: ['Admin', 'Coordinador', 'Tutor', 'Estudiante'] },
  { key: 'validacion', label: 'Validación', icon: CheckCircle, roles: ['Admin', 'Coordinador', 'Tutor'] },
  { key: 'configuracion', label: 'Configuraciones', icon: Settings, roles: ['Admin', 'Coordinador'] },
];

const roleLabels: Record<UserRole, string> = {
  Admin: 'Administrador',
  Coordinador: 'Coordinador',
  Tutor: 'Tutor',
  Estudiante: 'Estudiante',
};

interface SidebarProps {
  activeView: ViewKey;
  onViewChange: (view: ViewKey) => void;
  userRole: UserRole;
  userName: string;
  onLogout: () => void;
}

export function Sidebar({ activeView, onViewChange, userRole, userName, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const visibleItems = navItems.filter((item) => item.roles.includes(userRole));
  const initials = userName.split(' ').map(n => n[0]).slice(0, 2).join('');

  return (
    <aside
      className={cn(
        'flex flex-col bg-iunav-blue text-white transition-all duration-300 ease-in-out h-screen sticky top-0',
        collapsed ? 'w-[68px]' : 'w-[260px]'
      )}
    >
      {/* Header */}
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

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto scrollbar-thin py-3 px-2">
        <ul className="space-y-1">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;
            return (
              <li key={item.key}>
                <button
                  onClick={() => onViewChange(item.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-white/15 text-white shadow-sm'
                      : 'text-white/70 hover:bg-white/8 hover:text-white'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className={cn('h-5 w-5 shrink-0', isActive && 'text-white')} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-white/10 px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iunav-red text-xs font-bold">
            {initials}
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="text-sm font-medium truncate">{userName}</p>
              <p className="text-[11px] text-white/50 truncate">{roleLabels[userRole]}</p>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-white/50 hover:text-white hover:bg-white/10 shrink-0"
              onClick={onLogout}
              title="Cerrar Sesión"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center py-2 border-t border-white/10 text-white/50 hover:text-white hover:bg-white/5 transition-colors"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </button>
    </aside>
  );
}
