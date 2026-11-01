import nodemailer, { type Transporter } from 'nodemailer';
import { correoConfigurado, env } from '../config/env.js';
import * as modelo from '../models/notificacion.model.js';
import type { Notificacion } from '../models/notificacion.model.js';

/**
 * Envio de correo.
 *
 * Tres decisiones que conviene no reabrir:
 *
 * 1. **El transporte se construye en el primer envio, no al importar.** Si se
 *    creara al cargar el modulo, arrancar el servidor sin SMTP configurado
 *    fallaria, y la instalacion local esta pensada para funcionar sin internet.
 *
 * 2. **Un fallo de correo nunca tumba la operacion que lo provoco.** Dar de
 *    alta a un estudiante no puede deshacerse porque el servidor de correo este
 *    caido: el aviso queda en la cola con su error y se reintenta.
 *
 * 3. **El envio ocurre DESPUES del commit.** Encolar va dentro de la
 *    transaccion; mandar, fuera. Asi no se manda un correo sobre algo que al
 *    final no se guardo.
 */

let transporte: Transporter | null = null;

/** Para las pruebas: reemplaza el transporte real por uno falso. */
export function usarTransporte(falso: Transporter | null): void {
  transporte = falso;
}

function obtenerTransporte(): Transporter {
  if (transporte) return transporte;

  transporte = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    // Sin usuario se asume un relay interno sin autenticacion, que es lo normal
    // en el servidor de correo de una institucion.
    auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
  });
  return transporte;
}

/**
 * Manda un aviso ya encolado y actualiza su estado.
 *
 * Devuelve `true` si salio. **No lanza**: quien llama esta normalmente en medio
 * de otra cosa (un alta, una validacion) y no debe enterarse de que el correo
 * fallo mas alla del valor de retorno.
 */
export async function enviarNotificacion(notificacion: Notificacion): Promise<boolean> {
  if (!correoConfigurado()) {
    await modelo.marcarFallida(
      notificacion.idNotificacion,
      'No hay servidor de correo configurado (SMTP_HOST vacío). El aviso queda en cola.'
    );
    return false;
  }

  try {
    await obtenerTransporte().sendMail({
      from: env.smtpDesde || env.smtpUser,
      to: notificacion.destinatarioEmail,
      subject: notificacion.asunto,
      html: notificacion.cuerpo,
    });
    await modelo.marcarEnviada(notificacion.idNotificacion);
    return true;
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : String(err);
    console.error(`No se pudo enviar la notificación ${notificacion.idNotificacion}:`, mensaje);
    await modelo.marcarFallida(notificacion.idNotificacion, mensaje);
    return false;
  }
}

/**
 * Encola y envia en un solo paso, para los avisos que no nacen dentro de una
 * transaccion. El envio se lanza sin esperarlo: quien llama no debe quedarse
 * bloqueado en un SMTP lento.
 */
export async function encolarYEnviar(
  notificacion: modelo.NotificacionNueva
): Promise<Notificacion> {
  const encolada = await modelo.encolar(notificacion);
  // `void` deliberado: el resultado del envio ya queda en la fila.
  void enviarNotificacion(encolada).catch((err) => {
    console.error('Fallo no controlado al enviar una notificación:', err);
  });
  return encolada;
}

/** Reintenta los avisos que siguen sin salir. Devuelve cuantos salieron. */
export async function reintentarPendientes(limite = 50): Promise<number> {
  const pendientes = await modelo.pendientesDeEnvio(limite);
  let enviadas = 0;
  for (const n of pendientes) {
    if (await enviarNotificacion(n)) enviadas += 1;
  }
  return enviadas;
}
