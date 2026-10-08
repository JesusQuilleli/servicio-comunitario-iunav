import type { UserRole } from "@/lib/types";

/**
 * Navegacion del panel.
 *
 * Cada modulo tiene su propia ruta real del App Router: el menu usa `Link` y la
 * vista se elige leyendo el pathname, asi que una URL se puede compartir,
 * recargar o marcar como favorita. Las rutas coinciden con las que declara el
 * backend en `server/src/routes`, y los roles son los mismos para que el menu
 * no ofrezca pantallas que el servidor va a rechazar.
 */

export const RUTAS = {
  dashboard: "/dashboard",
  "registro-usuarios": "/registro-usuarios",
  usuarios: "/usuarios",
  proyectos: "/proyectos",
  bitacora: "/bitacora",
  servicio: "/servicio",
  validacion: "/validacion",
  configuracion: "/configuracion",
  reportes: "/reportes",
  password: "/password",
  perfil: "/perfil",
} as const;

export type ViewKey = keyof typeof RUTAS;

/** Roles que pueden abrir cada ruta. Coincide con la matriz de permisos del backend. */
export const ROLES_POR_RUTA: Record<ViewKey, UserRole[]> = {
  dashboard: ["admin", "coordinador", "tutor", "estudiante"],
  "registro-usuarios": ["admin", "coordinador"],
  usuarios: ["admin", "coordinador"],
  proyectos: ["admin", "coordinador", "tutor"],
  // Bitácora y servicio son de carga y consulta del estudiante: la vista lo
  // bloquea a los demás, así que el menú tampoco debe ofrecérselo.
  bitacora: ["estudiante"],
  servicio: ["estudiante"],
  validacion: ["tutor"],
  configuracion: ["admin", "coordinador"],
  reportes: ["admin", "coordinador", "tutor"],
  password: ["admin", "coordinador", "tutor", "estudiante"],
  perfil: ["admin", "coordinador", "tutor", "estudiante"],
};

export const TITULOS: Record<ViewKey, string> = {
  dashboard: "Dashboard",
  "registro-usuarios": "Registro de Usuarios",
  usuarios: "Gestión de Usuarios",
  proyectos: "Grupos y Proyectos",
  bitacora: "Bitácora Comunitario",
  servicio: "Servicio Social y Ambiental",
  validacion: "Validación",
  configuracion: "Configuraciones y Plantillas",
  reportes: "Reportes y certificados",
  password: "Mi contraseña",
  perfil: "Mi perfil",
};

/** Vista a la que pertenece una ruta, o `null` si no es una ruta del panel. */
export function viewDeRuta(pathname: string): ViewKey | null {
  const limpia = pathname.replace(/\/+$/, "") || "/";
  const encontrada = (Object.keys(RUTAS) as ViewKey[]).find(
    (key) => RUTAS[key] === limpia
  );
  return encontrada ?? null;
}

export function puedeEntrar(view: ViewKey, rol: UserRole): boolean {
  return ROLES_POR_RUTA[view].includes(rol);
}