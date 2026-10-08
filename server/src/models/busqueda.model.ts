import { pool } from '../db/pool.js';
import type { UserRole } from '../types.js';

export interface ResultadoUsuario {
  idUsuario: string;
  nombre: string;
  email: string;
  rol: UserRole;
}

export interface ResultadoProyecto {
  idGrupo: string;
  nombre: string;
  estado: string;
  tutorNombre: string | null;
  periodo: string | null;
}

export interface ResultadoBitacora {
  id: string;
  tipo: 'comunitario' | 'social' | 'ambiental';
  descripcion: string;
  estado: string;
  fecha: string;
  estudianteNombre: string;
}

export interface ResultadosBusqueda {
  usuarios: ResultadoUsuario[];
  proyectos: ResultadoProyecto[];
  bitacoras: ResultadoBitacora[];
}

/** Estudiantes asignados a los grupos de un tutor ($1 = id del tutor). */
const ESTUDIANTES_DEL_TUTOR = `
  id_usuario in (
    select ig.id_estudiante
    from integrantes_grupo ig
    join grupos_proyectos g on g.id_grupo = ig.id_grupo
    where g.id_tutor = $1
  )
`;

async function buscarUsuarios(
  rol: UserRole,
  idUsuario: string,
  patron: string,
  limite: number
): Promise<ResultadoUsuario[]> {
  if (rol === 'estudiante') return [];

  if (rol === 'tutor') {
    const { rows } = await pool.query<ResultadoUsuario>(
      `select id_usuario as "idUsuario", nombre_completo as nombre, email, rol
         from usuarios
        where activo = true
          and rol = 'estudiante'
          and ${ESTUDIANTES_DEL_TUTOR}
          and (nombre_completo ilike $2 or email ilike $2 or cedula ilike $2)
        order by nombre_completo
        limit $3`,
      [idUsuario, patron, limite]
    );
    return rows;
  }

  const { rows } = await pool.query<ResultadoUsuario>(
    `select id_usuario as "idUsuario", nombre_completo as nombre, email, rol
       from usuarios
      where activo = true
        and (nombre_completo ilike $1 or email ilike $1 or cedula ilike $1)
      order by nombre_completo
      limit $2`,
    [patron, limite]
  );
  return rows;
}

async function buscarProyectos(
  rol: UserRole,
  idUsuario: string,
  patron: string,
  limite: number
): Promise<ResultadoProyecto[]> {
  if (rol === 'estudiante') return [];

  if (rol === 'tutor') {
    const { rows } = await pool.query<ResultadoProyecto>(
      `select g.id_grupo as "idGrupo", g.nombre_proyecto as nombre, g.estado,
              u.nombre_completo as "tutorNombre", p.nombre_periodo as periodo
         from grupos_proyectos g
         left join usuarios u on u.id_usuario = g.id_tutor
         left join periodos_academicos p on p.id_periodo = g.id_periodo
        where (g.nombre_proyecto ilike $2 or u.nombre_completo ilike $2 or p.nombre_periodo ilike $2)
          and g.id_tutor = $1
        order by g.creado_en desc
        limit $3`,
      [idUsuario, patron, limite]
    );
    return rows;
  }

  const { rows } = await pool.query<ResultadoProyecto>(
    `select g.id_grupo as "idGrupo", g.nombre_proyecto as nombre, g.estado,
            u.nombre_completo as "tutorNombre", p.nombre_periodo as periodo
       from grupos_proyectos g
       left join usuarios u on u.id_usuario = g.id_tutor
       left join periodos_academicos p on p.id_periodo = g.id_periodo
      where (g.nombre_proyecto ilike $1 or u.nombre_completo ilike $1 or p.nombre_periodo ilike $1)
      order by g.creado_en desc
      limit $2`,
    [patron, limite]
  );
  return rows;
}

async function buscarBitacoras(
  rol: UserRole,
  idUsuario: string,
  patron: string,
  limite: number
): Promise<ResultadoBitacora[]> {
  if (rol === 'estudiante') {
    const { rows } = await pool.query<ResultadoBitacora>(
      `select * from (
         select b.id_bitacora as id, 'comunitario'::text as tipo, b.descripcion,
                b.estado, b.fecha_actividad::text as fecha,
                u.nombre_completo as "estudianteNombre"
           from bitacoras_comunitario b
           join usuarios u on u.id_usuario = b.id_estudiante
          where (b.descripcion ilike $2 or u.nombre_completo ilike $2)
            and b.id_estudiante = $1
         union all
         select c.id_registro as id, c.tipo::text as tipo, c.descripcion,
                c.estado, c.fecha_actividad::text as fecha,
                u.nombre_completo as "estudianteNombre"
           from control_servicios_institucionales c
           join usuarios u on u.id_usuario = c.id_estudiante
          where (c.descripcion ilike $2 or u.nombre_completo ilike $2)
            and c.id_estudiante = $1
       ) x
       order by fecha desc
       limit $3`,
      [idUsuario, patron, limite]
    );
    return rows;
  }

  const whereIdEstudiante =
    rol === 'tutor'
      ? `and b.id_estudiante in (
           select ig.id_estudiante
           from integrantes_grupo ig
           join grupos_proyectos g on g.id_grupo = ig.id_grupo
           where g.id_tutor = $1
         )`
      : '';
  const whereIdEstudianteServicio =
    rol === 'tutor'
      ? `and c.id_estudiante in (
           select ig.id_estudiante
           from integrantes_grupo ig
           join grupos_proyectos g on g.id_grupo = ig.id_grupo
           where g.id_tutor = $1
         )`
      : '';
  const params = rol === 'tutor' ? [idUsuario, patron, limite] : [patron, limite];
  const desplazamiento = rol === 'tutor' ? 1 : 0;
  const pPatron = `$${1 + desplazamiento}`;
  const pLimite = `$${2 + desplazamiento}`;

  const { rows } = await pool.query<ResultadoBitacora>(
    `select * from (
       select b.id_bitacora as id, 'comunitario'::text as tipo, b.descripcion,
              b.estado, b.fecha_actividad::text as fecha,
              u.nombre_completo as "estudianteNombre"
         from bitacoras_comunitario b
         join usuarios u on u.id_usuario = b.id_estudiante
        where (b.descripcion ilike ${pPatron} or u.nombre_completo ilike ${pPatron})
          ${whereIdEstudiante}
       union all
       select c.id_registro as id, c.tipo::text as tipo, c.descripcion,
              c.estado, c.fecha_actividad::text as fecha,
              u.nombre_completo as "estudianteNombre"
         from control_servicios_institucionales c
         join usuarios u on u.id_usuario = c.id_estudiante
        where (c.descripcion ilike ${pPatron} or u.nombre_completo ilike ${pPatron})
          ${whereIdEstudianteServicio}
     ) x
     order by fecha desc
     limit ${pLimite}`,
    params
  );
  return rows;
}

/**
 * Busqueda global del header.
 *
 * El alcance lo decide el rol: administracion y coordinacion buscan en todo,
 * el tutor entre sus grupos y estudiantes, y el estudiante solo en sus propios
 * registros. El servidor nunca devuelve datos que la matriz de permisos le
 * negaria al rol.
 */
export async function buscar(
  rol: UserRole,
  idUsuario: string,
  q: string,
  limite: number
): Promise<ResultadosBusqueda> {
  const patron = `%${q}%`;
  const [usuarios, proyectos, bitacoras] = await Promise.all([
    buscarUsuarios(rol, idUsuario, patron, limite),
    buscarProyectos(rol, idUsuario, patron, limite),
    buscarBitacoras(rol, idUsuario, patron, limite),
  ]);
  return { usuarios, proyectos, bitacoras };
}
