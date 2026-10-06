import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import type { UserRole } from '../types.js';

/**
 * Quien puede descargar cada archivo.
 *
 * Las columnas `*_url` guardan una ruta relativa (`evidencias/<uuid>.jpg`). Este
 * modelo responde dos preguntas, en ese orden:
 *
 *   1. ¿Que fila de la base de datos apunta a esta ruta? (propietario)
 *   2. ¿El rol que pregunta tiene derecho a verlo? (permiso)
 *
 * La primera se resuelve con una sola consulta `union all` sobre las cinco
 * tablas que guardan rutas. La segunda se decide aqui, en codigo, para que las
 * reglas sean legibles y no dependan de repetir joins.
 */

export interface PropietarioArchivo {
  /** Estudiante o usuario dueño del archivo. `null` en documentos institucionales. */
  idDueno: string | null;
  /** Grupo al que pertenece el archivo, cuando aplica. */
  idGrupo: string | null;
}

export interface DecisionAcceso {
  permitido: boolean;
  status: number;
  mensaje: string;
}

const PERMITIDO: DecisionAcceso = { permitido: true, status: 200, mensaje: '' };

function denegar(status: number, mensaje: string): DecisionAcceso {
  return { permitido: false, status, mensaje };
}

export async function buscarPropietario(ruta: string): Promise<PropietarioArchivo | null> {
  const { rows } = await pool.query<{ id_dueno: string | null; id_grupo: string | null }>(
    `select id_dueno, id_grupo from (
       select b.id_estudiante as id_dueno, b.id_grupo as id_grupo
         from bitacoras_comunitario b
        where b.evidencia_foto_url = $1
       union all
       select c.id_estudiante, null::uuid
         from control_servicios_institucionales c
        where c.evidencia_foto_url = $1
       union all
       select g.id_coordinador, g.id_grupo
         from grupos_proyectos g
        where g.proyecto_escrito_url = $1 or g.diapositivas_url = $1
       union all
       select u.id_usuario, null::uuid
         from usuarios u
        where u.firma_url = $1 or u.sello_url = $1
       union all
       select null::uuid, null::uuid
         from plantillas_documento p
        where p.url_documento = $1
     ) t
     limit 1`,
    [ruta]
  );
  const fila = rows[0];
  return fila ? { idDueno: fila.id_dueno, idGrupo: fila.id_grupo } : null;
}

/** ¿Este tutor supervisa al estudiante indicado, en algun grupo? */
async function tutorVigilaEstudiante(idTutor: string, idEstudiante: string): Promise<boolean> {
  const { rows } = await pool.query<{ n: string }>(
    `select count(*)::text as n
       from integrantes_grupo ig
       join grupos_proyectos g on g.id_grupo = ig.id_grupo
      where ig.id_estudiante = $1 and g.id_tutor = $2`,
    [idEstudiante, idTutor]
  );
  return Number(rows[0]?.n ?? 0) > 0;
}

/** ¿Este tutor supervisa el grupo indicado? */
async function tutorVigilaGrupo(idTutor: string, idGrupo: string): Promise<boolean> {
  const { rows } = await pool.query<{ id_grupo: string }>(
    'select id_grupo from grupos_proyectos where id_grupo = $1 and id_tutor = $2',
    [idGrupo, idTutor]
  );
  return rows.length > 0;
}

/**
 * Decide el acceso. Se responde `404` (y no `403`) cuando el archivo existe pero
 * es de otra persona: un `403` confirmaria que ese identificador es real.
 */
export async function decidirAcceso(params: {
  rol: UserRole;
  idUsuario: string;
  ruta: string;
  categoria: string;
}): Promise<DecisionAcceso> {
  const { rol, idUsuario, ruta, categoria } = params;

  const dueno = await buscarPropietario(ruta);
  if (!dueno) {
    return denegar(404, 'Archivo no encontrado');
  }

  // El administrador y el coordinador ven todo: gestionan usuarios, grupos y
  // configuracion del programa.
  if (rol === 'admin' || rol === 'coordinador') {
    return PERMITIDO;
  }

  if (categoria === 'plantillas') {
    // Formatos base del programa: los consultan quienes gestionan.
    return denegar(403, 'Acceso denegado. Las plantillas son de uso administrativo');
  }

  // El sello es institucional: lo instala el administrador y no se distribuye
  // por la API. Se decide aqui, antes de mirar el propietario, para que ningun
  // rol (tampoco su propio dueño) se lo descargue.
  if (categoria === 'sellos') {
    return denegar(403, 'Acceso denegado. El sello es institucional');
  }

  if (rol === 'estudiante') {
    return dueno.idDueno === idUsuario ? PERMITIDO : denegar(404, 'Archivo no encontrado');
  }

  // Tutor.
  if (categoria === 'firmas') {
    return dueno.idDueno === idUsuario ? PERMITIDO : denegar(404, 'Archivo no encontrado');
  }
  if (categoria === 'proyectos') {
    if (!dueno.idGrupo) return denegar(404, 'Archivo no encontrado');
    return (await tutorVigilaGrupo(idUsuario, dueno.idGrupo))
      ? PERMITIDO
      : denegar(404, 'Archivo no encontrado');
  }

  // Evidencias: el tutor ve las de sus estudiantes, en cualquiera de sus grupos.
  if (!dueno.idDueno) return denegar(404, 'Archivo no encontrado');
  return (await tutorVigilaEstudiante(idUsuario, dueno.idDueno))
    ? PERMITIDO
    : denegar(404, 'Archivo no encontrado');
}

/**
 * Tablas que guardan una ruta a un archivo, con su clave primaria y sus columnas
 * de ruta. `tabla` y `columna` salen de aqui, nunca del cliente: no hay
 * inyeccion posible al interpolarlos en el SQL.
 */
const UBICACIONES = {
  usuarios: { id: 'id_usuario', columnas: ['firma_url', 'sello_url'] },
  grupos_proyectos: { id: 'id_grupo', columnas: ['proyecto_escrito_url', 'diapositivas_url'] },
  plantillas_documento: { id: 'id_plantilla', columnas: ['url_documento'] },
} as const;

export type TablaArchivo = keyof typeof UBICACIONES;

function comprobar(ubicacion: TablaArchivo, columna: string): void {
  const columnas: readonly string[] = UBICACIONES[ubicacion].columnas;
  if (!columnas.includes(columna)) {
    throw new ApiError(500, `Columna de archivo desconocida: ${ubicacion}.${columna}`);
  }
}

/** Ruta actual de una columna, para borrarla cuando se reemplaza el archivo. */
export async function leerRuta(
  tabla: TablaArchivo,
  id: string,
  columna: string
): Promise<string | null> {
  comprobar(tabla, columna);
  const clave = UBICACIONES[tabla].id;
  const { rows } = await pool.query<{ valor: string | null }>(
    `select ${columna} as valor from ${tabla} where ${clave} = $1`,
    [id]
  );
  return rows[0]?.valor ?? null;
}

/** Escribe la ruta en la columna. `false` si la fila no existe. */
export async function escribirRuta(
  tabla: TablaArchivo,
  id: string,
  columna: string,
  ruta: string
): Promise<boolean> {
  comprobar(tabla, columna);
  const clave = UBICACIONES[tabla].id;
  const { rows } = await pool.query<{ clave: unknown }>(
    `update ${tabla} set ${columna} = $1 where ${clave} = $2 returning ${clave}`,
    [ruta, id]
  );
  return rows.length > 0;
}
