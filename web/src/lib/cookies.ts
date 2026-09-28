export const AUTH_TOKEN_COOKIE = "iunav_token";
export const AUTH_ROLE_COOKIE = "iunav_role";

const MAX_AGE = 60 * 60 * 8; // 8 horas, acorde a JWT_EXPIRES_IN del backend

export function setSessionCookies(token: string, role: string): void {
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encodeURIComponent(token)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
  document.cookie = `${AUTH_ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`;
}

export function clearSessionCookies(): void {
  document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0`;
  document.cookie = `${AUTH_ROLE_COOKIE}=; path=/; max-age=0`;
}