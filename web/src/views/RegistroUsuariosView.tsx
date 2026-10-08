"use client";

import { useState } from "react";
import { UserPlus, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/authStore";
import type { UserRole, Usuario } from "@/lib/types";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "estudiante", label: "Estudiante" },
  { value: "tutor", label: "Tutor" },
  { value: "coordinador", label: "Coordinador" },
  { value: "admin", label: "Administrador" },
];

export function RegistroUsuariosView() {
  const usuario = useAuthStore((s) => s.usuario);
  const esAdmin = usuario?.rol === "admin";
  // El coordinador da de alta tutores y estudiantes; los roles por encima de
  // el los crea el administrador.
  const rolesDisponibles = esAdmin ? ROLES : ROLES.filter((r) => r.value === "estudiante" || r.value === "tutor");

  const [nombreCompleto, setNombreCompleto] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<UserRole>("estudiante");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setExito(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      setError("La contraseña debe incluir al menos una letra y un número.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      const { data } = await api.post<{ usuario: Usuario }>("/auth/register", {
        nombreCompleto: nombreCompleto.trim(),
        cedula: cedula.trim(),
        email: email.trim(),
        password,
        rol,
      });
      setExito(`Usuario "${data.usuario.nombreCompleto}" (${rol}) registrado correctamente.`);
      setNombreCompleto("");
      setCedula("");
      setEmail("");
      setPassword("");
      setConfirmar("");
      setRol("estudiante");
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { message?: string }; status?: number } };
      const status = axiosError?.response?.status;
      const msg = axiosError?.response?.data?.message;
      if (status === 409) setError(msg ?? "Ya existe un usuario con ese correo electrónico.");
      else setError(msg ?? "No se pudo registrar el usuario. Intenta nuevamente.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Registro de Usuarios</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {esAdmin
            ? "Crea cuentas para estudiantes, tutores, coordinadores y administradores."
            : "Crea cuentas para estudiantes y tutores."}
        </p>
      </div>

      <div className="max-w-2xl">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-iunav-blue" />
              Nuevo Usuario
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="nombre" className="text-sm font-medium text-foreground">
                    Nombre completo
                  </label>
                  <Input
                    id="nombre"
                    placeholder="Ej. Mariana Rojas"
                    value={nombreCompleto}
                    onChange={(e) => setNombreCompleto(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="cedula" className="text-sm font-medium text-foreground">
                    Cédula
                  </label>
                  <Input
                    id="cedula"
                    placeholder="Ej. V-24.123.456"
                    value={cedula}
                    onChange={(e) => setCedula(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Correo institucional
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="nombre@iunav.edu.ve"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="rol" className="text-sm font-medium text-foreground">
                    Rol
                  </label>
                  <select
                    id="rol"
                    value={rol}
                    onChange={(e) => setRol(e.target.value as UserRole)}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {rolesDisponibles.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Contraseña
                  </label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Mínimo 8 caracteres, con letra y número"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="confirmar" className="text-sm font-medium text-foreground">
                    Confirmar contraseña
                  </label>
                  <Input
                    id="confirmar"
                    type="password"
                    placeholder="Repite la contraseña"
                    value={confirmar}
                    onChange={(e) => setConfirmar(e.target.value)}
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
              {exito && (
                <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                  {exito}
                </div>
              )}

              <Button type="submit" disabled={enviando}>
                {enviando ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    Registrar usuario
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}