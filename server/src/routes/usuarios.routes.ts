import { Router } from 'express';
import { listarUsuarios, toggleActivo } from '../controllers/usuarios.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

router.use(authenticate);

// GET /api/usuarios  -> ver listado (admin o coordinador)
router.get('/', requireRole('admin', 'coordinador'), listarUsuarios);

// PATCH /api/usuarios/:id/activo -> activar/desactivar (solo admin)
router.patch('/:id/activo', requireRole('admin'), toggleActivo);

export { router as usuariosRouter };