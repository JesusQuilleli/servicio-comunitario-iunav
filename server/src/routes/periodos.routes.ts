import { Router } from 'express';
import { listarPeriodos } from '../controllers/periodo.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// GET /api/periodos?todos=true -> lista períodos (activos por defecto)
router.get('/', listarPeriodos);

export { router as periodosRouter };
