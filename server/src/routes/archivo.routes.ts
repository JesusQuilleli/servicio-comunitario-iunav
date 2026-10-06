import { Router } from 'express';
import { authenticate, requiereCambioDePassword } from '../middleware/auth.js';
import { descargarArchivo } from '../controllers/archivo.controller.js';

/**
 * Descarga de archivos. Todo pasa por `authenticate`: la carpeta de subidas
 * nunca se expone como directorio estatico, porque las evidencias son datos
 * personales de los estudiantes.
 */
export const archivoRouter = Router();

archivoRouter.get('/:carpeta/:nombre', authenticate, requiereCambioDePassword, descargarArchivo);