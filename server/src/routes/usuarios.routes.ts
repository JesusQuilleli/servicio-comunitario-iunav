import { Router } from 'express';
import {
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

// GET /api/usuarios  -> ver listado (admin o coordinador)
router.get('/', requireRole('admin', 'coordinador'), listarUsuarios);

// PATCH /api/usuarios/:id/activo -> activar/desactivar (solo admin)
router.patch('/:id/activo', requireRole('admin'), toggleActivo);

// POST /api/usuarios/:id/password -> restablecer la contrasena (solo admin)
router.post('/:id/password', requireRole('admin'), restablecerPassword);

// POST /api/usuarios/:id/firma -> firma del propio usuario (o el admin por ella)
router.post('/:id/firma', conImagen, subirFirma);

// POST /api/usuarios/:id/sello -> sello institucional (solo admin)
router.post('/:id/sello', requireRole('admin'), conSello, subirSello);

export { router as usuariosRouter };