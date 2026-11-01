import { env } from '../config/env.js';

/**
 * Cuerpos de los correos que manda el sistema.
 *
 * Son HTML a mano y no una libreria de plantillas: son cuatro, cambian poco y
 * meter un motor de plantillas obligaria a repartir archivos `.hbs` junto al
 * `dist/`, que es justo el tipo de cosa que se rompe al desplegar.
 *
 * Todo el estilo va en linea (`style=`): los clientes de correo descartan las
 * hojas de estilo y la mitad ignora incluso el `<style>` de la cabecera.
 */

const AZUL = '#1b3a5c';

/** Escapa lo que venga de la base de datos: un nombre con `<` romperia el HTML. */
function esc(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function envoltorio(titulo: string, contenido: string): string {
  return `<!doctype html>
<html lang="es">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
    <tr>
      <td style="background:${AZUL};padding:20px 24px;">
        <div style="color:#ffffff;font-size:13px;letter-spacing:1px;">COMUNIDAD IUNAV</div>
        <div style="color:#ffffff;font-size:18px;font-weight:bold;margin-top:4px;">${esc(titulo)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;font-size:14px;line-height:1.6;">
        ${contenido}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background:#f9fafb;font-size:12px;color:#6b7280;">
        Instituto Universitario Adventista de Venezuela &middot; Servicio Comunitario.<br />
        Este mensaje es automático: no hace falta responderlo.
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function boton(texto: string): string {
  return `<p style="margin:24px 0;">
    <a href="${env.frontendUrl}" style="background:${AZUL};color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;display:inline-block;">${esc(texto)}</a>
  </p>
  <p style="font-size:12px;color:#6b7280;">Si el botón no funciona, entra en ${esc(env.frontendUrl)}</p>`;
}

export interface Plantilla {
  asunto: string;
  cuerpo: string;
}

/**
 * Bienvenida con la clave temporal.
 *
 * La clave va en el correo porque es el unico canal que tiene el coordinador
 * para entregarla sin verse con la persona. Vale una sola vez: el sistema
 * obliga a cambiarla en el primer ingreso (`password_temporal`).
 */
export function plantillaBienvenida(datos: {
  nombre: string;
  email: string;
  claveTemporal: string;
}): Plantilla {
  return {
    asunto: 'Tu cuenta del Servicio Comunitario IUNAV',
    cuerpo: envoltorio(
      'Bienvenido al Servicio Comunitario',
      `<p>Hola, <strong>${esc(datos.nombre)}</strong>:</p>
       <p>Ya tienes cuenta en el sistema de gestión del servicio comunitario del IUNAV.
          Desde ahí vas a registrar tus horas, adjuntar las evidencias y seguir tu avance.</p>
       <table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;width:100%;">
         <tr><td style="padding:12px 16px;">
           <div style="font-size:12px;color:#6b7280;">Usuario</div>
           <div style="font-size:15px;"><strong>${esc(datos.email)}</strong></div>
           <div style="font-size:12px;color:#6b7280;margin-top:12px;">Clave temporal</div>
           <div style="font-size:18px;letter-spacing:1px;"><strong>${esc(datos.claveTemporal)}</strong></div>
         </td></tr>
       </table>
       <p><strong>La clave es temporal.</strong> Al entrar por primera vez el sistema te va a
          pedir que la cambies por una tuya antes de dejarte hacer cualquier otra cosa.</p>
       ${boton('Entrar al sistema')}`
    ),
  };
}

/** Un registro de horas pasó por las manos del tutor. */
export function plantillaHorasValidadas(datos: {
  nombre: string;
  estado: 'aprobado' | 'rechazado' | 'corregir';
  horas: number;
  descripcion: string;
  comentario: string | null;
}): Plantilla {
  const titulos: Record<string, string> = {
    aprobado: 'Tus horas fueron aprobadas',
    rechazado: 'Un registro de horas fue rechazado',
    corregir: 'Un registro de horas necesita corrección',
  };
  const frases: Record<string, string> = {
    aprobado: `Tu tutor aprobó <strong>${datos.horas} h</strong>, que ya cuentan para tus metas del programa.`,
    rechazado: `Tu tutor rechazó el registro de <strong>${datos.horas} h</strong>. Esas horas no cuentan para tus metas.`,
    corregir: `Tu tutor te pide corregir el registro de <strong>${datos.horas} h</strong>. Puedes editarlo y volver a enviarlo.`,
  };

  return {
    asunto: titulos[datos.estado],
    cuerpo: envoltorio(
      titulos[datos.estado],
      `<p>Hola, <strong>${esc(datos.nombre)}</strong>:</p>
       <p>${frases[datos.estado]}</p>
       <p style="background:#f9fafb;border-left:3px solid ${AZUL};padding:10px 14px;margin:16px 0;">
         ${esc(datos.descripcion)}
       </p>
       ${
         datos.comentario
           ? `<p><strong>Comentario del tutor:</strong><br />${esc(datos.comentario)}</p>`
           : ''
       }
       ${boton('Ver mis registros')}`
    ),
  };
}

/** Una de las dos metas del programa quedó completa. */
export function plantillaMetaAlcanzada(datos: {
  nombre: string;
  meta: 'directas' | 'impacto';
  horas: number;
}): Plantilla {
  const etiqueta =
    datos.meta === 'directas' ? 'trabajo comunitario directo' : 'impacto social y ambiental';
  return {
    asunto: `Completaste las horas de ${etiqueta}`,
    cuerpo: envoltorio(
      '¡Meta completada!',
      `<p>Hola, <strong>${esc(datos.nombre)}</strong>:</p>
       <p>Ya tienes aprobadas las <strong>${datos.horas} h</strong> de ${esc(etiqueta)} que
          exige el programa. Felicitaciones por el avance.</p>
       <p>Recuerda que el servicio comunitario se acredita al cumplir <strong>las dos</strong>
          metas, así que revisa en el sistema si te queda alguna pendiente.</p>
       ${boton('Ver mi avance')}`
    ),
  };
}

/** El proyecto se dio por finalizado. */
export function plantillaProyectoFinalizado(datos: {
  nombre: string;
  proyecto: string;
}): Plantilla {
  return {
    asunto: `Tu proyecto "${datos.proyecto}" fue finalizado`,
    cuerpo: envoltorio(
      'Proyecto finalizado',
      `<p>Hola, <strong>${esc(datos.nombre)}</strong>:</p>
       <p>La coordinación dio por finalizado el proyecto
          <strong>${esc(datos.proyecto)}</strong>, en el que participaste.</p>
       <p>A partir de ahora no se pueden cargar horas nuevas contra ese proyecto.
          Puedes consultar el detalle de lo que registraste en tu reporte semanal.</p>
       ${boton('Ver mi reporte')}`
    ),
  };
}
