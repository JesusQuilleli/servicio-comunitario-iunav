import { Router } from 'express';
import * as config from '../controllers/configuracion.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

const lectura = requireRole('admin', 'coordinador');
const soloAdmin = requireRole('admin');

// GET /api/configuracion -> reglas del programa
router.get('/', lectura, config.obtenerConfiguracion);

// PATCH /api/configuracion -> actualizar reglas del programa
router.patch('/', soloAdmin, config.actualizarConfiguracion);

// GET /api/configuracion/plantillas?todas=true -> listado
router.get('/plantillas', lectura, config.listarPlantillas);

// POST /api/configuracion/plantillas -> crear plantilla
router.post('/plantillas', lectura, config.crearPlantilla);

// PATCH /api/configuracion/plantillas/:id -> editar plantilla
router.patch('/plantillas/:id', lectura, config.actualizarPlantilla);

// PATCH /api/configuracion/plantillas/:id/activo -> activar o desactivar
router.patch('/plantillas/:id/activo', lectura, config.cambiarActivoPlantilla);

export { router as configuracionRouter };
