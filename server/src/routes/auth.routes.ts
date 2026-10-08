import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// POST /api/auth/login  -> login público
router.post('/login', auth.login);

// GET /api/auth/me      -> restaurar sesión (autenticado)
router.get('/me', authenticate, auth.me);

// POST /api/auth/register -> crear usuario.
// El admin crea cualquier rol; el coordinador solo tutores y estudiantes
// (la jerarquia se comprueba en el controlador, porque requireRole no mira
// el cuerpo de la peticion).
router.post(
  '/register',
  authenticate,
  requiereCambioDePassword,
  requireRole('admin', 'coordinador'),
  auth.register
);

// PATCH /api/auth/password -> cambiar la propia contrasena.
// Queda fuera del bloqueo por clave temporal: es justamente lo que hay que
// poder hacer mientras la clave es temporal.
router.patch('/password', authenticate, auth.cambiarPassword);

export { router as authRouter };