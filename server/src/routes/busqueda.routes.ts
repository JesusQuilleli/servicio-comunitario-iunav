import { Router } from 'express';
import * as busqueda from '../controllers/busqueda.controller.js';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);
router.use(requiereCambioDePassword);

// GET /api/busqueda?q=&limite= -> resultados globales acotados al rol
router.get('/', busqueda.buscarGlobal);

export { router as busquedaRouter };
