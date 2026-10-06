import { Router } from 'express';
import * as reporte from '../controllers/reporte.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

const gestion = requireRole('admin', 'coordinador', 'tutor');

// Reportes de horas: el tutor solo ve sus propios estudiantes (el controlador
// acota la consulta con su id, no con un filtro que el cliente pueda mover).
// GET /api/reportes/consolidado-horas.pdf?periodoId=&grupoId=
router.get('/consolidado-horas.pdf', gestion, reporte.consolidadoPdf);

// GET /api/reportes/consolidado-horas.xlsx?periodoId=&grupoId=
router.get('/consolidado-horas.xlsx', gestion, reporte.consolidadoExcel);

// GET /api/reportes/acta/:idGrupo.pdf
router.get('/acta/:idGrupo.pdf', gestion, reporte.actaPdf);

// GET /api/reportes/certificado/:idUsuario.pdf?periodoId=
// Excluido el estudiante: el certificado lo emite la institucion, no el propio
// estudiante, asi que no le sirve de nada bajarselo. El tutor solo lo pide para
// los estudiantes de sus grupos (lo comprueba el controlador).
router.get('/certificado/:idUsuario.pdf', gestion, reporte.certificadoPdf);

export { router as reporteRouter };