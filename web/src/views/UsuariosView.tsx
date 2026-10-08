"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Users,
  Loader2,
  RefreshCw,
  AlertTriangle,
  Power,
  Search,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FirmaSello } from "@/components/FirmaSello";
import { RestablecerPassword } from "@/components/RestablecerPassword";
import { CargaMasivaEstudiantes } from "@/components/CargaMasivaEstudiantes";
import { api } from "@/lib/api";
import { useApiData } from "@/lib/useApiData";
import { useAuthStore } from "@/stores/authStore";
import type { SolicitudCambio, UserRole, Usuario } from "@/lib/types";

const rolBadge: Record<UserRole, "danger" | "warning" | "info" | "secondary"> = {
  admin: "danger",
  coordinador: "warning",
  tutor: "info",
  estudiante: "secondary",
};

const campoSolicitudLabel: Record<string, string> = {
  nombre_completo: "Nombre completo",
  email: "Correo electrónico",
};

const estadoSolicitudBadge: Record<
  SolicitudCambio["estado"],
  "warning" | "success" | "danger"
> = {
  pendiente: "warning",
  aprobada: "success",
  rechazada: "danger",
};

export function UsuariosView() {
  const usuario = useAuthStore((s) => s.usuario);
  const esAdmin = usuario?.rol === "admin";
  const esGestion = esAdmin || usuario?.rol === "coordinador";

  const { data, loading, error, reload } = useApiData<{ usuarios: Usuario[] }>("/usuarios");
  const {
    data: datosSolicitudes,
    reload: recargarSolicitudes,
  } = useApiData<{ solicitudes: SolicitudCambio[] }>("/solicitudes?estado=todas");
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<UserRole | "todos">("todos");
  const [toggling, setToggling] = useState<string | null>(null);
  const [errorToggle, setErrorToggle] = useState<string | null>(null);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [errorSolicitud, setErrorSolicitud] = useState<string | null>(null);

  const solicitudes = datosSolicitudes?.solicitudes ?? [];
  const pendientes = solicitudes.filter((s) => s.estado === "pendiente");

  // Precarga los filtros cuando la vista se abre desde un enlace
  // (dashboard, búsqueda global): /usuarios?rol=tutor&q=...
  // Se lee `window.location` en un efecto de una sola vez a propósito:
  // `useSearchParams` exigiría un Suspense boundary en toda la vista.
  /* eslint-disable react-hooks/set-state-in-effect -- carga única al montar */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    const rol = params.get("rol");
    if (q) setBusqueda(q);
    if (rol === "admin" || rol === "coordinador" || rol === "tutor" || rol === "estudiante") {
      setFiltroRol(rol);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const usuarios = useMemo(() => data?.usuarios ?? [], [data]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return usuarios.filter((u) => {
      const coincideRol = filtroRol === "todos" || u.rol === filtroRol;
      const coincideTexto =
        q === "" ||
        u.nombreCompleto.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.cedula.toLowerCase().includes(q);
      return coincideRol && coincideTexto;
    });
  }, [usuarios, busqueda, filtroRol]);

  const toggleActivo = async (u: Usuario) => {
    if (!esAdmin || !usuario) return;
    setToggling(u.idUsuario);
    setErrorToggle(null);
    try {
      await api.patch(`/usuarios/${u.idUsuario}/activo`, { activo: !u.activo });
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorToggle(msg ?? "No se pudo actualizar el usuario.");
    } finally {
      setToggling(null);
    }
  };

  const resolverSolicitud = async (
    solicitud: SolicitudCambio,
    accion: "aprobar" | "rechazar"
  ) => {
    let comentario: string | undefined;
    if (accion === "aprobar") {
      const ok = window.confirm(
        `¿Aplicar el cambio de ${
          solicitud.campo === "email" ? "correo" : "nombre"
        } a la cuenta de ${solicitud.estudianteNombre ?? "estudiante"}?`
      );
      if (!ok) return;
    } else {
      const texto = window.prompt("Comentario para el estudiante (opcional):");
      if (texto === null) return;
      comentario = texto.trim() || undefined;
    }

    setResolviendo(solicitud.idSolicitud);
    setErrorSolicitud(null);
    try {
      await api.patch(`/solicitudes/${solicitud.idSolicitud}`, {
        accion,
        comentario,
      });
      recargarSolicitudes();
      reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setErrorSolicitud(msg ?? "No se pudo resolver la solicitud.");
    } finally {
      setResolviendo(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Gestión de Usuarios</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {esAdmin
              ? "Consulta y administra el estado de todos los usuarios del sistema."
              : "Consulta el registro de usuarios del sistema."}
          </p>
        </div>
        {esGestion && <CargaMasivaEstudiantes onImportado={reload} />}
      </div>

      {solicitudes.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Solicitudes de cambio ({pendientes.length} pendiente{pendientes.length === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {errorSolicitud && (
              <div className="flex items-center gap-2 mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {errorSolicitud}
              </div>
            )}
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Estudiante</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Campo</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Cambio pedido</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Estado</th>
                    <th className="text-right font-medium text-muted-foreground px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {solicitudes.map((s) => (
                    <tr key={s.idSolicitud} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-medium">{s.estudianteNombre ?? "—"}</td>
                      <td className="px-4 py-3">{campoSolicitudLabel[s.campo]}</td>
                      <td className="px-4 py-3">
                        <span className="text-muted-foreground">{s.valorAnterior} → </span>
                        <span className="font-medium">{s.valorNuevo}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={estadoSolicitudBadge[s.estado]}>
                          {s.estado === "pendiente"
                            ? "Pendiente"
                            : s.estado === "aprobada"
                              ? "Aprobada"
                              : "Rechazada"}
                        </Badge>
                        {s.comentario && (
                          <p className="text-xs text-muted-foreground mt-1 italic max-w-48 truncate">
                            {s.comentario}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {s.estado === "pendiente" ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-emerald-700 hover:bg-emerald-50"
                              disabled={resolviendo === s.idSolicitud}
                              onClick={() => resolverSolicitud(s, "aprobar")}
                            >
                              {resolviendo === s.idSolicitud ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-3.5 w-3.5" />
                              )}
                              Aprobar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1.5 text-red-600 hover:bg-red-50"
                              disabled={resolviendo === s.idSolicitud}
                              onClick={() => resolverSolicitud(s, "rechazar")}
                            >
                              Rechazar
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-xs text-muted-foreground">
                            {s.resueltoEn ? new Date(s.resueltoEn).toLocaleDateString("es-VE") : ""}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-iunav-blue" />
            Usuarios ({filtrados.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre, correo o cédula..."
                className="pl-9"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
              />
            </div>
            <select
              value={filtroRol}
              onChange={(e) => setFiltroRol(e.target.value as UserRole | "todos")}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="todos">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="coordinador">Coordinadores</option>
              <option value="tutor">Tutores</option>
              <option value="estudiante">Estudiantes</option>
            </select>
          </div>

          {errorToggle && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errorToggle}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 text-iunav-blue animate-spin" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando usuarios...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center py-10 text-center gap-3">
              <AlertTriangle className="h-8 w-8 text-amber-500" />
              <p className="text-sm text-muted-foreground max-w-md">{error}</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={reload}>
                <RefreshCw className="h-3.5 w-3.5" />
                Reintentar
              </Button>
            </div>
          ) : filtrados.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No se encontraron usuarios que coincidan con la búsqueda.
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Usuario</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Cédula</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Correo</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Rol</th>
                    <th className="text-left font-medium text-muted-foreground px-4 py-3">Estado</th>
                    {esAdmin && (
                      <th className="text-left font-medium text-muted-foreground px-4 py-3">
                        Firma y sello
                      </th>
                    )}
                    {esAdmin && (
                      <th className="text-right font-medium text-muted-foreground px-4 py-3">
                        Acciones
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((u) => (
                    <tr key={u.idUsuario} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-iunav-blue/10 text-xs font-bold text-iunav-blue">
                            {u.nombreCompleto
                              .split(" ")
                              .map((n) => n[0])
                              .slice(0, 2)
                              .join("")
                              .toUpperCase()}
                          </div>
                          <span className="font-medium">{u.nombreCompleto}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.cedula}</td>
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">
                        <Badge variant={rolBadge[u.rol]}>{u.rol}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={u.activo ? "success" : "outline"}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                      {esAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex gap-6">
                            <FirmaSello
                              idUsuario={u.idUsuario}
                              tipo="firma"
                              rutaActual={u.firmaUrl}
                              puedeSubir
                              alCambiar={reload}
                            />
                            <FirmaSello
                              idUsuario={u.idUsuario}
                              tipo="sello"
                              rutaActual={u.selloUrl}
                              puedeSubir
                              alCambiar={reload}
                            />
                          </div>
                        </td>
                      )}
                      {esAdmin && (
                        <td className="px-4 py-3">
                          <div className="flex flex-col items-end gap-1">
                            {u.passwordTemporal && (
                              <Badge variant="warning" className="text-[10px]">
                                Clave temporal
                              </Badge>
                            )}
                            <div className="inline-flex gap-1">
                              {u.idUsuario !== usuario?.idUsuario && (
                                <>
                                  <RestablecerPassword
                                    idUsuario={u.idUsuario}
                                    nombre={u.nombreCompleto}
                                    onRestablecido={reload}
                                  />
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 text-xs"
                                    disabled={toggling === u.idUsuario}
                                    onClick={() => toggleActivo(u)}
                                  >
                                    {toggling === u.idUsuario ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Power className="h-3.5 w-3.5" />
                                    )}
                                    {u.activo ? "Desactivar" : "Activar"}
                                  </Button>
                                </>
                              )}
                            </div>
                            {u.idUsuario === usuario?.idUsuario && (
                              <span className="text-xs text-muted-foreground">Cuenta actual</span>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}