import { Router } from 'express';
import * as dashboard from '../controllers/dashboard.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// GET /api/dashboard -> panel según el rol del usuario autenticado
router.get('/', authenticate, dashboard.getDashboard);

export { router as dashboardRouter };