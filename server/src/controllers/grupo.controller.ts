import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import { registrarAccion } from '../lib/historial.js';
import { encolarYEnviar } from '../lib/correo.js';
import { plantillaProyectoFinalizado } from '../lib/plantillas-correo.js';
import { borrarArchivo, guardarArchivo } from '../lib/archivos.js';
import { leerPaginacion, respuestaPaginada } from '../lib/paginacion.js';
import { archivoDeCampo } from '../middleware/subida.js';
import { escribirRuta, leerRuta } from '../models/archivo.model.js';
import * as model from '../models/grupo.model.js';
import type { EstadoGrupo } from '../models/grupo.model.js';
import type { UserRole } from '../types.js';

const estadosGrupo = ['en_curso', 'pendiente_aprobacion', 'finalizado', 'suspendido'] as const;
const estadosFinal = ['en_curso', 'aprobado', 'reprobado'] as const;

const idOpcional = z
  .union([z.string(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v == null || v === '' ? null : v))
  .refine((v) => v === null || z.string().uuid().safeParse(v).success, 'Identificador inválido');

const numeroOpcional = z
  .union([z.number(), z.literal(''), z.null()])
  .optional()
  .transform((v) => (v == null || v === '' ? null : v))
  .refine((v) => v === null || (Number.isInteger(v) && v > 0), 'Debe ser un número entero positivo');

const grupoSchema = z.object({
  nombreProyecto: z
    .string()
    .trim()
    .min(3, 'El nombre del proyecto debe tener al menos 3 caracteres')
    .max(120, 'El nombre del proyecto es demasiado largo'),
  periodoId: numeroOpcional,
  // Dos tutores por proyecto. Siguen siendo opcionales: un proyecto puede
  // crearse antes de tener asignada la tutoria, como ocurria con `tutorId`.
  tutorAcademicoId: idOpcional,
  tutorComunitarioId: idOpcional,
  coordinadorId: idOpcional,
  // Sin campos de URL: los documentos entran por `POST /:id/documentos`.
  estado: z.enum(estadosGrupo),
  integrantesIds: z.array(z.string().uuid('Estudiante inválido')).max(80).default([]),
});

// El motivo solo lo usa el administrador cuando fuerza una aprobacion con las
// horas incompletas. Queda en el historial de acciones, no en la fila del grupo.
const motivoOpcional = z
  .union([z.string(), z.null()])
  .optional()
  .transform((v) => (v == null ? null : v.trim()))
  .transform((v) => (v === '' ? null : v));

const ESTADO_EN_ESPANOL: Record<string, string> = {
  en_curso: 'en curso',
  pendiente_aprobacion: 'pendiente de aprobación',
  finalizado: 'finalizado',
  suspendido: 'suspendido',
};

const ESTADO_FINAL_EN_ESPANOL: Record<string, string> = {
  en_curso: 'en curso',
  aprobado: 'aprobado',
  reprobado: 'reprobado',
};

const estadoSchema = z.object({
  estado: z.enum(estadosGrupo),
  motivo: motivoOpcional,
});

const agregarSchema = z.object({
  estudiantesIds: z.array(z.string().uuid('Estudiante inválido')).min(1, 'Selecciona al menos un estudiante'),
});

const estadoFinalSchema = z.object({
  estadoFinal: z.enum(estadosFinal),
  motivo: motivoOpcional,
});

const filtrosSchema = z.object({
  periodo: z.preprocess((v) => (v === '' ? undefined : v), z.coerce.number().int().positive().optional()),
  estado: z.preprocess((v) => (v === '' ? undefined : v), z.enum(estadosGrupo).optional()),
  tutor: z.preprocess((v) => (v === '' ? undefined : v), z.string().uuid().optional()),
  q: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().min(1).optional()),
});

function requiereUsuario(req: AuthRequest): { idUsuario: string; rol: UserRole } {
  if (!req.usuario) {
    throw new ApiError(401, 'No autenticado');
  }
  return { idUsuario: req.usuario.idUsuario, rol: req.usuario.rol };
}

export async function listarGrupos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const filtros = filtrosSchema.parse(req.query);
    const paginacion = leerPaginacion(req.query);

    const { items, total } = await model.listarGrupos(
      {
        periodoId: filtros.periodo ?? null,
        estado: filtros.estado ?? null,
        tutorId: filtros.tutor ?? (usuario.rol === 'tutor' ? usuario.idUsuario : null),
        busqueda: filtros.q ?? null,
      },
      paginacion
    );

    // `grupos` se conserva para los consumidores actuales; `items` es la pagina.
    res.json({ grupos: items, ...respuestaPaginada(items, total, paginacion) });
  } catch (err) {
    next(err);
  }
}

export async function obtenerGrupo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const { id } = req.params as { id: string };
    const grupo = await model.obtenerGrupoConAcceso(id, usuario);
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function crearGrupo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const body = grupoSchema.parse(req.body);
    const idGrupo = await model.crearGrupo(body);
    const grupo = await model.obtenerGrupo(idGrupo);
    await registrarAccion(req, {
      accion: 'grupo.crear',
      entidad: 'grupo',
      idEntidad: idGrupo,
      descripcion: `Creó el proyecto "${body.nombreProyecto}"`,
    });
    res.status(201).json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function actualizarGrupo(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const body = grupoSchema.parse(req.body);
    const grupo = await model.actualizarGrupo(id, body);
    await registrarAccion(req, {
      accion: 'grupo.actualizar',
      entidad: 'grupo',
      idEntidad: id,
      descripcion: `Editó el proyecto "${grupo.nombreProyecto}"`,
    });
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstado(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const usuario = requiereUsuario(req);
    const { estado, motivo } = estadoSchema.parse(req.body);
    const { grupo, forzado } = await model.cambiarEstadoGrupo(id, estado as EstadoGrupo, {
      rol: usuario.rol,
      motivo,
    });

    await registrarAccion(req, {
      accion: forzado.length > 0 ? 'grupo.estado.forzado' : 'grupo.estado',
      entidad: 'grupo',
      idEntidad: id,
      descripcion:
        `Cambió el estado del proyecto "${grupo.nombreProyecto}" a ${ESTADO_EN_ESPANOL[estado]}` +
        (forzado.length > 0
          ? `, forzando la aprobación con ${forzado.length} integrante(s) sin completar sus horas`
          : ''),
      datos:
        forzado.length > 0
          ? {
              motivo,
              incompletos: forzado.map((f) => ({
                nombre: f.nombreCompleto,
                faltanDirectas: f.faltanDirectas,
                faltanImpacto: f.faltanImpacto,
              })),
            }
          : null,
    });

    if (estado === 'finalizado') {
      await avisarProyectoFinalizado(grupo);
    }

    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

/**
 * Avisa a los integrantes de que su proyecto se cerro.
 *
 * **No lanza.** El cambio de estado ya esta guardado; un fallo de correo no
 * puede convertirlo en un error. Lo que no salga queda en la cola.
 */
async function avisarProyectoFinalizado(grupo: model.DetalleGrupo): Promise<void> {
  try {
    for (const integrante of grupo.listaIntegrantes) {
      if (!integrante.activo) continue;
      const aviso = plantillaProyectoFinalizado({
        nombre: integrante.nombreCompleto,
        proyecto: grupo.nombreProyecto,
      });
      await encolarYEnviar({
        idDestinatario: integrante.idUsuario,
        destinatarioEmail: integrante.email,
        destinatarioNombre: integrante.nombreCompleto,
        tipo: 'proyecto_finalizado',
        asunto: aviso.asunto,
        cuerpo: aviso.cuerpo,
      });
    }
  } catch (err) {
    console.error('No se pudo avisar del cierre del proyecto:', err);
  }
}

export async function agregarIntegrantes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id } = req.params as { id: string };
    const { estudiantesIds } = agregarSchema.parse(req.body);
    const resultado = await model.agregarIntegrantes(id, estudiantesIds);
    const grupo = await model.obtenerGrupo(id);
    await registrarAccion(req, {
      accion: 'grupo.integrantes.agregar',
      entidad: 'grupo',
      idEntidad: id,
      descripcion: `Agregó ${resultado.agregados} estudiante(s) al proyecto "${grupo?.nombreProyecto ?? id}"`,
    });
    res.json({ agregados: resultado.agregados, grupo });
  } catch (err) {
    next(err);
  }
}

export async function quitarIntegrante(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    requiereUsuario(req);
    const { id, idEstudiante } = req.params as { id: string; idEstudiante: string };
    await model.quitarIntegrante(id, idEstudiante);
    const grupo = await model.obtenerGrupo(id);
    await registrarAccion(req, {
      accion: 'grupo.integrantes.quitar',
      entidad: 'grupo',
      idEntidad: id,
      descripcion: `Quitó un estudiante del proyecto "${grupo?.nombreProyecto ?? id}"`,
      datos: { idEstudiante },
    });
    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

export async function cambiarEstadoFinalIntegrante(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    requiereUsuario(req);
    const { id, idEstudiante } = req.params as { id: string; idEstudiante: string };
    const usuario = requiereUsuario(req);
    const { estadoFinal, motivo } = estadoFinalSchema.parse(req.body);
    const { forzado } = await model.cambiarEstadoFinalIntegrante(id, idEstudiante, estadoFinal, {
      rol: usuario.rol,
      motivo,
    });
    const grupo = await model.obtenerGrupo(id);

    await registrarAccion(req, {
      accion: forzado.length > 0 ? 'grupo.integrante.estado.forzado' : 'grupo.integrante.estado',
      entidad: 'grupo',
      idEntidad: id,
      descripcion:
        `Marcó a un integrante de "${grupo?.nombreProyecto ?? id}" como ` +
        `${ESTADO_FINAL_EN_ESPANOL[estadoFinal]}` +
        (forzado.length > 0 ? ', sin que completara sus horas' : ''),
      datos: {
        idEstudiante,
        estadoFinal,
        ...(forzado.length > 0 ? { motivo, faltaban: forzado[0] } : {}),
      },
    });

    res.json({ grupo });
  } catch (err) {
    next(err);
  }
}

/**
 * `POST /api/grupos/:id/documentos` con dos campos opcionales:
 * `proyectoEscrito` y `diapositivas`. Cada uno reemplaza el anterior.
 *
 * El archivo se escribe en disco antes de tocar la base de datos, y si la
 * escritura de la ruta falla se borra lo que se haya guardado. Al reemplazar,
 * el archivo viejo se borra despues de que la fila apunte al nuevo.
 */
export async function subirDocumentos(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Archivos ya escritos en disco que la base de datos todavia no referencia.
  // Si algo falla, estos son los unicos que se pueden borrar: los que ya se
  // guardaron en una columna tienen que sobrevivir aunque el otro falle, o la
  // fila quedaria apuntando a un archivo inexistente.
  const sinReferencia = new Set<string>();
  try {
    const usuario = requiereUsuario(req);
    const { id } = req.params as { id: string };

    const escrito = archivoDeCampo(req, 'proyectoEscrito');
    const diapositivas = archivoDeCampo(req, 'diapositivas');
    if (!escrito && !diapositivas) {
      throw new ApiError(400, 'Adjunta al menos un archivo: el proyecto escrito o las diapositivas');
    }

    // Se comprueba el permiso antes de escribir nada en disco.
    await model.exigirGestionDeGrupo(id, usuario);

    const anterior = {
      proyectoEscritoUrl: await leerRuta('grupos_proyectos', id, 'proyecto_escrito_url'),
      diapositivasUrl: await leerRuta('grupos_proyectos', id, 'diapositivas_url'),
    };

    if (escrito) {
      const ruta = (await guardarArchivo('proyectos', escrito)).ruta;
      sinReferencia.add(ruta);
      await escribirRuta('grupos_proyectos', id, 'proyecto_escrito_url', ruta);
      sinReferencia.delete(ruta);
    }
    if (diapositivas) {
      const ruta = (await guardarArchivo('proyectos', diapositivas)).ruta;
      sinReferencia.add(ruta);
      await escribirRuta('grupos_proyectos', id, 'diapositivas_url', ruta);
      sinReferencia.delete(ruta);
    }

    // La fila ya apunta a los archivos nuevos: los anteriores sobran.
    if (escrito && anterior.proyectoEscritoUrl) {
      await borrarArchivo(anterior.proyectoEscritoUrl);
    }
    if (diapositivas && anterior.diapositivasUrl) {
      await borrarArchivo(anterior.diapositivasUrl);
    }

    const grupo = await model.obtenerGrupo(id);
    res.status(201).json({ grupo });
  } catch (err) {
    for (const ruta of sinReferencia) {
      await borrarArchivo(ruta);
    }
    next(err);
  }
}
