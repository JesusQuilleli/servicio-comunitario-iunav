import { useState } from 'react';
import { GraduationCap, Eye, EyeOff, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import type { UserRole } from '@/data/mockData';

interface LoginViewProps {
  onLogin: (role: UserRole, nombre: string) => void;
}

const demoAccounts: { role: UserRole; nombre: string; correo: string; password: string }[] = [
  { role: 'Admin', nombre: 'Carlos Mendoza', correo: 'cmendoza@iunav.edu.ve', password: 'admin123' },
  { role: 'Coordinador', nombre: 'María Fernanda López', correo: 'mlopez@iunav.edu.ve', password: 'coord123' },
  { role: 'Tutor', nombre: 'José Rafael Pérez', correo: 'jperez@iunav.edu.ve', password: 'tutor123' },
  { role: 'Estudiante', nombre: 'Gabriela Martínez', correo: 'gmartinez@iunav.edu.ve', password: 'est123' },
];

export function LoginView({ onLogin }: LoginViewProps) {
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const account = demoAccounts.find((a) => a.correo === correo && a.password === password);
    if (account) {
      onLogin(account.role, account.nombre);
    } else {
      setError('Credenciales incorrectas. Intenta con una cuenta de demostración.');
    }
  };

  const handleDemoLogin = (account: typeof demoAccounts[0]) => {
    onLogin(account.role, account.nombre);
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-iunav-blue via-iunav-blue-light to-iunav-blue-dark relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-iunav-red rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          <div className="flex items-center gap-4 mb-8">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-iunav-red">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Comunidad IUNAV</h1>
              <p className="text-white/60 text-sm">Instituto Universitario de Aviación</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Sistema de Gestión de Servicio Comunitario
          </h2>
          <p className="text-white/70 text-lg leading-relaxed max-w-md">
            Plataforma integral para la administración, seguimiento y validación de las horas de servicio comunitario, social y ambiental.
          </p>
          <div className="mt-12 grid grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-3xl font-bold">120h</p>
              <p className="text-white/50 text-sm mt-1">Comunitario</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">40h</p>
              <p className="text-white/50 text-sm mt-1">Social</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold">40h</p>
              <p className="text-white/50 text-sm mt-1">Ambiental</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-iunav-red">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Comunidad IUNAV</h1>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-foreground">Iniciar Sesión</h2>
            <p className="text-muted-foreground text-sm mt-2">
              Ingresa tus credenciales para acceder al sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Correo electrónico</label>
              <Input
                type="email"
                placeholder="usuario@iunav.edu.ve"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className="mt-1.5 h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Contraseña</label>
              <div className="relative mt-1.5">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Ingresa tu contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 gap-2 text-sm font-semibold">
              <LogIn className="h-4 w-4" />
              Iniciar Sesión
            </Button>
          </form>

          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Cuentas de demostración</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              {demoAccounts.map((account) => (
                <Card
                  key={account.role}
                  className="cursor-pointer hover:border-iunav-blue/40 hover:shadow-sm transition-all"
                  onClick={() => handleDemoLogin(account)}
                >
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold text-iunav-blue">{account.role}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{account.nombre}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
