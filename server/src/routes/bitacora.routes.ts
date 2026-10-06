import { Router } from 'express';
import * as bitacora from '../controllers/bitacora.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { subirArchivo } from '../middleware/subida.js';

const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

/**
 * `subirArchivo` va antes del controlador. Acepta un solo archivo en el campo
 * `evidencia` (10 MB, imagen o PDF) y deja el resto de campos en `req.body`.
 * Si la peticion no es `multipart`, `multer` la deja pasar intacta, asi que esta
 * misma ruta sigue aceptando JSON sin evidencia.
 */
const conEvidencia = subirArchivo('evidencias', 'evidencia');

// GET /api/bitacoras/mias      -> registros del propio estudiante
router.get('/mias', requireRole('estudiante'), bitacora.getMisRegistros);

// GET /api/bitacoras/grupos    -> grupos del estudiante (para el formulario)
router.get('/grupos', requireRole('estudiante'), bitacora.getMisGrupos);

// GET /api/bitacoras/metas     -> metas 90/30 y limite diario vigentes
router.get('/metas', requireRole('estudiante'), bitacora.getMetas);

// GET /api/bitacoras/pendientes -> registros por validar del tutor
router.get('/pendientes', requireRole('tutor'), bitacora.getPendientesTutor);

// POST /api/bitacoras          -> estudiante registra horas (con evidencia opcional)
router.post('/', requireRole('estudiante'), conEvidencia, bitacora.crearRegistro);

// PATCH /api/bitacoras/:id     -> el estudiante corrige su registro editable
router.patch('/:id', requireRole('estudiante'), conEvidencia, bitacora.editarRegistro);

// DELETE /api/bitacoras/:id    -> el estudiante retira su registro editable
router.delete('/:id', requireRole('estudiante'), bitacora.eliminarRegistro);

// PATCH /api/bitacoras/:id/estado -> tutor aprueba/corrige/rechaza
router.patch('/:id/estado', requireRole('tutor'), bitacora.validarRegistro);

export { router as bitacoraRouter };