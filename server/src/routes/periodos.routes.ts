import { Router } from 'express';
import * as periodo from '../controllers/periodo.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

const gestion = requireRole('admin', 'coordinador');

// GET /api/periodos?todos=true -> lista períodos (activos por defecto)
router.get('/', periodo.listarPeriodos);

// POST /api/periodos -> crear período académico
router.post('/', gestion, periodo.crearPeriodo);

// PATCH /api/periodos/:id -> actualizar período académico
router.patch('/:id', gestion, periodo.actualizarPeriodo);

// PATCH /api/periodos/:id/activo -> activar o desactivar
router.patch('/:id/activo', gestion, periodo.cambiarActivoPeriodo);

export { router as periodosRouter };
