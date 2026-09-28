import { Router } from 'express';
import * as grupo from '../controllers/grupo.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

const gestion = requireRole('admin', 'coordinador');

// GET /api/grupos?periodo=&estado=&tutor=&q= -> listado filtrado
router.get('/', requireRole('admin', 'coordinador', 'tutor'), grupo.listarGrupos);

// GET /api/grupos/:id -> detalle con integrantes
router.get('/:id', requireRole('admin', 'coordinador', 'tutor', 'estudiante'), grupo.obtenerGrupo);

// POST /api/grupos -> crear grupo/proyecto
router.post('/', gestion, grupo.crearGrupo);

// PATCH /api/grupos/:id -> actualizar datos del grupo
router.patch('/:id', gestion, grupo.actualizarGrupo);

// PATCH /api/grupos/:id/estado -> cambiar estado del proyecto
router.patch('/:id/estado', gestion, grupo.cambiarEstado);

// POST /api/grupos/:id/integrantes -> agregar estudiantes
router.post('/:id/integrantes', gestion, grupo.agregarIntegrantes);

// PATCH /api/grupos/:id/integrantes/:idEstudiante -> estado final del integrante
router.patch(
  '/:id/integrantes/:idEstudiante',
  gestion,
  grupo.cambiarEstadoFinalIntegrante
);

// DELETE /api/grupos/:id/integrantes/:idEstudiante -> quitar del grupo
router.delete('/:id/integrantes/:idEstudiante', gestion, grupo.quitarIntegrante);

export { router as gruposRouter };
