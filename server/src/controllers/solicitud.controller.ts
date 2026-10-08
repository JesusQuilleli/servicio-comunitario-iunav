import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../lib/errors.js';
import { findUsuarioPorEmail } from '../models/usuario.model.js';
import { actualizarPerfil } from '../models/usuario.model.js';
import {
  findSolicitudPorId,
  listarMias,
  listarSolicitudes,
  mapSolicitudPublica,
  resolverSolicitud,
  type EstadoSolicitud,
} from '../models/solicitud.model.js';
import type { AuthRequest } from '../middleware/auth.js';

const listarSchema = z.object({
  estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'todas']).default('pendiente'),
});

const resolverSchema = z.object({
  accion: z.enum(['aprobar', 'rechazar']),
  comentario: z.string().trim().max(500).optional(),
});

const CAMPO_EN_ESPANOL: Record<string, string> = {
  nombre_completo: 'nombre completo',
  email: 'correo electrónico',
};

/** GET /api/solicitudes?estado= -> bandeja del coordinador. */
export async function listar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { estado } = listarSchema.parse(req.query);
    const solicitudes = await listarSolicitudes(estado as EstadoSolicitud | 'todas');
    res.json({ solicitudes: solicitudes.map(mapSolicitudPublica) });
  } catch (err) {
    next(err);
  }
}

/** GET /api/solicitudes/mias -> las del usuario autenticado. */
export async function mias(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.usuario) {
      throw new ApiError(401, 'No autenticado');
    }
    const solicitudes = await listarMias(req.usuario.idUsuario);
    res.json({ solicitudes: solicitudes.map(mapSolicitudPublica) });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/solicitudes/:id -> aprobar o rechazar.
 *
 * Al aprobar el cambio se aplica a la cuenta del estudiante. Si el correo ya
 * pertenece a otra cuenta se responde 409 y la solicitud sigue pendiente, para
 * que el coordinador pueda rechazarla con un comentario.
 */
export async function resolver(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.usuario) {
      throw new ApiError(401, 'No autenticado');
    }
    const { id } = req.params;
    const body = resolverSchema.parse(req.body);

    const solicitud = await findSolicitudPorId(id ?? '');
    if (!solicitud) {
      throw new ApiError(404, 'Solicitud no encontrada');
    }
    if (solicitud.estado !== 'pendiente') {
      throw new ApiError(409, 'La solicitud ya fue resuelta');
    }

    if (body.accion === 'aprobar') {
      if (solicitud.campo === 'email') {
        const dueno = await findUsuarioPorEmail(solicitud.valor_nuevo.toLowerCase());
        if (dueno && dueno.id_usuario !== solicitud.id_usuario) {
          throw new ApiError(409, 'Ya existe otro usuario con ese correo electrónico');
        }
      }
      await actualizarPerfil(solicitud.id_usuario, {
        [solicitud.campo]: solicitud.campo === 'email'
          ? solicitud.valor_nuevo.toLowerCase()
          : solicitud.valor_nuevo,
      });
    }

    const resuelta = await resolverSolicitud({
      idSolicitud: solicitud.id_solicitud,
      estado: body.accion === 'aprobar' ? 'aprobada' : 'rechazada',
      idResolvio: req.usuario.idUsuario,
      comentario: body.comentario ?? null,
    });
    if (!resuelta) {
      throw new ApiError(409, 'La solicitud ya fue resuelta');
    }

    res.json({
      solicitud: mapSolicitudPublica(resuelta),
      mensaje:
        body.accion === 'aprobar'
          ? `Cambio de ${CAMPO_EN_ESPANOL[solicitud.campo]} aplicado`
          : 'Solicitud rechazada',
    });
  } catch (err) {
    next(err);
  }
}
