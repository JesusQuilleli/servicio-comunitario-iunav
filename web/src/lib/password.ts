/**
 * Espejo de `server/src/lib/password.ts`.
 *
 * El servidor vuelve a comprobarlo todo; esto solo evita mandar una clave que
 * va a ser rechazada. Si las reglas cambian alli, hay que cambiarlas aqui.
 */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

/** Motivo por el que no se admite la contraseña, o `null` si vale. */
export function newPasswordError(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`;
  }
  if (password.length > MAX_PASSWORD) {
    return `La contraseña no puede superar ${MAX_PASSWORD} caracteres.`;
  }
  if (!/[a-zA-Z]/.test(password)) {
    return "La contraseña debe incluir al menos una letra.";
  }
  if (!/[0-9]/.test(password)) {
    return "La contraseña debe incluir al menos un número.";
  }
  return null;
}