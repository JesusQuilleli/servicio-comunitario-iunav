import { Router } from 'express';
import * as bitacora from '../controllers/bitacora.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

// GET /api/bitacoras/mias      -> registros del propio estudiante
router.get('/mias', requireRole('estudiante'), bitacora.getMisRegistros);

// GET /api/bitacoras/grupos    -> grupos del estudiante (para el formulario)
router.get('/grupos', requireRole('estudiante'), bitacora.getMisGrupos);

// GET /api/bitacoras/pendientes -> registros por validar del tutor
router.get('/pendientes', requireRole('tutor'), bitacora.getPendientesTutor);

// POST /api/bitacoras          -> estudiante registra horas
router.post('/', requireRole('estudiante'), bitacora.crearRegistro);

// PATCH /api/bitacoras/:id/estado -> tutor aprueba/corrige/rechaza
router.patch('/:id/estado', requireRole('tutor'), bitacora.validarRegistro);

export { router as bitacoraRouter };