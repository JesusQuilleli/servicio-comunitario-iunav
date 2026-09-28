"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, GraduationCap, Loader2, Lock, Mail, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import { setSessionCookies } from "@/lib/cookies";
import type { LoginResponse } from "@/lib/types";

const DEMO_ACCOUNTS = [
  { email: "cmendoza@iunav.edu.ve", password: "admin123", label: "Admin", rol: "Administrador" },
  { email: "mlopez@iunav.edu.ve", password: "coord123", label: "Coordinador", rol: "Coordinador" },
  { email: "jperez@iunav.edu.ve", password: "tutor123", label: "Tutor", rol: "Tutor" },
  { email: "gmartinez@iunav.edu.ve", password: "est123", label: "Estudiante", rol: "Estudiante" },
];

export default function LoginPage() {
  const router = useRouter();
  const { setSession } = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Ingresa tu correo institucional y tu contraseña.");
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post<LoginResponse>("/auth/login", {
        email: email.trim(),
        password,
      });

      setSession(data.token, data.usuario);
      setSessionCookies(data.token, data.usuario.rol);
      router.push("/dashboard");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string } } };
      setError(axiosError?.response?.data?.message ?? "No se pudo conectar con el servidor. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (demo: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  };

  return (
    <div className="min-h-dvh bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-2xl overflow-hidden shadow-xl bg-white border">
        <div className="hidden md:flex relative flex-col justify-between bg-gradient-to-br from-iunav-blue to-iunav-blue-light p-10 text-white">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iunav-red">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold leading-tight">Comunidad IUNAV</h1>
              <p className="text-sm text-white/70">Universidad IUNAV</p>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold leading-snug">
              Sistema de Servicio Comunitario
            </h2>
            <p className="text-white/80 text-sm mt-3 leading-relaxed">
              Registro, seguimiento y validación de las horas de servicio comunitario
              (120h: 90h de trabajo directo + 30h de impacto social y ambiental) de los
              estudiantes de la Universidad IUNAV.
            </p>
            <div className="mt-6 space-y-3">
              {[
                "Bitácora digital con evidencia fotográfica",
                "Roles: administrador, coordinador, tutor y estudiante",
                "Reportes para validación institucional",
              ].map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-white/90">
                  <UserCheck className="h-4 w-4 mt-0.5 shrink-0 text-white/70" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/50">Periodo 2026-I · Servicio Comunitario IUNAV</p>
        </div>

        <div className="p-8 md:p-10">
          <div className="md:hidden flex items-center gap-3 mb-8">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-iunav-red">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold leading-tight">Comunidad IUNAV</h1>
              <p className="text-xs text-muted-foreground">Sistema de Servicio Comunitario</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-foreground">Iniciar Sesión</h2>
          <p className="text-sm text-muted-foreground mt-1 mb-6">
            Ingresa con tu correo institucional @iunav.edu.ve
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nombre@iunav.edu.ve"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-foreground">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="pl-9 pr-9"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando...
                </>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>

          <div className="mt-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-muted-foreground">Cuentas de demostración</span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((demo) => (
                <button
                  key={demo.email}
                  type="button"
                  onClick={() => fillDemo(demo)}
                  className="text-left border rounded-lg px-3 py-2 hover:border-iunav-blue hover:bg-blue-50/50 transition-colors"
                >
                  <p className="text-xs font-semibold text-foreground">{demo.rol}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{demo.email}</p>
                </button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Los datos de acceso son de prueba y se registran en el seed de la base de datos.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}