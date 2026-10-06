import { Router } from 'express';
import * as config from '../controllers/configuracion.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { subirArchivo } from '../middleware/subida.js';

const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

const lectura = requireRole('admin', 'coordinador');
const soloAdmin = requireRole('admin');

const conDocumento = subirArchivo('plantillas', 'documento');

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

// POST /api/configuracion/plantillas/:id/documento -> archivo de la plantilla
router.post('/plantillas/:id/documento', lectura, conDocumento, config.subirDocumentoPlantilla);

export { router as configuracionRouter };
