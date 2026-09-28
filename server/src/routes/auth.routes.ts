import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// POST /api/auth/login  -> login público
router.post('/login', auth.login);

// GET /api/auth/me      -> restaurar sesión (autenticado)
router.get('/me', authenticate, auth.me);

// POST /api/auth/register -> crear usuario (solo admin)
router.post('/register', authenticate, requireRole('admin'), auth.register);

export { router as authRouter };