import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { correoConfigurado } from '../config/env.js';
import { enviarNotificacion, reintentarPendientes } from '../lib/correo.js';
import { leerPaginacion, respuestaPaginada } from '../lib/paginacion.js';
import * as model from '../models/notificacion.model.js';
import { registrarAccion } from '../lib/historial.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * Bandeja de salida del correo.
 *
 * Existe porque el envio puede fallar y hay que poder verlo: sin esta pantalla,
 * un SMTP mal configurado se traduciria en estudiantes que nunca reciben su
 * clave temporal y en nadie enterandose.
 */

const vacioEsAusente = (v: unknown) => (v === '' || v === null ? undefined : v);

const filtrosSchema = z.object({
  estado: z.preprocess(vacioEsAusente, z.enum(model.ESTADOS_NOTIFICACION).optional()),
  tipo: z.preprocess(vacioEsAusente, z.enum(model.TIPOS_NOTIFICACION).optional()),
});

/** `GET /api/notificaciones?estado=&tipo=&pagina=&porPagina=` */
export async function listar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const filtros = filtrosSchema.parse(req.query);
    const paginacion = leerPaginacion(req.query);

    const { items, total } = await model.listarNotificaciones(
      { estado: filtros.estado ?? null, tipo: filtros.tipo ?? null },
      paginacion
    );

    res.json({
      notificaciones: items,
      resumen: await model.resumenNotificaciones(),
      // La pantalla necesita saberlo para explicar por que no sale nada en vez
      // de mostrar una lista de fallos sin contexto.
      correoConfigurado: correoConfigurado(),
      ...respuestaPaginada(items, total, paginacion),
    });
  } catch (err) {
    next(err);
  }
}

/** `POST /api/notificaciones/:id/reintentar` */
export async function reintentar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const notificacion = await model.obtenerNotificacion(id);
    const enviada = await enviarNotificacion(notificacion);

    await registrarAccion(req, {
      accion: 'notificacion.reintentar',
      entidad: 'usuario',
      idEntidad: notificacion.idDestinatario,
      descripcion:
        `Reintentó el envío de "${notificacion.asunto}" a ${notificacion.destinatarioEmail}: ` +
        (enviada ? 'enviado' : 'falló de nuevo'),
    });

    res.json({ enviada, notificacion: await model.obtenerNotificacion(id) });
  } catch (err) {
    next(err);
  }
}

/** `POST /api/notificaciones/reintentar-todas` */
export async function reintentarTodas(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const enviadas = await reintentarPendientes();
    await registrarAccion(req, {
      accion: 'notificacion.reintentar-todas',
      entidad: 'configuracion',
      descripcion: `Reintentó los envíos pendientes: ${enviadas} salieron`,
    });
    res.json({ enviadas, resumen: await model.resumenNotificaciones() });
  } catch (err) {
    next(err);
  }
}
