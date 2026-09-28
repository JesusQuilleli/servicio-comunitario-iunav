import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_TOKEN_COOKIE = "iunav_token";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(AUTH_TOKEN_COOKIE)?.value;
  const { pathname } = request.nextUrl;

  const esAreaProtegida = pathname.startsWith("/dashboard");
  const esLogin = pathname.startsWith("/login");

  if (token) {
    if (esLogin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (esAreaProtegida) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/dashboard/:path*"],
};