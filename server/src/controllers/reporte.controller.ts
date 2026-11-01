import type { NextFunction, Response } from 'express';
import { z } from 'zod';
import type { AuthRequest } from '../middleware/auth.js';
import { ApiError } from '../lib/errors.js';
import { obtenerGrupoConAcceso } from '../models/grupo.model.js';
import * as model from '../models/reporte.model.js';
import { findUsuarioPorId } from '../models/usuario.model.js';
import { generarConsolidadoExcel, generarConsolidadoPdf } from '../lib/reportes/consolidado.js';
import { generarActaPdf } from '../lib/reportes/acta.js';
import { generarCertificadoPdf } from '../lib/reportes/certificado.js';
import { generarReporteSemanalPdf } from '../lib/reportes/semanal.js';
import type { UserRole } from '../types.js';

/**
 * Reportes en PDF y Excel.
 *
 * Se generan en memoria y se devuelven como descarga: no se guardan en disco,
 * asi que no hay archivos que limpiar ni rutas que oleer. Todos exigen token y
 * respetan el alcance del rol: el tutor nunca ve horas de grupos ajenos.
 */

const idGrupoSchema = z.string().uuid('Identificador de grupo inválido');
const idUsuarioSchema = z.string().uuid('Identificador de usuario inválido');

/** `?periodoId=3` o ausente. `''` se trata como ausente. */
const periodoQuery = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  z.union([z.coerce.number().int().positive(), z.null()])
);

const consolidadoQuery = z.object({
  periodoId: periodoQuery,
  grupoId: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([idGrupoSchema, z.null()])
  ),
});

/** Nombre de archivo sin acentos ni espacios: se usa en el `Content-Disposition`. */
function nombreArchivo(partes: string[]): string {
  const base = partes
    .join('-')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return base || 'reporte';
}

function descargar(res: Response, nombre: string, tipo: string, contenido: Buffer): void {
  res.setHeader('Content-Type', tipo);
  res.setHeader('Content-Length', contenido.length);
  res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
  // Un reporte refleja el estado actual: no debe quedar cacheado en el navegador.
  res.setHeader('Cache-Control', 'no-store');
  res.send(contenido);
}

function requiereUsuario(req: AuthRequest): NonNullable<AuthRequest['usuario']> {
  if (!req.usuario) throw new ApiError(401, 'No autenticado');
  return req.usuario;
}

/**
 * El token solo lleva id y rol, no el nombre. El pie del documento lo quiere
 * legible ("Ana Pérez (coordinador)"), asi que se resuelve una vez por peticion.
 */
async function emisorDe(usuario: NonNullable<AuthRequest['usuario']>): Promise<string> {
  const fila = await findUsuarioPorId(usuario.idUsuario);
  return `${fila?.nombre_completo ?? 'Usuario'} (${usuario.rol})`;
}

/** Etiqueta legible del alcance, para que el PDF diga que se esta mirando. */
async function alcanceDe(
  usuario: NonNullable<AuthRequest['usuario']>,
  grupoId: string | null,
  periodoId: number | null
): Promise<string> {
  const partes: string[] = [];
  if (periodoId) {
    partes.push(`periodo ${(await model.obtenerPeriodo(periodoId))?.nombre ?? periodoId}`);
  } else {
    partes.push('todos los periodos');
  }
  if (grupoId) {
    partes.push('un solo grupo');
  } else if (usuario.rol === 'tutor') {
    partes.push('grupos tutoreados');
  } else {
    partes.push('todos los estudiantes');
  }
  return partes.join(', ');
}

/**
 * Un tutor que pide el consolidado acotado a otro grupo no puede verlo. Sin el
 * filtro de grupo ya recibe solo sus estudiantes, pero el filtro explicito es
 * la via para intentar salirse de ahi.
 */
async function exigirGrupoPropio(grupoId: string, usuario: { idUsuario: string; rol: UserRole }): Promise<void> {
  if (usuario.rol !== 'tutor') return;
  await obtenerGrupoConAcceso(grupoId, usuario);
}

async function datosConsolidado(req: AuthRequest) {
  const usuario = requiereUsuario(req);
  const q = consolidadoQuery.parse(req.query);
  if (q.grupoId) {
    await exigirGrupoPropio(q.grupoId, usuario);
  }
  const periodoId = q.periodoId;
  const periodo = await model.obtenerPeriodo(periodoId);
  const filas = await model.obtenerConsolidado({
    periodoId,
    idGrupo: q.grupoId,
    idTutor: usuario.rol === 'tutor' ? usuario.idUsuario : null,
  });
  return {
    filas,
    periodo,
    alcance: await alcanceDe(usuario, q.grupoId, periodoId),
    generadoPor: await emisorDe(usuario),
  };
}

export async function consolidadoPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const datos = await datosConsolidado(req);
    const nombre = `${nombreArchivo(['consolidado-horas', datos.periodo?.nombre ?? 'todo'])}.pdf`;
    descargar(res, nombre, 'application/pdf', await generarConsolidadoPdf(datos));
  } catch (err) {
    next(err);
  }
}

export async function consolidadoExcel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const datos = await datosConsolidado(req);
    descargar(
      res,
      `${nombreArchivo(['consolidado-horas', datos.periodo?.nombre ?? 'todo'])}.xlsx`,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      await generarConsolidadoExcel(datos)
    );
  } catch (err) {
    next(err);
  }
}

export async function actaPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const idGrupo = idGrupoSchema.parse(req.params.idGrupo);
    // `obtenerGrupoConAcceso` ya devuelve 404 si no existe y 403 si el grupo es
    // de otro tutor, que es exactamente lo que necesita este reporte.
    const grupo = await obtenerGrupoConAcceso(idGrupo, usuario);
    const datos = await model.obtenerDatosActa(idGrupo);
    if (!datos) throw new ApiError(404, 'Grupo/proyecto no encontrado');

    descargar(
      res,
      `${nombreArchivo(['acta', grupo.nombreProyecto])}.pdf`,
      'application/pdf',
      await generarActaPdf(datos, await emisorDe(usuario))
    );
  } catch (err) {
    next(err);
  }
}

export async function certificadoPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const idUsuario = idUsuarioSchema.parse(req.params.idUsuario);
    const q = z.object({ periodoId: periodoQuery }).parse(req.query);
    const datos = await model.obtenerDatosCertificado(idUsuario, q.periodoId);
    if (!datos) throw new ApiError(404, 'Estudiante no encontrado');

    // Sin esta comprobacion un tutor podria pedir el certificado de cualquier
    // estudiante de la institucion y verle las horas.
    if (usuario.rol === 'tutor' && !(await model.esIntegranteDeTutor(idUsuario, usuario.idUsuario))) {
      throw new ApiError(403, 'Solo puedes consultar estudiantes de tus grupos');
    }

    descargar(
      res,
      `${nombreArchivo(['certificado', datos.nombreCompleto])}.pdf`,
      'application/pdf',
      await generarCertificadoPdf(datos, await emisorDe(usuario))
    );
  } catch (err) {
    next(err);
  }
}

// --------------------------------------------------------------------
// Reporte semanal de actividades
// --------------------------------------------------------------------
//
// Es el unico reporte que tambien baja el estudiante, y por eso el alcance NO
// se resuelve con `requireRole` sino aqui dentro, como ya hacen `/busqueda` y
// `/archivos`: un rol no basta, hay que acotar POR QUIEN pregunta.

const semanalQuery = z.object({
  periodoId: periodoQuery,
  semana: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([z.coerce.number().int().positive().max(60), z.null()])
  ),
  grupoId: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([idGrupoSchema, z.null()])
  ),
  estudianteId: z.preprocess(
    (v) => (v === '' || v === undefined ? null : v),
    z.union([idUsuarioSchema, z.null()])
  ),
});

type FiltroPedido = z.infer<typeof semanalQuery>;

/**
 * Convierte lo que pide el cliente en lo que de verdad puede ver.
 *
 * El estudiante es el caso que importa: su `estudianteId` se FUERZA al suyo, se
 * mande lo que se mande. Si se respetara el parametro, bastaria con cambiar un
 * uuid en la URL para leer las actividades de un companero.
 */
async function alcanceSemanal(
  usuario: NonNullable<AuthRequest['usuario']>,
  pedido: FiltroPedido
): Promise<model.FiltroSemanal> {
  if (usuario.rol === 'estudiante') {
    return {
      periodoId: pedido.periodoId,
      semana: pedido.semana,
      idGrupo: null,
      idEstudiante: usuario.idUsuario,
      idTutor: null,
    };
  }

  if (usuario.rol === 'tutor') {
    // `obtenerGrupoConAcceso` ya responde 403 si el grupo no es suyo; y sin
    // grupo concreto, `idTutor` acota a todos los suyos.
    if (pedido.grupoId) {
      await obtenerGrupoConAcceso(pedido.grupoId, usuario);
    }
    if (pedido.estudianteId && !(await model.esIntegranteDeTutor(pedido.estudianteId, usuario.idUsuario))) {
      throw new ApiError(403, 'Solo puedes consultar estudiantes de tus grupos');
    }
    return {
      periodoId: pedido.periodoId,
      semana: pedido.semana,
      idGrupo: pedido.grupoId,
      idEstudiante: pedido.estudianteId,
      idTutor: usuario.idUsuario,
    };
  }

  return {
    periodoId: pedido.periodoId,
    semana: pedido.semana,
    idGrupo: pedido.grupoId,
    idEstudiante: pedido.estudianteId,
    idTutor: null,
  };
}

/** Frase del membrete que dice exactamente que se esta mirando. */
async function describirAlcance(
  usuario: NonNullable<AuthRequest['usuario']>,
  filtro: model.FiltroSemanal
): Promise<string> {
  if (filtro.idEstudiante) {
    const nombre = await model.nombreDeEstudiante(filtro.idEstudiante);
    if (!nombre) throw new ApiError(404, 'Estudiante no encontrado');
    return usuario.rol === 'estudiante' ? `Mis actividades - ${nombre}` : nombre;
  }
  if (filtro.idGrupo) {
    const grupo = await obtenerGrupoConAcceso(filtro.idGrupo, usuario);
    return grupo.nombreProyecto;
  }
  if (filtro.idTutor) return 'Mis grupos';
  return 'Todos los estudiantes';
}

/** `GET /api/reportes/semanas?periodoId=&grupoId=&estudianteId=` */
export async function semanasDisponibles(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const pedido = semanalQuery.parse(req.query);
    const filtro = await alcanceSemanal(usuario, pedido);

    const periodo = await model.obtenerPeriodo(filtro.periodoId);
    if (!periodo) {
      res.json({ semanas: [], periodo: null });
      return;
    }

    const semanas = await model.obtenerSemanasConActividad(periodo.id, filtro);
    res.json({ semanas, periodo });
  } catch (err) {
    next(err);
  }
}

/** `GET /api/reportes/semanal.pdf?periodoId=&semana=&grupoId=&estudianteId=` */
export async function reporteSemanalPdf(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const usuario = requiereUsuario(req);
    const pedido = semanalQuery.parse(req.query);
    const filtro = await alcanceSemanal(usuario, pedido);

    const periodo = await model.obtenerPeriodo(filtro.periodoId);
    if (!periodo) {
      throw new ApiError(400, 'No hay un periodo academico activo. Selecciona uno.');
    }

    const descripcion = await describirAlcance(usuario, filtro);
    const filas = await model.obtenerDetalleSemanal(periodo.id, filtro);

    const quien = await findUsuarioPorId(usuario.idUsuario);
    const pdf = await generarReporteSemanalPdf(
      filas,
      periodo,
      {
        descripcion,
        semana: filtro.semana,
        // Con una sola persona no hay nada que agrupar por persona: se agrupa
        // por semana, que es como se lee su propio avance.
        agruparPor: filtro.idEstudiante ? 'semana' : 'estudiante',
      },
      quien?.nombre_completo ?? 'Sistema'
    );

    const nombre = nombreArchivo([
      'reporte',
      filtro.semana === null ? 'actividades' : `semana-${filtro.semana}`,
      descripcion,
    ]);
    descargar(res, `${nombre}.pdf`, 'application/pdf', pdf);
  } catch (err) {
    next(err);
  }
}
