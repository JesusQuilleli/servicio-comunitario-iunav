import { useState } from 'react';
import { Sidebar, type ViewKey } from '@/components/Sidebar';
import { LoginView } from '@/views/LoginView';
import { DashboardView } from '@/views/DashboardView';
import { UsuariosView } from '@/views/UsuariosView';
import { ProyectosView } from '@/views/ProyectosView';
import { BitacoraView } from '@/views/BitacoraView';
import { ServicioView } from '@/views/ServicioView';
import { ValidacionView } from '@/views/ValidacionView';
import { ConfiguracionView } from '@/views/ConfiguracionView';
import { RegistroUsuariosView } from '@/views/RegistroUsuariosView';
import { EstudianteDashboard } from '@/views/EstudianteDashboard';
import { TutorDashboard } from '@/views/TutorDashboard';
import { CoordinadorDashboard } from '@/views/CoordinadorDashboard';
import { Bell, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UserRole } from '@/data/mockData';

interface AuthState {
  isLoggedIn: boolean;
  role: UserRole;
  nombre: string;
}

const viewTitles: Record<ViewKey, string> = {
  dashboard: 'Dashboard',
  'registro-usuarios': 'Registro de Usuarios',
  usuarios: 'Gestión de Usuarios',
  proyectos: 'Grupos y Proyectos',
  bitacora: 'Bitácora Comunitario',
  servicio: 'Servicio Social y Ambiental',
  validacion: 'Validación',
  configuracion: 'Configuraciones y Plantillas',
};

function getDefaultView(_role: UserRole): ViewKey {
  return 'dashboard';
}

function ViewRenderer({ view, role }: { view: ViewKey; role: UserRole }) {
  if (view === 'dashboard') {
    switch (role) {
      case 'Estudiante':
        return <EstudianteDashboard />;
      case 'Tutor':
        return <TutorDashboard />;
      case 'Coordinador':
        return <CoordinadorDashboard />;
      default:
        return <DashboardView />;
    }
  }

  switch (view) {
    case 'registro-usuarios':
      return <RegistroUsuariosView />;
    case 'usuarios':
      return <UsuariosView />;
    case 'proyectos':
      return <ProyectosView />;
    case 'bitacora':
      return <BitacoraView />;
    case 'servicio':
      return <ServicioView />;
    case 'validacion':
      return <ValidacionView />;
    case 'configuracion':
      return <ConfiguracionView />;
    default:
      return <DashboardView />;
  }
}

function App() {
  const [auth, setAuth] = useState<AuthState>({ isLoggedIn: false, role: 'Estudiante', nombre: '' });
  const [activeView, setActiveView] = useState<ViewKey>('dashboard');

  const handleLogin = (role: UserRole, nombre: string) => {
    setAuth({ isLoggedIn: true, role, nombre });
    setActiveView(getDefaultView(role));
  };

  const handleLogout = () => {
    setAuth({ isLoggedIn: false, role: 'Estudiante', nombre: '' });
    setActiveView('dashboard');
  };

  if (!auth.isLoggedIn) {
    return <LoginView onLogin={handleLogin} />;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        activeView={activeView}
        onViewChange={setActiveView}
        userRole={auth.role}
        userName={auth.nombre}
        onLogout={handleLogout}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
          <h2 className="text-sm font-semibold text-foreground">{viewTitles[activeView]}</h2>
          <div className="flex items-center gap-3">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-9 w-56 h-8 text-sm"
              />
            </div>
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-iunav-red text-[10px] font-bold text-white">
                3
              </span>
            </Button>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <ViewRenderer view={activeView} role={auth.role} />
        </main>
      </div>
    </div>
  );
}

export default App;
