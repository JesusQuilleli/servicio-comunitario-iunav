import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import { guardarArchivo, borrarArchivo } from '../lib/archivos.js';
import { leerPaginacion, respuestaPaginada } from '../lib/paginacion.js';
import { archivoDe } from '../middleware/subida.js';
import * as model from '../models/bitacora.model.js';
import type { ResultadoValidacion } from '../models/bitacora.model.js';
import { findUsuarioPorId } from '../models/usuario.model.js';
import { encolarYEnviar } from '../lib/correo.js';
import { plantillaHorasValidadas, plantillaMetaAlcanzada } from '../lib/plantillas-correo.js';

/**
 * Acepta JSON y `multipart/form-data` en la misma ruta. Cuando llega un archivo,
 * `multer` deja el resto de campos en `req.body` como texto, asi que los
 * numeros se normalizan con `z.coerce`. `multer` ignora las peticiones que no son
 * `multipart`, de modo que el cliente antiguo puede seguir mandando JSON.
 */

const campoTexto = (max: number) => z.string().trim().min(1).max(max);

/** Numero opcional que tolera el texto que llega de un formulario. */
const numeroOpcional = <T extends z.ZodTypeAny>(esquema: T) =>
  z.preprocess((v) => (v === undefined || v === '' || v === null ? undefined : v), esquema.optional());

const fechaSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (AAAA-MM-DD)');

const crearSchema = z
  .object({
    tipo: z.enum(['comunitario', 'social', 'ambiental']),
    fecha: fechaSchema,
    descripcion: campoTexto(2000),
    horas: z.coerce.number().positive('Las horas deben ser mayores a 0').max(24, 'Máximo 24 horas por registro'),
    semana: numeroOpcional(z.coerce.number().int().min(1).max(52)),
    idGrupo: numeroOpcional(z.string().uuid('Grupo inválido')),
  })
  .superRefine((val, ctx) => {
    if (val.tipo === 'comunitario') {
      if (!val.semana) {
        ctx.addIssue({
          code: 'custom',
          path: ['semana'],
          message: 'La bitácora comunitaria requiere la semana',
        });
      }
      if (!val.idGrupo) {
        ctx.addIssue({
          code: 'custom',
          path: ['idGrupo'],
          message: 'La bitácora comunitaria requiere el grupo/proyecto',
        });
      }
    } else if (val.semana || val.idGrupo) {
      ctx.addIssue({
        code: 'custom',
        path: ['semana'],
        message: 'Los servicios sociales/ambientales no usan semana ni grupo',
      });
    }
  });

/**
 * El tipo NO se edita: el registro se queda en la tabla donde nacio. Editar el
 * tipo implicaria mover la fila entre `bitacoras_comunitario` y
 * `control_servicios_institucionales` y revalidar la meta correspondiente, lo
 * que el estudiante no necesita y solo abriria la puerta a errores.
 */
const editarSchema = z.object({
  fecha: fechaSchema,
  descripcion: campoTexto(2000),
  horas: z.coerce.number().positive('Las horas deben ser mayores a 0').max(24, 'Máximo 24 horas por registro'),
  semana: numeroOpcional(z.coerce.number().int().min(1).max(52)),
  idGrupo: numeroOpcional(z.string().uuid('Grupo inválido')),
  quitarEvidencia: numeroOpcional(z.enum(['true', 'false'])),
});

const veredictoSchema = z.object({
  tipo: z.enum(['comunitario', 'social', 'ambiental']),
  estado: z.enum(['aprobado', 'rechazado', 'corregir']),
  comentario: z.string().trim().max(500).optional(),
});

function requiereUsuario(req: AuthRequest): { idUsuario: string } {
  if (!req.usuario?.idUsuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return { idUsuario: req.usuario.idUsuario };
}

function exigirFechaNoFutura(fecha: string): void {
  const hoy = new Date().toISOString().slice(0, 10);
  if (fecha > hoy) {
    throw new ApiError(400, 'La fecha de la actividad no puede ser futura');
  }
}

export async function getMisRegistros(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const paginacion = leerPaginacion(req.query);
    const { items, total } = await model.listarMisRegistros(idUsuario, paginacion);
    // `registros` se conserva para los consumidores actuales; `items` es la pagina.
    res.json({ registros: items, ...respuestaPaginada(items, total, paginacion) });
  } catch (err) {
    next(err);
  }
}

export async function getMisGrupos(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const grupos = await model.obtenerGruposEstudiante(idUsuario);
    res.json({ grupos });
  } catch (err) {
    next(err);
  }
}

/** Metas vigentes, para que la UI muestre cuanto le falta al estudiante. */
export async function getMetas(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const metas = await model.obtenerMetas();
    res.json({ metas });
  } catch (err) {
    next(err);
  }
}

export async function crearRegistro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // El archivo ya esta en memoria y validado por multer, pero todavia no en
  // disco: se escribe primero y se borra si la base de datos rechaza el registro.
  let rutaEvidencia: string | null = null;
  try {
    const { idUsuario } = requiereUsuario(req);
    const body = crearSchema.parse(req.body);
    exigirFechaNoFutura(body.fecha);

    const evidencia = archivoDe(req, 'evidencia');
    if (evidencia) {
      rutaEvidencia = (await guardarArchivo('evidencias', evidencia)).ruta;
    }

    const metas = await model.obtenerMetas();
    const { id } = await model.crearRegistroEstudiante(
      { ...body, idEstudiante: idUsuario, evidenciaUrl: rutaEvidencia },
      metas
    );

    res.status(201).json({
      registro: {
        id,
        tipo: body.tipo,
        fecha: body.fecha,
        descripcion: body.descripcion,
        horas: body.horas,
        estado: 'pendiente',
        evidenciaUrl: rutaEvidencia,
      },
    });
  } catch (err) {
    if (rutaEvidencia) {
      await borrarArchivo(rutaEvidencia);
    }
    next(err);
  }
}

export async function editarRegistro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  let rutaNueva: string | null = null;
  try {
    const { idUsuario } = requiereUsuario(req);
    const { id } = req.params;
    const body = editarSchema.parse(req.body);
    exigirFechaNoFutura(body.fecha);

    const evidencia = archivoDe(req, 'evidencia');
    if (evidencia) {
      rutaNueva = (await guardarArchivo('evidencias', evidencia)).ruta;
    }

    const quitar = body.quitarEvidencia === 'true';
    const metas = await model.obtenerMetas();
    const resultado = await model.actualizarRegistroEstudiante(
      {
        idRegistro: id,
        idEstudiante: idUsuario,
        fecha: body.fecha,
        descripcion: body.descripcion,
        horas: body.horas,
        semana: body.semana,
        idGrupo: body.idGrupo,
        // `undefined` conserva, `null` quita, string reemplaza.
        evidenciaUrl: rutaNueva ?? (quitar ? null : undefined),
      },
      metas
    );

    // La fila ya esta actualizada: la evidencia previa que quedo suelta se borra.
    if (resultado.evidenciaAnterior && resultado.evidenciaAnterior !== resultado.evidenciaUrl) {
      await borrarArchivo(resultado.evidenciaAnterior);
    }

    res.json({ registro: resultado });
  } catch (err) {
    if (rutaNueva) {
      await borrarArchivo(rutaNueva);
    }
    next(err);
  }
}

export async function eliminarRegistro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const { evidenciaUrl } = await model.eliminarRegistroEstudiante(req.params.id, idUsuario);
    await borrarArchivo(evidenciaUrl);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function getPendientesTutor(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const paginacion = leerPaginacion(req.query);
    const { items, total } = await model.obtenerPendientesTutor(idUsuario, paginacion);
    // `pendientes` se conserva para los consumidores actuales; `items` es la pagina.
    res.json({ pendientes: items, ...respuestaPaginada(items, total, paginacion) });
  } catch (err) {
    next(err);
  }
}

export async function validarRegistro(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { idUsuario } = requiereUsuario(req);
    const { id } = req.params;
    const body = veredictoSchema.parse(req.body);

    if ((body.estado === 'rechazado' || body.estado === 'corregir') && !body.comentario) {
      throw new ApiError(400, 'Debes indicar un comentario al tutor al rechazar o pedir correcciones');
    }

    const resultado = await model.cambiarEstadoRegistro({
      id,
      tipo: body.tipo,
      idTutor: idUsuario,
      estado: body.estado,
      comentario: body.comentario ?? null,
    });

    // Despues de guardar, y sin poder hacer fallar lo ya guardado.
    await avisarAlEstudiante(resultado, body.estado, body.comentario ?? null);

    res.json({ actualizado: { estado: resultado.estado } });
  } catch (err) {
    next(err);
  }
}

/**
 * Avisa al estudiante de lo que decidio su tutor y, si con esto cerro una de
 * las dos metas del programa, lo felicita.
 *
 * **No lanza nunca.** La validacion que hizo el tutor ya esta guardada; que el
 * correo no salga no puede convertir esa operacion en un error. Lo que falle
 * queda en la cola de notificaciones con su motivo.
 */
async function avisarAlEstudiante(
  resultado: ResultadoValidacion,
  estado: 'aprobado' | 'rechazado' | 'corregir',
  comentario: string | null
): Promise<void> {
  try {
    const estudiante = await findUsuarioPorId(resultado.idEstudiante);
    if (!estudiante) return;

    const aviso = plantillaHorasValidadas({
      nombre: estudiante.nombre_completo,
      estado,
      horas: resultado.horas,
      descripcion: resultado.descripcion,
      comentario,
    });
    await encolarYEnviar({
      idDestinatario: estudiante.id_usuario,
      destinatarioEmail: estudiante.email,
      destinatarioNombre: estudiante.nombre_completo,
      tipo: 'horas_validadas',
      asunto: aviso.asunto,
      cuerpo: aviso.cuerpo,
    });

    // Solo aprobar puede cerrar una meta: rechazar o pedir correcciones nunca
    // suma horas. Y volver a aprobar lo que ya estaba aprobado tampoco suma
    // nada, asi que no vuelve a felicitar.
    if (estado !== 'aprobado' || resultado.estadoAnterior === 'aprobado') return;

    const metas = await model.obtenerMetas();
    const horas = await model.horasAprobadasPorMeta(resultado.idEstudiante);

    // La meta se acaba de cerrar si, quitando las horas que se acaban de
    // aprobar, todavia no llegaba. Asi se felicita una vez y no en cada
    // validacion posterior.
    const cerroDirectas =
      horas.directas >= metas.horasDirectas &&
      horas.directas - resultado.horas < metas.horasDirectas;
    const cerroImpacto =
      horas.impacto >= metas.horasImpacto &&
      horas.impacto - resultado.horas < metas.horasImpacto;

    const meta = cerroDirectas ? 'directas' : cerroImpacto ? 'impacto' : null;
    if (!meta) return;

    const felicitacion = plantillaMetaAlcanzada({
      nombre: estudiante.nombre_completo,
      meta,
      horas: meta === 'directas' ? metas.horasDirectas : metas.horasImpacto,
    });
    await encolarYEnviar({
      idDestinatario: estudiante.id_usuario,
      destinatarioEmail: estudiante.email,
      destinatarioNombre: estudiante.nombre_completo,
      tipo: 'meta_alcanzada',
      asunto: felicitacion.asunto,
      cuerpo: felicitacion.cuerpo,
    });
  } catch (err) {
    console.error('No se pudo avisar al estudiante de la validación:', err);
  }
}
