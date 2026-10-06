import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';

export type TipoRegistro = 'comunitario' | 'social' | 'ambiental';

export interface FilaMisRegistro {
  id: string;
  tipo: TipoRegistro;
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  /** Ruta relativa del archivo, o `null`. El alcance decide si se puede abrir. */
  evidenciaUrl: string | null;
  estado: string;
  comentarioTutor: string | null;
  proyecto: string | null;
  creadoEn: string;
}

export interface Metas {
  horasDirectas: number;
  horasImpacto: number;
  limiteDiario: number;
  periodoActivo: number | null;
}

/** Estados en los que el estudiante todavia puede tocar su propio registro. */
export const ESTADOS_EDITABLES = ['pendiente', 'corregir'] as const;

export async function listarMisRegistros(idEstudiante: string): Promise<FilaMisRegistro[]> {
  const { rows } = await pool.query<{
    id: string;
    tipo: TipoRegistro;
    semana: number | null;
    fecha: string;
    descripcion: string;
    horas: string;
    evidencia_url: string | null;
    estado: string;
    comentario_tutor: string | null;
    proyecto: string | null;
    creado_en: string;
  }>(
    `select b.id_bitacora as id, 'comunitario' as tipo, b.numero_semana as semana,
            b.fecha_actividad::text as fecha, b.descripcion, b.horas_invertidas::text as horas,
            b.evidencia_foto_url as evidencia_url, b.estado,
            b.comentario_tutor, g.nombre_proyecto as proyecto, b.creado_en::text as creado_en
     from bitacoras_comunitario b
     left join grupos_proyectos g on g.id_grupo = b.id_grupo
     where b.id_estudiante = $1
     union all
     select c.id_registro as id, c.tipo, null as semana, c.fecha_actividad::text as fecha,
            c.descripcion, c.horas_invertidas::text as horas,
            c.evidencia_foto_url as evidencia_url, c.estado,
            c.comentario_tutor, null as proyecto, c.creado_en::text as creado_en
     from control_servicios_institucionales c
     where c.id_estudiante = $1
     order by fecha desc, creado_en desc`,
    [idEstudiante]
  );
  return rows.map((r) => ({
    id: r.id,
    tipo: r.tipo,
    semana: r.semana,
    fecha: r.fecha,
    descripcion: r.descripcion,
    horas: Number(r.horas),
    evidenciaUrl: r.evidencia_url,
    estado: r.estado,
    comentarioTutor: r.comentario_tutor,
    proyecto: r.proyecto,
    creadoEn: r.creado_en,
  }));
}

export async function obtenerGruposEstudiante(
  idEstudiante: string
): Promise<{ idGrupo: string; nombreProyecto: string; estado: string }[]> {
  const { rows } = await pool.query<{ id_grupo: string; nombre_proyecto: string; estado: string }>(
    `select g.id_grupo, g.nombre_proyecto, g.estado
     from integrantes_grupo ig
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     where ig.id_estudiante = $1 and g.estado not in ('finalizado', 'suspendido')
     order by g.creado_en desc`,
    [idEstudiante]
  );
  return rows.map((r) => ({
    idGrupo: r.id_grupo,
    nombreProyecto: r.nombre_proyecto,
    estado: r.estado,
  }));
}

export async function obtenerLimiteHorasDiarias(): Promise<number> {
  const { rows } = await pool.query<{ limite: string }>(
    'select limite_horas_diarias::text as limite from configuracion_sistema limit 1'
  );
  return Number(rows[0]?.limite ?? 8);
}

/** Lee de una sola vez las tres reglas del programa. */
export async function obtenerMetas(): Promise<Metas> {
  const { rows } = await pool.query<{
    horas_directas: string;
    horas_impacto: string;
    limite_horas_diarias: string;
    periodo_activo: number | null;
  }>('select horas_directas::text, horas_impacto::text, limite_horas_diarias::text, periodo_activo from configuracion_sistema limit 1');
  const fila = rows[0];
  return {
    horasDirectas: Number(fila?.horas_directas ?? 90),
    horasImpacto: Number(fila?.horas_impacto ?? 30),
    limiteDiario: Number(fila?.limite_horas_diarias ?? 8),
    periodoActivo: fila?.periodo_activo ?? null,
  };
}

/**
 * Horas ya APROBADAS del estudiante en la meta que corresponde al tipo.
 * Solo las aprobadas cuentan, no las pendientes: si el tutor rechaza un
 * registro, esas horas nocomputan nunca y el estudiante debe poder rehacerlas.
 */
async function horasAprobadasDeMeta(
  client: PoolClient,
  idEstudiante: string,
  tipo: TipoRegistro
): Promise<number> {
  if (tipo === 'comunitario') {
    const { rows } = await client.query<{ total: string }>(
      `select coalesce(sum(horas_invertidas), 0)::text as total
         from bitacoras_comunitario
        where id_estudiante = $1 and estado = 'aprobado'`,
      [idEstudiante]
    );
    return Number(rows[0]?.total ?? 0);
  }
  const { rows } = await client.query<{ total: string }>(
    `select coalesce(sum(horas_invertidas), 0)::text as total
       from control_servicios_institucionales
      where id_estudiante = $1 and estado = 'aprobado'`,
    [idEstudiante]
  );
  return Number(rows[0]?.total ?? 0);
}

/**
 * Bloquea el registro cuando, sumando las horas aprobadas, se pasa de la meta.
 * Con esta regla un estudiante puede acumular muchos registros `pendiente`
 * (eso lo decide el tutor), pero no pasar de 90/30 horas validas.
 */
async function comprobarMeta(
  client: PoolClient,
  idEstudiante: string,
  tipo: TipoRegistro,
  horas: number,
  metas: Metas
): Promise<void> {
  const esDirecto = tipo === 'comunitario';
  const meta = esDirecto ? metas.horasDirectas : metas.horasImpacto;
  const etiqueta = esDirecto ? 'trabajo directo' : 'impacto social o ambiental';
  const yaAprobadas = await horasAprobadasDeMeta(client, idEstudiante, tipo);

  if (yaAprobadas + horas > meta) {
    throw new ApiError(
      400,
      `No puedes registrar ${horas}h: ya tienes ${yaAprobadas}h aprobadas y la meta de ${etiqueta} es de ${meta}h. ` +
        `Te faltan ${meta - yaAprobadas}h.`
    );
  }
}

/** Horas ya registradas por el estudiante en una fecha, en ambas tablas. */
async function horasDelDia(
  client: PoolClient,
  idEstudiante: string,
  fecha: string,
  excluirId: string | null = null
): Promise<number> {
  const { rows } = await client.query<{ total: string }>(
    `select coalesce(
       (select coalesce(sum(horas_invertidas), 0) from bitacoras_comunitario
         where id_estudiante = $1 and fecha_actividad = $2 and ($3::uuid is null or id_bitacora <> $3)) +
       (select coalesce(sum(horas_invertidas), 0) from control_servicios_institucionales
         where id_estudiante = $1 and fecha_actividad = $2 and ($3::uuid is null or id_registro <> $3)), 0)::text as total`,
    [idEstudiante, fecha, excluirId]
  );
  return Number(rows[0]?.total ?? 0);
}

function comprobarLimiteDiario(yaRegistradas: number, horas: number, limite: number): void {
  if (yaRegistradas + horas > limite) {
    throw new ApiError(
      400,
      `Superas el límite diario de ${limite} horas (ese día ya llevas ${yaRegistradas}h registradas)`
    );
  }
}

export interface DatosRegistro {
  idEstudiante: string;
  tipo: TipoRegistro;
  fecha: string;
  descripcion: string;
  horas: number;
  semana?: number;
  idGrupo?: string;
  evidenciaUrl?: string | null;
}

async function exigirMembresia(
  client: PoolClient,
  idGrupo: string,
  idEstudiante: string
): Promise<void> {
  const { rows } = await client.query<{ cuenta: string }>(
    'select count(*)::text as cuenta from integrantes_grupo where id_grupo = $1 and id_estudiante = $2',
    [idGrupo, idEstudiante]
  );
  if (Number(rows[0]?.cuenta ?? 0) === 0) {
    throw new ApiError(403, 'No perteneces a ese grupo/proyecto');
  }
}

export async function crearRegistroEstudiante(
  datos: DatosRegistro,
  metas: Metas
): Promise<{ id: string }> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const yaRegistradas = await horasDelDia(client, datos.idEstudiante, datos.fecha);
    comprobarLimiteDiario(yaRegistradas, datos.horas, metas.limiteDiario);
    await comprobarMeta(client, datos.idEstudiante, datos.tipo, datos.horas, metas);

    let id: string;
    if (datos.tipo === 'comunitario') {
      if (!datos.idGrupo || !datos.semana) {
        throw new ApiError(400, 'La bitácora comunitaria requiere semana y grupo/proyecto');
      }
      await exigirMembresia(client, datos.idGrupo, datos.idEstudiante);
      const { rows } = await client.query<{ id_bitacora: string }>(
        `insert into bitacoras_comunitario
           (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas,
            evidencia_foto_url, estado)
         values ($1, $2, $3, $4, $5, $6, $7, 'pendiente')
         returning id_bitacora`,
        [
          datos.idEstudiante,
          datos.idGrupo,
          datos.semana,
          datos.fecha,
          datos.descripcion,
          datos.horas,
          datos.evidenciaUrl ?? null,
        ]
      );
      id = rows[0].id_bitacora;
    } else {
      const { rows } = await client.query<{ id_registro: string }>(
        `insert into control_servicios_institucionales
           (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, evidencia_foto_url, estado)
         values ($1, $2, $3, $4, $5, $6, 'pendiente')
         returning id_registro`,
        [
          datos.idEstudiante,
          datos.tipo,
          datos.fecha,
          datos.descripcion,
          datos.horas,
          datos.evidenciaUrl ?? null,
        ]
      );
      id = rows[0].id_registro;
    }

    await client.query('commit');
    return { id };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

interface RegistroLocalizado {
  tipo: TipoRegistro;
  id_estudiante: string;
  grupo: string | null;
  semana: number | null;
  estado: string;
  evidencia_url: string | null;
  horas: string;
}

/**
 * Busca el registro en las dos tablas. Devuelve `null` si no existe o si es de
 * otro estudiante: en ambos casos la respuesta al cliente es la misma, `404`.
 */
async function localizarRegistroPropio(
  client: PoolClient,
  idRegistro: string,
  idEstudiante: string
): Promise<RegistroLocalizado | null> {
  const { rows } = await client.query<RegistroLocalizado>(
    `select 'comunitario' as tipo, id_estudiante, id_grupo as grupo, numero_semana as semana,
            estado, evidencia_foto_url as evidencia_url, horas_invertidas::text as horas
       from bitacoras_comunitario
      where id_bitacora = $1 and id_estudiante = $2
     union all
     select c.tipo, c.id_estudiante, null::uuid, null::int,
            c.estado, c.evidencia_foto_url as evidencia_url, c.horas_invertidas::text
       from control_servicios_institucionales c
      where c.id_registro = $1 and c.id_estudiante = $2
     limit 1`,
    [idRegistro, idEstudiante]
  );
  return rows[0] ?? null;
}

function exigirEditable(estado: string): void {
  if (!(ESTADOS_EDITABLES as readonly string[]).includes(estado)) {
    throw new ApiError(
      409,
      `Este registro ya fue revisado por el tutor (estado: ${estado}) y no se puede modificar.`
    );
  }
}

export interface ResultadoEdicion {
  id: string;
  tipo: TipoRegistro;
  estado: string;
  /** Evidencia que queda vigente. Si hubo reemplazo, es la nueva. */
  evidenciaUrl: string | null;
  /** Evidencia anterior, para que el controlador borre el archivo viejo. */
  evidenciaAnterior: string | null;
  /** `true` si el registro estaba en `corregir` y volvio a `pendiente`. */
  reiniciado: boolean;
}

/**
 * El estudiante corrige su propio registro mientras siga `pendiente` o
 * `corregir`. Al corregir, el registro vuelve a `pendiente` y se limpia el
 * comentario del tutor, para que reaparezca en su lista de pendientes.
 */
export async function actualizarRegistroEstudiante(
  datos: {
    idRegistro: string;
    idEstudiante: string;
    fecha: string;
    descripcion: string;
    horas: number;
    semana?: number;
    idGrupo?: string;
    /** Nueva evidencia. `undefined` = no llega archivo, se conserva la actual. */
    evidenciaUrl?: string | null;
  },
  metas: Metas
): Promise<ResultadoEdicion> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const actual = await localizarRegistroPropio(client, datos.idRegistro, datos.idEstudiante);
    if (!actual) {
      throw new ApiError(404, 'Registro no encontrado');
    }
    exigirEditable(actual.estado);

    // Al cambiar la fecha, el limite diario se revisa sobre la fecha nueva y
    // excluyendo este mismo registro, que antes contaba con otras horas.
    const yaRegistradas = await horasDelDia(client, datos.idEstudiante, datos.fecha, datos.idRegistro);
    comprobarLimiteDiario(yaRegistradas, datos.horas, metas.limiteDiario);

    // `undefined` conserva la evidencia actual; `null` la quita; un string la reemplaza.
    const quitarEvidencia = datos.evidenciaUrl === null;
    const nuevaEvidencia = datos.evidenciaUrl ?? null;

    if (actual.tipo !== 'comunitario') {
      if (datos.semana || datos.idGrupo) {
        throw new ApiError(400, 'Los servicios sociales/ambientales no usan semana ni grupo');
      }
      await client.query(
        `update control_servicios_institucionales
            set fecha_actividad = $2,
                descripcion = $3,
                horas_invertidas = $4,
                evidencia_foto_url = case when $5 then null else coalesce($6, evidencia_foto_url) end,
                estado = 'pendiente',
                comentario_tutor = null
          where id_registro = $1`,
        [datos.idRegistro, datos.fecha, datos.descripcion, datos.horas, quitarEvidencia, nuevaEvidencia]
      );
    } else {
      const idGrupo = datos.idGrupo ?? actual.grupo ?? undefined;
      const semana = datos.semana ?? actual.semana ?? undefined;
      if (!idGrupo || !semana) {
        throw new ApiError(400, 'La bitácora comunitaria requiere semana y grupo/proyecto');
      }
      await exigirMembresia(client, idGrupo, datos.idEstudiante);

      await client.query(
        `update bitacoras_comunitario
            set id_grupo = $2,
                numero_semana = $3,
                fecha_actividad = $4,
                descripcion = $5,
                horas_invertidas = $6,
                evidencia_foto_url = case when $7 then null else coalesce($8, evidencia_foto_url) end,
                estado = 'pendiente',
                comentario_tutor = null
          where id_bitacora = $1`,
        [
          datos.idRegistro,
          idGrupo,
          semana,
          datos.fecha,
          datos.descripcion,
          datos.horas,
          quitarEvidencia,
          nuevaEvidencia,
        ]
      );
    }

    await client.query('commit');

    return {
      id: datos.idRegistro,
      tipo: actual.tipo,
      estado: 'pendiente',
      evidenciaUrl: quitarEvidencia ? null : (nuevaEvidencia ?? actual.evidencia_url),
      evidenciaAnterior: actual.evidencia_url,
      reiniciado: actual.estado === 'corregir',
    };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

/** Borra un registro propio editable. Un `aprobado` nunca se borra. */
export async function eliminarRegistroEstudiante(
  idRegistro: string,
  idEstudiante: string
): Promise<{ evidenciaUrl: string | null }> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const actual = await localizarRegistroPropio(client, idRegistro, idEstudiante);
    if (!actual) {
      throw new ApiError(404, 'Registro no encontrado');
    }
    exigirEditable(actual.estado);

    if (actual.tipo === 'comunitario') {
      await client.query('delete from bitacoras_comunitario where id_bitacora = $1', [idRegistro]);
    } else {
      await client.query('delete from control_servicios_institucionales where id_registro = $1', [
        idRegistro,
      ]);
    }

    await client.query('commit');
    return { evidenciaUrl: actual.evidencia_url };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export interface FilaPendienteTutor {
  id: string;
  idEstudiante: string;
  estudianteNombre: string;
  idGrupo: string | null;
  proyectoNombre: string | null;
  tipo: TipoRegistro;
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidenciaUrl: string | null;
  estado: string;
}

export async function obtenerPendientesTutor(idTutor: string): Promise<FilaPendienteTutor[]> {
  const { rows } = await pool.query<{
    id: string;
    id_estudiante: string;
    estudiante_nombre: string;
    id_grupo: string | null;
    proyecto_nombre: string | null;
    tipo: TipoRegistro;
    semana: number | null;
    fecha: string;
    descripcion: string;
    horas: string;
    evidencia_url: string | null;
    estado: string;
  }>(
    `select b.id_bitacora as id, b.id_estudiante, u.nombre_completo as estudiante_nombre,
            b.id_grupo, g.nombre_proyecto as proyecto_nombre, 'comunitario' as tipo,
            b.numero_semana as semana, b.fecha_actividad::text as fecha, b.descripcion,
            b.horas_invertidas::text as horas, b.evidencia_foto_url as evidencia_url, b.estado
     from bitacoras_comunitario b
     join grupos_proyectos g on g.id_grupo = b.id_grupo
     join usuarios u on u.id_usuario = b.id_estudiante
     where g.id_tutor = $1 and b.estado in ('pendiente', 'corregir')
     union all
     select c.id_registro as id, c.id_estudiante, u.nombre_completo as estudiante_nombre,
            null::uuid as id_grupo, null as proyecto_nombre, c.tipo as tipo,
            null as semana, c.fecha_actividad::text as fecha, c.descripcion,
            c.horas_invertidas::text as horas, c.evidencia_foto_url as evidencia_url, c.estado
     from control_servicios_institucionales c
     join integrantes_grupo ig on ig.id_estudiante = c.id_estudiante
     join grupos_proyectos g on g.id_grupo = ig.id_grupo
     join usuarios u on u.id_usuario = c.id_estudiante
     where g.id_tutor = $1 and c.estado in ('pendiente', 'corregir')
     order by fecha asc`,
    [idTutor]
  );
  return rows.map((r) => ({
    id: r.id,
    idEstudiante: r.id_estudiante,
    estudianteNombre: r.estudiante_nombre,
    idGrupo: r.id_grupo,
    proyectoNombre: r.proyecto_nombre,
    tipo: r.tipo,
    semana: r.semana,
    fecha: r.fecha,
    descripcion: r.descripcion,
    horas: Number(r.horas),
    evidenciaUrl: r.evidencia_url,
    estado: r.estado,
  }));
}

export async function cambiarEstadoRegistro(
  datos: {
    id: string;
    tipo: TipoRegistro;
    idTutor: string;
    estado: 'aprobado' | 'rechazado' | 'corregir';
    comentario: string | null;
  }
): Promise<{ estado: string }> {
  const { id, tipo, idTutor, estado, comentario } = datos;

  let filas: number;
  if (tipo === 'comunitario') {
    const { rows } = await pool.query<{ id_bitacora: string }>(
      `update bitacoras_comunitario b
       set estado = $2, comentario_tutor = $3
       where b.id_bitacora = $1
         and exists (select 1 from grupos_proyectos g
                     where g.id_grupo = b.id_grupo and g.id_tutor = $4)
       returning id_bitacora`,
      [id, estado, comentario, idTutor]
    );
    filas = rows.length;
  } else {
    const { rows } = await pool.query<{ id_registro: string }>(
      `update control_servicios_institucionales c
       set estado = $2, comentario_tutor = $3
       where c.id_registro = $1
         and exists (select 1
                     from integrantes_grupo ig
                     join grupos_proyectos g on g.id_grupo = ig.id_grupo
                     where ig.id_estudiante = c.id_estudiante and g.id_tutor = $4)
       returning id_registro`,
      [id, estado, comentario, idTutor]
    );
    filas = rows.length;
  }

  if (filas === 0) {
    throw new ApiError(404, 'Registro no encontrado o sin autorización para validarlo');
  }

  return { estado };
}