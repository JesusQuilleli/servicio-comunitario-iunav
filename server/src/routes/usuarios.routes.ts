import { Router } from 'express';
import {
  descargarPlantilla,
  importarEstudiantes,
  listarUsuarios,
  restablecerPassword,
  subirFirma,
  subirSello,
  toggleActivo,
} from '../controllers/usuarios.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { subirArchivo } from '../middleware/subida.js';

const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

// Un solo archivo en el campo `archivo`. El limite de tamano sale de la
// categoria, y en `firmas`/`sellos` solo se admiten imagenes (ver
// `config/almacenamiento.ts`).
const conImagen = subirArchivo('firmas', 'archivo');
const conSello = subirArchivo('sellos', 'archivo');
const conPlantilla = subirArchivo('plantillas', 'archivo');

// GET /api/usuarios  -> ver listado (admin o coordinador)
router.get('/', requireRole('admin', 'coordinador'), listarUsuarios);

// GET /api/usuarios/plantilla.xlsx -> plantilla de carga masiva (admin o coordinador)
router.get('/plantilla.xlsx', requireRole('admin', 'coordinador'), descargarPlantilla);

// POST /api/usuarios/importar -> alta de estudiantes desde un .xlsx.
// Solo estudiantes: los tutores y coordinadores se crean de a uno (ver la
// jerarquia de `POST /api/auth/register`).
router.post(
  '/importar',
  requireRole('admin', 'coordinador'),
  conPlantilla,
  importarEstudiantes
);

// PATCH /api/usuarios/:id/activo -> activar/desactivar (solo admin)
router.patch('/:id/activo', requireRole('admin'), toggleActivo);

// POST /api/usuarios/:id/password -> restablecer la contrasena (solo admin)
router.post('/:id/password', requireRole('admin'), restablecerPassword);

// POST /api/usuarios/:id/firma -> firma del propio usuario (o el admin por ella)
router.post('/:id/firma', conImagen, subirFirma);

// POST /api/usuarios/:id/sello -> sello institucional (solo admin)
router.post('/:id/sello', requireRole('admin'), conSello, subirSello);

export { router as usuariosRouter };