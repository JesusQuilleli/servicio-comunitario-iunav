import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { usuariosRouter } from './usuarios.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { bitacoraRouter } from './bitacora.routes.js';
import { gruposRouter } from './grupos.routes.js';
import { periodosRouter } from './periodos.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/usuarios', usuariosRouter);
router.use('/dashboard', dashboardRouter);
router.use('/bitacoras', bitacoraRouter);
router.use('/grupos', gruposRouter);
router.use('/periodos', periodosRouter);

export { router as apiRouter };
