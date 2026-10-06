import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_ROLE_COOKIE, AUTH_TOKEN_COOKIE } from "@/lib/cookies";

/**
 * Sesion segun el servidor.
 *
 * El rol de cada ruta se resuelve en `src/proxy.ts`, antes de renderizar: alli
 * un rechazo es un 307 de verdad, mientras que un `redirect()` desde una pagina
 * llega cuando el shell ya se envio y el navegador termina haciendo el salto por
 * su cuenta. Aqui solo queda la garantia de que el panel exige sesion.
 *
 * Se lee la cookie y no el store de zustand porque el store vive en
 * localStorage, que el servidor no ve. La cookie no es sensible: el backend
 * ignora las cookies y exige el token en la cabecera `Authorization`.
 */

export async function exigeSesion(): Promise<void> {
  const almacen = await cookies();
  if (!almacen.get(AUTH_TOKEN_COOKIE)?.value || !almacen.get(AUTH_ROLE_COOKIE)?.value) {
    redirect("/login");
  }
}