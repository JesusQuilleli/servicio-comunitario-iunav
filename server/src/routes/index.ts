import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { usuariosRouter } from './usuarios.routes.js';
import { dashboardRouter } from './dashboard.routes.js';
import { bitacoraRouter } from './bitacora.routes.js';
import { gruposRouter } from './grupos.routes.js';
import { periodosRouter } from './periodos.routes.js';
import { configuracionRouter } from './configuracion.routes.js';
import { archivoRouter } from './archivo.routes.js';
import { reporteRouter } from './reporte.routes.js';
import { busquedaRouter } from './busqueda.routes.js';
import { solicitudesRouter } from './solicitud.routes.js';

const router = Router();

router.use('/auth', authRouter);
router.use('/usuarios', usuariosRouter);
router.use('/dashboard', dashboardRouter);
router.use('/bitacoras', bitacoraRouter);
router.use('/grupos', gruposRouter);
router.use('/periodos', periodosRouter);
router.use('/configuracion', configuracionRouter);
router.use('/archivos', archivoRouter);
router.use('/reportes', reporteRouter);
router.use('/busqueda', busquedaRouter);
router.use('/solicitudes', solicitudesRouter);

export { router as apiRouter };