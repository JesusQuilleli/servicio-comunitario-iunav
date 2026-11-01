import { Router } from 'express';
import * as historial from '../controllers/historial.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

/**
 * Historial de acciones administrativas. Lo ven administracion y coordinacion:
 * el documento de correcciones lo pide explicitamente para esos dos perfiles.
 */
const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

const gestion = requireRole('admin', 'coordinador');

// GET /api/historial/acciones -> valores para los filtros (antes que /:nada)
router.get('/acciones', gestion, historial.acciones);

// GET /api/historial?entidad=&accion=&actorId=&desde=&hasta=&q=&pagina=&porPagina=
router.get('/', gestion, historial.listar);

export { router as historialRouter };
