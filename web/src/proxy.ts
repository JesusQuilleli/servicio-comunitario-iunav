import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_ROLE_COOKIE, AUTH_TOKEN_COOKIE } from "@/lib/cookies";
import { ROLES_POR_RUTA, RUTAS, type ViewKey, viewDeRuta } from "@/lib/rutas";
import type { UserRole } from "@/lib/types";

/**
 * Filtro de rutas del panel.
 *
 * El backend sigue siendo quien valida el token y el rol de cada endpoint; esto
 * solo evita mandar a renderizar la pantalla de un modulo que no le toca al
 * usuario, y manda al login a quien llega sin sesion.
 *
 * El chequeo de rol va aqui y no en la pagina a proposito: `redirect()` dentro de
 * un componente de servidor se resuelve cuando el shell del layout ya se
 * envio, asi que el navegador recibia un 200 y un salto del lado del cliente en
 * vez de un 307. En el proxy el corte ocurre antes de renderizar nada.
 */

const rutasPanel = Object.values(RUTAS);

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const rol = request.cookies.get(AUTH_ROLE_COOKIE)?.value as UserRole | undefined;

  if (!token || !rol) {
    const esPanel = rutasPanel.some(
      (ruta) => pathname === ruta || pathname.startsWith(`${ruta}/`)
    );
    if (esPanel || pathname === "/login") {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  // Con sesion abierta el login no hace falta.
  if (pathname === "/login") {
    return NextResponse.redirect(new URL(RUTAS.dashboard, request.url));
  }

  const vista = viewDeRuta(pathname);
  if (vista && !ROLES_POR_RUTA[vista].includes(rol)) {
    return NextResponse.redirect(new URL(RUTAS.dashboard, request.url));
  }

  return NextResponse.next();
}

/**
 * El `matcher` de abajo tiene que escribirse de forma literal porque Next lo
 * analiza al compilar, asi que la lista de rutas queda repetida. Este registro es
 * la red de seguridad: al agregarle un modulo a `RUTAS` sin acordarse del
 * matcher, el typecheck falla aqui.
 */
export const RUTAS_CUBIERTAS: Record<ViewKey, true> = {
  dashboard: true,
  "registro-usuarios": true,
  usuarios: true,
  proyectos: true,
  bitacora: true,
  servicio: true,
  validacion: true,
  configuracion: true,
  reportes: true,
  password: true,
};

export const config = {
  matcher: [
    "/login",
    "/dashboard",
    "/dashboard/:path*",
    "/registro-usuarios",
    "/registro-usuarios/:path*",
    "/usuarios",
    "/usuarios/:path*",
    "/proyectos",
    "/proyectos/:path*",
    "/bitacora",
    "/bitacora/:path*",
    "/servicio",
    "/servicio/:path*",
    "/validacion",
    "/validacion/:path*",
    "/configuracion",
    "/configuracion/:path*",
    "/reportes",
    "/reportes/:path*",
    "/password",
    "/password/:path*",
  ],
};