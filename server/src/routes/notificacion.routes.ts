import { Router } from 'express';
import * as notificacion from '../controllers/notificacion.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

/**
 * Bandeja de salida del correo. Solo el administrador: contiene los cuerpos de
 * los mensajes ya enviados, y el de bienvenida lleva la clave temporal del
 * destinatario.
 */
const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

const soloAdmin = requireRole('admin');

// POST /api/notificaciones/reintentar-todas (antes que /:id, que lo capturaria)
router.post('/reintentar-todas', soloAdmin, notificacion.reintentarTodas);

// GET /api/notificaciones?estado=&tipo=&pagina=&porPagina=
router.get('/', soloAdmin, notificacion.listar);

// POST /api/notificaciones/:id/reintentar
router.post('/:id/reintentar', soloAdmin, notificacion.reintentar);

export { router as notificacionesRouter };
