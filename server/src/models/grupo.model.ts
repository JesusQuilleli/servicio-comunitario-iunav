import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { ApiError } from '../lib/errors.js';
import type { Paginacion } from '../lib/paginacion.js';
import { ETIQUETA_TIPO_TUTOR, esTutorDelGrupo, type TipoTutor } from '../lib/tutores.js';
import type { UserRole } from '../types.js';

export type EstadoGrupo = 'en_curso' | 'pendiente_aprobacion' | 'finalizado' | 'suspendido';
export type EstadoFinal = 'en_curso' | 'aprobado' | 'reprobado';

export interface FilaGrupo {
  idGrupo: string;
  nombreProyecto: string;
  estado: EstadoGrupo;
  periodoId: number | null;
  periodo: string | null;
  // Dos tutores por proyecto: el Academico guia el trabajo y el Comunitario
  // representa a la institucion donde se presta el servicio. Los dos pueden
  // validar las horas de los integrantes.
  tutorAcademicoId: string | null;
  tutorAcademicoNombre: string | null;
  tutorComunitarioId: string | null;
  tutorComunitarioNombre: string | null;
  coordinadorId: string | null;
  coordinadorNombre: string | null;
  proyectoEscritoUrl: string | null;
  diapositivasUrl: string | null;
  integrantes: number;
  horasAprobadas: number;
  horasPendientes: number;
  creadoEn: string;
}

export interface FilaIntegrante {
  idUsuario: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  activo: boolean;
  estadoFinal: EstadoFinal | null;
  /** Horas aprobadas de trabajo directo (bitacora comunitaria) en este grupo. */
  horasDirectas: number;
  /** Horas aprobadas de impacto social/ambiental del estudiante. */
  horasImpacto: number;
  horasAprobadas: number;
  horasPendientes: number;
}

export type DetalleGrupo = FilaGrupo & { listaIntegrantes: FilaIntegrante[] };

interface GrupoRow {
  id_grupo: string;
  nombre_proyecto: string;
  estado: EstadoGrupo;
  id_periodo: number | null;
  periodo: string | null;
  id_tutor_academico: string | null;
  tutor_academico_nombre: string | null;
  id_tutor_comunitario: string | null;
  tutor_comunitario_nombre: string | null;
  id_coordinador: string | null;
  coordinador_nombre: string | null;
  proyecto_escrito_url: string | null;
  diapositivas_url: string | null;
  creado_en: string;
  integrantes: number;
  horas_aprobadas: string;
  horas_pendientes: string;
}

const SELECT_GRUPO = `
  select g.id_grupo,
         g.nombre_proyecto,
         g.estado,
         g.id_periodo,
         p.nombre_periodo as periodo,
         g.id_tutor_academico,
         ta.nombre_completo as tutor_academico_nombre,
         g.id_tutor_comunitario,
         tc.nombre_completo as tutor_comunitario_nombre,
         g.id_coordinador,
         c.nombre_completo as coordinador_nombre,
         g.proyecto_escrito_url,
         g.diapositivas_url,
         g.creado_en::text as creado_en,
         (select count(*)::int from integrantes_grupo ig where ig.id_grupo = g.id_grupo) as integrantes,
         -- Las dos tablas, no solo la comunitaria: el programa son 90h de
         -- trabajo directo MAS 30h de impacto. Contando una sola, la pantalla
         -- de Proyectos mostraba como mucho la mitad del avance y quien aprueba
         -- decidia con la mitad de los datos.
         (coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                     where b.id_grupo = g.id_grupo and b.estado = 'aprobado'), 0)
          + coalesce((select sum(c.horas_invertidas)
                      from control_servicios_institucionales c
                      join integrantes_grupo ig2 on ig2.id_estudiante = c.id_estudiante
                      where ig2.id_grupo = g.id_grupo and c.estado = 'aprobado'), 0))::text
           as horas_aprobadas,
         (coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                     where b.id_grupo = g.id_grupo
                       and b.estado in ('pendiente', 'corregir')), 0)
          + coalesce((select sum(c.horas_invertidas)
                      from control_servicios_institucionales c
                      join integrantes_grupo ig2 on ig2.id_estudiante = c.id_estudiante
                      where ig2.id_grupo = g.id_grupo
                        and c.estado in ('pendiente', 'corregir')), 0))::text
           as horas_pendientes
  from grupos_proyectos g
  left join periodos_academicos p on p.id_periodo = g.id_periodo
  left join usuarios ta on ta.id_usuario = g.id_tutor_academico
  left join usuarios tc on tc.id_usuario = g.id_tutor_comunitario
  left join usuarios c on c.id_usuario = g.id_coordinador
`;

function mapGrupo(row: GrupoRow): FilaGrupo {
  return {
    idGrupo: row.id_grupo,
    nombreProyecto: row.nombre_proyecto,
    estado: row.estado,
    periodoId: row.id_periodo,
    periodo: row.periodo,
    tutorAcademicoId: row.id_tutor_academico,
    tutorAcademicoNombre: row.tutor_academico_nombre,
    tutorComunitarioId: row.id_tutor_comunitario,
    tutorComunitarioNombre: row.tutor_comunitario_nombre,
    coordinadorId: row.id_coordinador,
    coordinadorNombre: row.coordinador_nombre,
    proyectoEscritoUrl: row.proyecto_escrito_url,
    diapositivasUrl: row.diapositivas_url,
    integrantes: row.integrantes,
    horasAprobadas: Number(row.horas_aprobadas),
    horasPendientes: Number(row.horas_pendientes),
    creadoEn: row.creado_en,
  };
}

/** Pertenencia en memoria, para el grupo ya cargado. */
export function esTutorDe(grupo: FilaGrupo, idUsuario: string): boolean {
  return grupo.tutorAcademicoId === idUsuario || grupo.tutorComunitarioId === idUsuario;
}

export interface FiltrosGrupos {
  periodoId: number | null;
  estado: EstadoGrupo | null;
  tutorId: string | null;
  busqueda: string | null;
}

/**
 * El `where` se comparte entre el listado y el conteo: si uno cambiara sin el
 * otro, `total` dejaria de describir la pagina y la UI calcularia mal las
 * paginas. Los filtros solo tocan columnas de `grupos_proyectos`, asi que el
 * conteo no necesita los joins del `SELECT_GRUPO`.
 */
const WHERE_GRUPOS = `
     where ($1::int is null or g.id_periodo = $1)
       and ($2::text is null or g.estado = $2)
       and ($3::uuid is null or ${esTutorDelGrupo('g', 3)})
       and ($4::text is null or g.nombre_proyecto ilike '%' || $4 || '%')`;

export async function listarGrupos(
  filtros: FiltrosGrupos,
  paginacion: Paginacion
): Promise<{ items: FilaGrupo[]; total: number }> {
  const parametros = [filtros.periodoId, filtros.estado, filtros.tutorId, filtros.busqueda];
  const [datos, cuenta] = await Promise.all([
    pool.query<GrupoRow>(
      // `id_grupo` desempata `creado_en`: sin un orden total, dos filas con la
      // misma fecha podrian repetirse o desaparecer al cambiar de pagina.
      `${SELECT_GRUPO}${WHERE_GRUPOS}
       order by g.creado_en desc, g.id_grupo asc
       limit $5 offset $6`,
      [...parametros, paginacion.porPagina, paginacion.offset]
    ),
    pool.query<{ total: number }>(
      `select count(*)::int as total from grupos_proyectos g${WHERE_GRUPOS}`,
      parametros
    ),
  ]);
  return { items: datos.rows.map(mapGrupo), total: cuenta.rows[0].total };
}

async function obtenerIntegrantes(idGrupo: string): Promise<FilaIntegrante[]> {
  const { rows } = await pool.query<{
    id_usuario: string;
    nombre_completo: string;
    cedula: string;
    email: string;
    activo: boolean;
    estado_final: EstadoFinal | null;
    horas_directas: string;
    horas_impacto: string;
    horas_aprobadas: string;
    horas_pendientes: string;
  }>(
    `select u.id_usuario,
            u.nombre_completo,
            u.cedula,
            u.email,
            u.activo,
            ig.estado_final,
            coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                       where b.id_grupo = $1 and b.id_estudiante = u.id_usuario
                         and b.estado = 'aprobado'), 0)::text as horas_directas,
            -- El servicio social/ambiental no se registra contra un grupo, asi
            -- que se cuenta por estudiante: es la meta de impacto del programa.
            coalesce((select sum(c.horas_invertidas)
                      from control_servicios_institucionales c
                      where c.id_estudiante = u.id_usuario and c.estado = 'aprobado'), 0)::text
              as horas_impacto,
            (coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                        where b.id_grupo = $1 and b.id_estudiante = u.id_usuario
                          and b.estado = 'aprobado'), 0)
             + coalesce((select sum(c.horas_invertidas)
                         from control_servicios_institucionales c
                         where c.id_estudiante = u.id_usuario and c.estado = 'aprobado'), 0))::text
              as horas_aprobadas,
            (coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                        where b.id_grupo = $1 and b.id_estudiante = u.id_usuario
                          and b.estado in ('pendiente', 'corregir')), 0)
             + coalesce((select sum(c.horas_invertidas)
                         from control_servicios_institucionales c
                         where c.id_estudiante = u.id_usuario
                           and c.estado in ('pendiente', 'corregir')), 0))::text
              as horas_pendientes
     from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_grupo = $1
     order by u.nombre_completo asc`,
    [idGrupo]
  );
  return rows.map((r) => ({
    idUsuario: r.id_usuario,
    nombreCompleto: r.nombre_completo,
    cedula: r.cedula,
    email: r.email,
    activo: r.activo,
    estadoFinal: r.estado_final,
    horasDirectas: Number(r.horas_directas),
    horasImpacto: Number(r.horas_impacto),
    horasAprobadas: Number(r.horas_aprobadas),
    horasPendientes: Number(r.horas_pendientes),
  }));
}

export async function obtenerGrupo(idGrupo: string): Promise<DetalleGrupo | null> {
  const { rows } = await pool.query<GrupoRow>(`${SELECT_GRUPO} where g.id_grupo = $1`, [idGrupo]);
  if (!rows[0]) return null;
  return { ...mapGrupo(rows[0]), listaIntegrantes: await obtenerIntegrantes(idGrupo) };
}

/**
 * Devuelve el grupo solo si el usuario tiene acceso: gestión ve todo,
 * el tutor únicamente sus grupos y el estudiante solo donde es integrante.
 */
export async function obtenerGrupoConAcceso(
  idGrupo: string,
  usuario: { idUsuario: string; rol: UserRole }
): Promise<DetalleGrupo> {
  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }

  if (usuario.rol === 'tutor' && !esTutorDe(grupo, usuario.idUsuario)) {
    throw new ApiError(403, 'Solo puedes consultar los proyectos que tú tutorizas');
  }

  if (usuario.rol === 'estudiante') {
    const esIntegrante = grupo.listaIntegrantes.some((i) => i.idUsuario === usuario.idUsuario);
    if (!esIntegrante) {
      throw new ApiError(403, 'No perteneces a este grupo/proyecto');
    }
  }

  return grupo;
}

/**
 * Quién puede subir los documentos del proyecto (escrito y diapositivas).
 *
 * La gestión (admin y coordinador) puede sobre cualquier grupo; el tutor, solo
 * sobre los suyos. El estudiante no llega aqui: el proyecto es del grupo, y lo
 * que el estudiante aporta son sus evidencias de bitácora.
 */
export async function exigirGestionDeGrupo(
  idGrupo: string,
  usuario: { idUsuario: string; rol: UserRole }
): Promise<DetalleGrupo> {
  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  if (usuario.rol === 'tutor' && !esTutorDe(grupo, usuario.idUsuario)) {
    throw new ApiError(403, 'Solo puedes subir documentos de los proyectos que tú tutorizas');
  }
  return grupo;
}

export interface DatosGrupo {
  nombreProyecto: string;
  periodoId: number | null;
  tutorAcademicoId: string | null;
  tutorComunitarioId: string | null;
  coordinadorId: string | null;
  estado: EstadoGrupo;
  integrantesIds: string[];
}

async function validarUsuarioConRol(
  client: PoolClient,
  id: string | null,
  rol: UserRole,
  campo: string
): Promise<void> {
  if (id === null) return;
  const { rows } = await client.query<{ cuenta: string }>(
    'select count(*)::text as cuenta from usuarios where id_usuario = $1 and rol = $2 and activo',
    [id, rol]
  );
  if (Number(rows[0]?.cuenta ?? 0) === 0) {
    throw new ApiError(400, `El ${campo} seleccionado no existe o no tiene el rol requerido`);
  }
}

/**
 * Un tutor no sirve para cualquiera de los dos puestos: el Academico tiene que
 * ser de tipo academico y el Comunitario de tipo comunitario. Sin esto se
 * podria poner a la misma persona en las dos casillas y el acta quedaria
 * firmada dos veces por quien es uno solo.
 */
async function validarTutor(
  client: PoolClient,
  id: string | null,
  tipo: TipoTutor
): Promise<void> {
  if (id === null) return;
  const { rows } = await client.query<{ cuenta: string }>(
    `select count(*)::text as cuenta from usuarios
     where id_usuario = $1 and rol = 'tutor' and tipo_tutor = $2 and activo`,
    [id, tipo]
  );
  if (Number(rows[0]?.cuenta ?? 0) === 0) {
    throw new ApiError(
      400,
      `El ${ETIQUETA_TIPO_TUTOR[tipo]} seleccionado no existe, está inactivo o no es de ese tipo`
    );
  }
}

/** Ninguna persona puede ocupar los dos puestos de tutor del mismo proyecto. */
function validarTutoresDistintos(datos: DatosGrupo): void {
  if (datos.tutorAcademicoId !== null && datos.tutorAcademicoId === datos.tutorComunitarioId) {
    throw new ApiError(400, 'El tutor académico y el comunitario deben ser personas distintas');
  }
}

async function validarPeriodo(client: PoolClient, periodoId: number | null): Promise<void> {
  if (periodoId === null) return;
  const { rows } = await client.query<{ cuenta: string }>(
    'select count(*)::text as cuenta from periodos_academicos where id_periodo = $1',
    [periodoId]
  );
  if (Number(rows[0]?.cuenta ?? 0) === 0) {
    throw new ApiError(400, 'El período académico seleccionado no existe');
  }
}

async function validarIntegrantes(
  client: PoolClient,
  ids: string[],
  idGrupoExcluir: string | null,
  permitirMiembrosActuales = false
): Promise<void> {
  if (ids.length === 0) return;

  const { rows: noValidos } = await client.query<{ nombre_completo: string; rol: string; activo: boolean }>(
    `select nombre_completo, rol, activo from usuarios
     where id_usuario = any($1::uuid[]) and (rol <> 'estudiante' or not activo)`,
    [ids]
  );
  if (noValidos.length > 0) {
    const detalle = noValidos
      .map((u) => `${u.nombre_completo} (${u.activo ? u.rol : 'inactivo'})`)
      .join(', ');
    throw new ApiError(400, `Solo se pueden asignar estudiantes activos. Revisa: ${detalle}`);
  }

  if (!permitirMiembrosActuales) {
    const { rows: yaEnGrupo } = await client.query<{ nombre_completo: string }>(
      `select u.nombre_completo from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_estudiante = any($1::uuid[]) and ig.id_grupo = $2`,
      [ids, idGrupoExcluir]
    );
    if (yaEnGrupo.length > 0) {
      throw new ApiError(
        409,
        `Ya pertenecen a este proyecto: ${yaEnGrupo.map((u) => u.nombre_completo).join(', ')}`
      );
    }
  }
}

export async function crearGrupo(datos: DatosGrupo): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    validarTutoresDistintos(datos);
    await validarPeriodo(client, datos.periodoId);
    await validarTutor(client, datos.tutorAcademicoId, 'academico');
    await validarTutor(client, datos.tutorComunitarioId, 'comunitario');
    await validarUsuarioConRol(client, datos.coordinadorId, 'coordinador', 'coordinador');
    await validarIntegrantes(client, datos.integrantesIds, null);

    // Los documentos no se tocan aqui: las columnas `*_url` solo las escribe el
    // endpoint de subida. Si esta consulta las incluyera, un simple cambio de
    // nombre dejaria el grupo sin documentos y con archivos huerfanos en disco.
    const { rows } = await client.query<{ id_grupo: string }>(
      `insert into grupos_proyectos
         (nombre_proyecto, id_periodo, id_tutor_academico, id_tutor_comunitario, id_coordinador, estado)
       values ($1, $2, $3, $4, $5, $6)
       returning id_grupo`,
      [
        datos.nombreProyecto,
        datos.periodoId,
        datos.tutorAcademicoId,
        datos.tutorComunitarioId,
        datos.coordinadorId,
        datos.estado,
      ]
    );
    const idGrupo = rows[0].id_grupo;

    if (datos.integrantesIds.length > 0) {
      await client.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         select $1, unnest($2::uuid[]), 'en_curso'`,
        [idGrupo, datos.integrantesIds]
      );
    }

    await client.query('commit');
    return idGrupo;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function actualizarGrupo(idGrupo: string, datos: DatosGrupo): Promise<DetalleGrupo> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: existe } = await client.query<{ cuenta: string }>(
      'select count(*)::text as cuenta from grupos_proyectos where id_grupo = $1',
      [idGrupo]
    );
    if (Number(existe[0]?.cuenta ?? 0) === 0) {
      throw new ApiError(404, 'Grupo/proyecto no encontrado');
    }

    validarTutoresDistintos(datos);
    await validarPeriodo(client, datos.periodoId);
    await validarTutor(client, datos.tutorAcademicoId, 'academico');
    await validarTutor(client, datos.tutorComunitarioId, 'comunitario');
    await validarUsuarioConRol(client, datos.coordinadorId, 'coordinador', 'coordinador');
    await validarIntegrantes(client, datos.integrantesIds, idGrupo, true);

    await client.query(
      `update grupos_proyectos
       set nombre_proyecto = $2,
           id_periodo = $3,
           id_tutor_academico = $4,
           id_tutor_comunitario = $5,
           id_coordinador = $6,
           estado = $7
       where id_grupo = $1`,
      [
        idGrupo,
        datos.nombreProyecto,
        datos.periodoId,
        datos.tutorAcademicoId,
        datos.tutorComunitarioId,
        datos.coordinadorId,
        datos.estado,
      ]
    );

    const idsActuales = new Set(datos.integrantesIds);
    const { rows: actuales } = await client.query<{ id_estudiante: string }>(
      'select id_estudiante from integrantes_grupo where id_grupo = $1',
      [idGrupo]
    );

    const paraQuitar = actuales
      .map((r) => r.id_estudiante)
      .filter((id) => !idsActuales.has(id));
    if (paraQuitar.length > 0) {
      await quitarIntegrantesConCliente(client, idGrupo, paraQuitar);
    }

    const yaPresentes = new Set(actuales.map((r) => r.id_estudiante));
    const paraAgregar = datos.integrantesIds.filter((id) => !yaPresentes.has(id));
    if (paraAgregar.length > 0) {
      await client.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         select $1, unnest($2::uuid[]), 'en_curso'
         on conflict do nothing`,
        [idGrupo, paraAgregar]
      );
    }

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  return grupo;
}

/**
 * Horas que le faltan a un integrante para cumplir el programa.
 *
 * `null` en `estadoFinal` significa que nadie lo ha cerrado todavia.
 */
export interface FaltanteIntegrante {
  idUsuario: string;
  nombreCompleto: string;
  horasDirectas: number;
  horasImpacto: number;
  faltanDirectas: number;
  faltanImpacto: number;
}

export class HorasInsuficientesError extends ApiError {
  faltantes: FaltanteIntegrante[];

  constructor(mensaje: string, faltantes: FaltanteIntegrante[]) {
    super(409, mensaje);
    this.name = 'HorasInsuficientesError';
    this.faltantes = faltantes;
  }
}

/** Quien autoriza el cierre, y con que excusa si fuerza. */
export interface Autorizacion {
  rol: UserRole;
  motivo: string | null;
}

async function metasDelPrograma(
  client: PoolClient
): Promise<{ directas: number; impacto: number }> {
  const { rows } = await client.query<{ horas_directas: string; horas_impacto: string }>(
    'select horas_directas::text, horas_impacto::text from configuracion_sistema limit 1'
  );
  return {
    directas: Number(rows[0]?.horas_directas ?? 90),
    impacto: Number(rows[0]?.horas_impacto ?? 30),
  };
}

/**
 * Integrantes del grupo que todavia no llegan a las metas, con lo que les falta.
 *
 * Suma las DOS tablas, cada una contra su meta: la bitacora comunitaria cuenta
 * para las horas directas y el servicio social/ambiental para las de impacto.
 * Es la misma regla que ya decide `cumpleMetas` en el certificado
 * (`reporte.model.ts`), solo que aqui se aplica ANTES de aprobar, no despues.
 */
async function integrantesIncompletos(
  client: PoolClient,
  idGrupo: string,
  soloEstudiante: string | null = null
): Promise<FaltanteIntegrante[]> {
  const metas = await metasDelPrograma(client);

  const { rows } = await client.query<{
    id_usuario: string;
    nombre_completo: string;
    directas: string;
    impacto: string;
  }>(
    `select u.id_usuario,
            u.nombre_completo,
            coalesce((select sum(b.horas_invertidas) from bitacoras_comunitario b
                       where b.id_grupo = $1 and b.id_estudiante = u.id_usuario
                         and b.estado = 'aprobado'), 0)::text as directas,
            coalesce((select sum(c.horas_invertidas)
                      from control_servicios_institucionales c
                      where c.id_estudiante = u.id_usuario and c.estado = 'aprobado'), 0)::text
              as impacto
     from integrantes_grupo ig
     join usuarios u on u.id_usuario = ig.id_estudiante
     where ig.id_grupo = $1
       and ($2::uuid is null or u.id_usuario = $2)
       -- A quien ya se marco como reprobado no se le exigen las horas: su cierre
       -- ya esta decidido y bloquear por el impediria cerrar el grupo entero.
       and coalesce(ig.estado_final, 'en_curso') <> 'reprobado'
     order by u.nombre_completo asc`,
    [idGrupo, soloEstudiante]
  );

  return rows
    .map((r) => {
      const horasDirectas = Number(r.directas);
      const horasImpacto = Number(r.impacto);
      return {
        idUsuario: r.id_usuario,
        nombreCompleto: r.nombre_completo,
        horasDirectas,
        horasImpacto,
        faltanDirectas: Math.max(0, metas.directas - horasDirectas),
        faltanImpacto: Math.max(0, metas.impacto - horasImpacto),
      };
    })
    .filter((f) => f.faltanDirectas > 0 || f.faltanImpacto > 0);
}

function frasePendiente(f: FaltanteIntegrante): string {
  const partes: string[] = [];
  if (f.faltanDirectas > 0) partes.push(`${f.faltanDirectas}h de trabajo directo`);
  if (f.faltanImpacto > 0) partes.push(`${f.faltanImpacto}h de impacto`);
  return `${f.nombreCompleto} (le faltan ${partes.join(' y ')})`;
}

/**
 * Deja pasar la aprobacion solo si todos cumplen, o si el administrador la
 * fuerza dejando un motivo. El motivo no es decorativo: queda en el historial
 * de acciones, que es donde la coordinacion puede verlo despues.
 */
async function exigirHorasCompletas(
  client: PoolClient,
  idGrupo: string,
  autorizacion: Autorizacion,
  soloEstudiante: string | null,
  queSeAprueba: string
): Promise<FaltanteIntegrante[]> {
  const faltantes = await integrantesIncompletos(client, idGrupo, soloEstudiante);
  if (faltantes.length === 0) return [];

  const puedeForzar = autorizacion.rol === 'admin' && (autorizacion.motivo?.trim() ?? '') !== '';
  if (puedeForzar) return faltantes;

  const detalle = faltantes.map(frasePendiente).join('; ');
  const salida =
    autorizacion.rol === 'admin'
      ? ' Para aprobar igualmente, el administrador debe indicar un motivo.'
      : ' Solo el administrador puede aprobar sin cumplir las metas, indicando un motivo.';

  throw new HorasInsuficientesError(
    `No se puede ${queSeAprueba}: ${detalle}.${salida}`,
    faltantes
  );
}

export async function cambiarEstadoGrupo(
  idGrupo: string,
  estado: EstadoGrupo,
  autorizacion: Autorizacion
): Promise<{ grupo: DetalleGrupo; forzado: FaltanteIntegrante[] }> {
  const client = await pool.connect();
  let forzado: FaltanteIntegrante[] = [];
  try {
    await client.query('begin');

    const { rows: existe } = await client.query<{ estado: EstadoGrupo }>(
      'select estado from grupos_proyectos where id_grupo = $1 for update',
      [idGrupo]
    );
    if (!existe[0]) {
      throw new ApiError(404, 'Grupo/proyecto no encontrado');
    }

    // Solo el cierre exige horas. Suspender o devolver a "en curso" son marcha
    // atras y no deben quedar bloqueados por el mismo motivo.
    if (estado === 'finalizado' && existe[0].estado !== 'finalizado') {
      forzado = await exigirHorasCompletas(
        client,
        idGrupo,
        autorizacion,
        null,
        'dar por finalizado el proyecto'
      );
    }

    await client.query('update grupos_proyectos set estado = $2 where id_grupo = $1', [
      idGrupo,
      estado,
    ]);

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }

  const grupo = await obtenerGrupo(idGrupo);
  if (!grupo) {
    throw new ApiError(404, 'Grupo/proyecto no encontrado');
  }
  return { grupo, forzado };
}

async function quitarIntegrantesConCliente(
  client: PoolClient,
  idGrupo: string,
  idsEstudiante: string[]
): Promise<void> {
  const { rows: conRegistros } = await client.query<{ nombre_completo: string }>(
    `select distinct u.nombre_completo
     from bitacoras_comunitario b
     join usuarios u on u.id_usuario = b.id_estudiante
     where b.id_grupo = $1 and b.id_estudiante = any($2::uuid[])`,
    [idGrupo, idsEstudiante]
  );
  if (conRegistros.length > 0) {
    throw new ApiError(
      409,
      `No se pueden quitar del grupo a estudiantes con horas ya registradas: ${conRegistros
        .map((r) => r.nombre_completo)
        .join(', ')}`
    );
  }

  await client.query('delete from integrantes_grupo where id_grupo = $1 and id_estudiante = any($2::uuid[])', [
    idGrupo,
    idsEstudiante,
  ]);
}

export async function agregarIntegrantes(
  idGrupo: string,
  idsEstudiante: string[]
): Promise<{ agregados: number }> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const { rows: grupoRows } = await client.query<{ id_periodo: number | null }>(
      'select id_periodo from grupos_proyectos where id_grupo = $1',
      [idGrupo]
    );
    if (!grupoRows[0]) {
      throw new ApiError(404, 'Grupo/proyecto no encontrado');
    }

    await validarIntegrantes(client, idsEstudiante, idGrupo);

    const { rows } = await client.query<{ id_estudiante: string }>(
      `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
       select $1, unnest($2::uuid[]), 'en_curso'
       on conflict do nothing
       returning id_estudiante`,
      [idGrupo, idsEstudiante]
    );

    await client.query('commit');
    return { agregados: rows.length };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function quitarIntegrante(idGrupo: string, idEstudiante: string): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await quitarIntegrantesConCliente(client, idGrupo, [idEstudiante]);
    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}

export async function cambiarEstadoFinalIntegrante(
  idGrupo: string,
  idEstudiante: string,
  estadoFinal: EstadoFinal,
  autorizacion: Autorizacion
): Promise<{ forzado: FaltanteIntegrante[] }> {
  const client = await pool.connect();
  let forzado: FaltanteIntegrante[] = [];
  try {
    await client.query('begin');

    const { rows } = await client.query<{ id_estudiante: string }>(
      'select id_estudiante from integrantes_grupo where id_grupo = $1 and id_estudiante = $2 for update',
      [idGrupo, idEstudiante]
    );
    if (!rows[0]) {
      throw new ApiError(404, 'El estudiante no pertenece a este grupo/proyecto');
    }

    // Marcar 'aprobado' es acreditar el servicio comunitario de esa persona: es
    // justo lo que no debe poder hacerse sin las horas. 'reprobado' y
    // 'en_curso' no acreditan nada, asi que no se bloquean.
    if (estadoFinal === 'aprobado') {
      forzado = await exigirHorasCompletas(
        client,
        idGrupo,
        autorizacion,
        idEstudiante,
        'aprobar a este estudiante'
      );
    }

    await client.query(
      `update integrantes_grupo
       set estado_final = $3
       where id_grupo = $1 and id_estudiante = $2`,
      [idGrupo, idEstudiante, estadoFinal]
    );

    await client.query('commit');
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
  return { forzado };
}
