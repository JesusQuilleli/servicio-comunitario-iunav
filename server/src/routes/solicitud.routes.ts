import { Router } from 'express';
import * as solicitud from '../controllers/solicitud.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

const gestion = requireRole('admin', 'coordinador');

// GET /api/solicitudes?estado= -> bandeja de aprobacion (coordinacion)
router.get('/', gestion, solicitud.listar);

// GET /api/solicitudes/mias -> solicitudes propias (cualquier rol)
router.get('/mias', solicitud.mias);

// PATCH /api/solicitudes/:id -> aprobar o rechazar (coordinacion)
router.patch('/:id', gestion, solicitud.resolver);

export { router as solicitudesRouter };
