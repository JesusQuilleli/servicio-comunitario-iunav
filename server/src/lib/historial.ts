import { pool } from '../db/pool.js';
import { registrar, type EntidadHistorial } from '../models/historial.model.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * Punto de entrada unico para auditar una accion.
 *
 * Se llama a mano desde los controladores y no como middleware a proposito: un
 * middleware solo ve el metodo y la URL, mientras que la frase util ("cambio la
 * meta de horas directas de 90 a 120") necesita los valores de antes y despues,
 * que solo conoce quien hace el cambio.
 *
 * **Nunca lanza.** Una auditoria que falla no puede tumbar la operacion que el
 * usuario pidio: se deja constancia en el log del servidor y se sigue.
 */

export interface AccionAuditada {
  /** `<entidad>.<verbo>`, p. ej. 'configuracion.actualizar'. */
  accion: string;
  entidad: EntidadHistorial;
  idEntidad?: string | number | null;
  descripcion: string;
  datos?: Record<string, unknown> | null;
}

export async function registrarAccion(req: AuthRequest, evento: AccionAuditada): Promise<void> {
  try {
    const actor = req.usuario;
    if (!actor) return;

    // El nombre se congela en la fila: el historial debe seguir siendo legible
    // aunque la cuenta se renombre o se desactive.
    const { rows } = await pool.query<{ nombre_completo: string }>(
      'select nombre_completo from usuarios where id_usuario = $1',
      [actor.idUsuario]
    );

    await registrar({
      idActor: actor.idUsuario,
      actorNombre: rows[0]?.nombre_completo ?? 'Cuenta eliminada',
      actorRol: actor.rol,
      accion: evento.accion,
      entidad: evento.entidad,
      idEntidad: evento.idEntidad === null || evento.idEntidad === undefined
        ? null
        : String(evento.idEntidad),
      descripcion: evento.descripcion,
      datos: evento.datos ?? null,
    });
  } catch (err) {
    console.error('No se pudo registrar la accion en el historial:', err);
  }
}

/**
 * Compara dos objetos y devuelve solo lo que cambio, en la forma
 * `{ campo: { antes, despues } }`. Guardar el objeto entero haria el historial
 * ilegible; guardar solo el nuevo valor no permitiria reconstruir nada.
 */
export function diferencias<T extends Record<string, unknown>>(
  antes: T,
  despues: T
): Record<string, { antes: unknown; despues: unknown }> {
  const cambios: Record<string, { antes: unknown; despues: unknown }> = {};
  for (const campo of Object.keys(despues)) {
    if (antes[campo] !== despues[campo]) {
      cambios[campo] = { antes: antes[campo], despues: despues[campo] };
    }
  }
  return cambios;
}
