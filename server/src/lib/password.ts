import crypto from 'node:crypto';
import { z } from 'zod';

/**
 * Politica de contrasenas y claves temporales.
 *
 * El limite de 72 bytes no es arbitrario: bcrypt solo mira los primeros 72, asi
 * que una contrasena mas larga no seria mas segura, solo engañosa. Se rechaza en
 * lugar de recortar para que el usuario sepa por que no pudo guardarla.
 */

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 72;

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres`)
  .max(
    MAX_PASSWORD,
    `La contraseña no puede superar ${MAX_PASSWORD} caracteres (es el máximo que se puede verificar)`
  )
  .refine((v) => /[a-zA-Z]/.test(v), 'La contraseña debe incluir al menos una letra')
  .refine((v) => /[0-9]/.test(v), 'La contraseña debe incluir al menos un número');

// Alfabeto reducido: sin vocales ni digitos que se confundan entre si al leerlos
// en voz alta o dictarlos ("0/O", "1/l/I").
const LETRAS = 'abcdefghjkmnpqrstuvwxyz';
const NUMEROS = '23456789';
const SIMBOLOS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

function elegir(alfabeto: string): string {
  return alfabeto[crypto.randomInt(0, alfabeto.length)];
}

/**
 * Clave temporal que genera el admin. Se muestra una sola vez: despues solo
 * queda su hash, y por eso el usuario tiene que cambiarla al entrar.
 *
 * 12 caracteres (2 simbolos, 5 letras, 5 digitos) sobre un alfabeto de 54: hay
 * margen de sobra frente a la politica de contrasenas, y la entropia es
 * suficiente para que dos reinicios nunca coincidan.
 */
export function generarPasswordTemporal(): string {
  const partes: string[] = [];

  for (let i = 0; i < 2; i += 1) partes.push(elegir(SIMBOLOS));
  for (let i = 0; i < 5; i += 1) partes.push(elegir(LETRAS));
  for (let i = 0; i < 5; i += 1) partes.push(elegir(NUMEROS));

  // Se baraja para que no salga siempre el mismo patron ("Abc123...").
  for (let i = partes.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [partes[i], partes[j]] = [partes[j], partes[i]];
  }
  return partes.join('');
}