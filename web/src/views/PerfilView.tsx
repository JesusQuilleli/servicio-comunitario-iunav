"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Save,
  Send,
  User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CambiarPassword } from "@/components/CambiarPassword";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import type { SolicitudCambio, Usuario } from "@/lib/types";

const campoLabel: Record<string, string> = {
  nombre_completo: "Nombre completo",
  email: "Correo electrónico",
};

const estadoSolicitud: Record<
  SolicitudCambio["estado"],
  { label: string; variant: "warning" | "success" | "danger" }
> = {
  pendiente: { label: "Pendiente", variant: "warning" },
  aprobada: { label: "Aprobada", variant: "success" },
  rechazada: { label: "Rechazada", variant: "danger" },
};

function formatoFecha(valor: string): string {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return valor;
  return d.toLocaleDateString("es-VE", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Mi perfil: datos de la cuenta, solicitudes de cambio (estudiantes) y
 * contraseña. El estudiante propone y el coordinador aprueba; los demás roles
 * aplican el cambio en el acto.
 */
export function PerfilView() {
  const { usuario, token, setSession } = useAuthStore();
  const esEstudiante = usuario?.rol === "estudiante";

  const {
    data: datosSolicitudes,
    loading: cargandoSolicitudes,
    reload: recargarSolicitudes,
  } = useApiData<{ solicitudes: SolicitudCambio[] }>("/solicitudes/mias", esEstudiante);

  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Rellena el formulario cuando el usuario ya está cargado (o cambia):
  // ajuste durante el render en vez de un efecto con setState, según
  // https://react.dev/learn/you-might-not-need-an-effect
  const [perfilRef, setPerfilRef] = useState<string | null>(null);
  if (usuario && usuario.idUsuario !== perfilRef) {
    setPerfilRef(usuario.idUsuario);
    setNombre(usuario.nombreCompleto);
    setEmail(usuario.email);
  }

  if (!usuario) return null;

  const solicitudes = datosSolicitudes?.solicitudes ?? [];

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setExito(null);
    setEnviando(true);
    try {
      const { data } = await api.patch<{ usuario: Usuario; solicitudes: SolicitudCambio[] }>(
        "/auth/perfil",
        { nombreCompleto: nombre.trim(), email: email.trim() }
      );
      if (data.solicitudes.length > 0) {
        setExito(
          "Solicitud enviada. El coordinador la revisará y te notificaremos en esta misma sección."
        );
        recargarSolicitudes();
      } else {
        setSession(token ?? "", data.usuario);
        setExito("Datos actualizados correctamente.");
      }
    } catch (err: unknown) {
      const detalle = err as { response?: { data?: { message?: string } } };
      setError(detalle?.response?.data?.message ?? "No se pudieron guardar los cambios.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mi perfil</h2>
        <p className="text-muted-foreground text-sm mt-1">
          {esEstudiante
            ? "Puedes proponer cambios en tus datos; el coordinador debe autorizarlos."
            : "Actualiza los datos de tu cuenta."}
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <User className="h-4 w-4 text-iunav-blue" />
            Datos de la cuenta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge variant="outline">{usuario.rol}</Badge>
            <span className="text-xs text-muted-foreground">
              Cédula: {usuario.cedula}
            </span>
            {usuario.activo && (
              <Badge variant="success">Cuenta activa</Badge>
            )}
          </div>

          <form onSubmit={guardar} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="perfil-nombre" className="text-sm font-medium text-foreground">
                Nombre completo
              </label>
              <Input
                id="perfil-nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                minLength={3}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="perfil-email" className="text-sm font-medium text-foreground">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="perfil-email"
                  type="email"
                  className="pl-9"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {esEstudiante
                  ? "Es tu usuario de acceso; el cambio se aplica cuando el coordinador lo autorice."
                  : "Es tu usuario de acceso; se actualizará al guardar."}
              </p>
            </div>

            {error && (
              <p className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {error}
              </p>
            )}
            {exito && (
              <p className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                {exito}
              </p>
            )}

            <Button type="submit" disabled={enviando}>
              {enviando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : esEstudiante ? (
                <>
                  <Send className="h-4 w-4" />
                  Enviar solicitud
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar cambios
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {esEstudiante && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-iunav-blue" />
              Mis solicitudes de cambio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cargandoSolicitudes ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando solicitudes...
              </div>
            ) : solicitudes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No has enviado solicitudes de cambio.
              </p>
            ) : (
              <div className="space-y-3">
                {solicitudes.map((s) => {
                  const estado = estadoSolicitud[s.estado];
                  return (
                    <div key={s.idSolicitud} className="border rounded-lg p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-medium">{campoLabel[s.campo]}</span>
                        <Badge variant={estado.variant}>{estado.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {s.valorAnterior ? `${s.valorAnterior} → ` : ""}
                        <span className="text-foreground font-medium">{s.valorNuevo}</span>
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Enviada el {formatoFecha(s.creadoEn)}
                        {s.resueltoEn && ` · resuelta el ${formatoFecha(s.resueltoEn)}`}
                      </p>
                      {s.comentario && (
                        <p className="text-xs text-sky-700 mt-1 italic">
                          Comentario del coordinador: {s.comentario}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Cambiar contraseña</CardTitle>
        </CardHeader>
        <CardContent>
          <CambiarPassword />
        </CardContent>
      </Card>
    </div>
  );
}
