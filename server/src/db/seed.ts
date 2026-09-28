import bcrypt from 'bcryptjs';
import { pool } from './pool.js';
import type { UserRole } from '../types.js';

interface SeedUsuario {
  email: string;
  nombre: string;
  cedula: string;
  password: string;
  rol: UserRole;
}

const usuariosSeed: SeedUsuario[] = [
  { email: 'cmendoza@iunav.edu.ve', nombre: 'Carlos Mendoza', cedula: 'V-28.456.123', password: 'admin123', rol: 'admin' },
  { email: 'mlopez@iunav.edu.ve', nombre: 'María Fernanda López', cedula: 'V-18.234.567', password: 'coord123', rol: 'coordinador' },
  { email: 'jperez@iunav.edu.ve', nombre: 'José Rafael Pérez', cedula: 'V-22.890.345', password: 'tutor123', rol: 'tutor' },
  { email: 'ltorres@iunav.edu.ve', nombre: 'Luis Miguel Torres', cedula: 'V-20.123.456', password: 'tutor123', rol: 'tutor' },
  { email: 'gmartinez@iunav.edu.ve', nombre: 'Gabriela Martínez', cedula: 'V-26.567.890', password: 'est123', rol: 'estudiante' },
  { email: 'dhernandez@iunav.edu.ve', nombre: 'Diego Hernández', cedula: 'V-24.345.678', password: 'est123', rol: 'estudiante' },
  { email: 'vgarcia@iunav.edu.ve', nombre: 'Valentina García', cedula: 'V-27.890.123', password: 'est123', rol: 'estudiante' },
  { email: 'ssanchez@iunav.edu.ve', nombre: 'Santiago Sánchez', cedula: 'V-19.456.789', password: 'est123', rol: 'estudiante' },
];

interface SeedProyecto {
  nombre: string;
  tutorEmail: string;
  estado: 'en_curso' | 'pendiente_aprobacion' | 'finalizado' | 'suspendido';
  proyectoEscrito: boolean;
  diapositivas: boolean;
  integrantes: string[];
}

const proyectosSeed: SeedProyecto[] = [
  {
    nombre: 'Mantenimiento de Red Comunitaria - Escuela Bolivariana La Esperanza',
    tutorEmail: 'jperez@iunav.edu.ve',
    estado: 'en_curso',
    proyectoEscrito: true,
    diapositivas: false,
    integrantes: ['gmartinez@iunav.edu.ve', 'dhernandez@iunav.edu.ve', 'vgarcia@iunav.edu.ve', 'ssanchez@iunav.edu.ve'],
  },
  {
    nombre: 'Desarrollo Web para la Fundación Niños del Mañana',
    tutorEmail: 'ltorres@iunav.edu.ve',
    estado: 'en_curso',
    proyectoEscrito: true,
    diapositivas: false,
    integrantes: ['gmartinez@iunav.edu.ve', 'dhernandez@iunav.edu.ve'],
  },
  {
    nombre: 'Sistema de Inventario para la Casa de Alimentación Municipal',
    tutorEmail: 'ltorres@iunav.edu.ve',
    estado: 'pendiente_aprobacion',
    proyectoEscrito: true,
    diapositivas: true,
    integrantes: ['vgarcia@iunav.edu.ve'],
  },
  {
    nombre: 'Soporte Técnico y Capacitación Digital - Centro de Formación Popular',
    tutorEmail: 'jperez@iunav.edu.ve',
    estado: 'finalizado',
    proyectoEscrito: true,
    diapositivas: true,
    integrantes: ['ssanchez@iunav.edu.ve'],
  },
];

interface SeedBitacora {
  estudianteEmail: string;
  grupoEmail?: string;
  semana: number;
  fecha: string;
  descripcion: string;
  horas: number;
  evidencia: boolean;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'corregir';
  comentario?: string;
}

const bitacorasSeed: SeedBitacora[] = [
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 1, fecha: '2026-02-10', descripcion: 'Configuración de switches y routers en la escuela. Cableado estructurado del aula de informática.', horas: 8, evidencia: true, estado: 'aprobado', comentario: 'Excelente trabajo. Buen dominio de las configuraciones.' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 2, fecha: '2026-02-17', descripcion: 'Instalación de puntos de red y configuración de VLAN para la red de la escuela.', horas: 8, evidencia: true, estado: 'aprobado', comentario: 'Muy bien organizado el esquema de VLANs.' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 3, fecha: '2026-02-24', descripcion: 'Mantenimiento preventivo de equipos de computación. Limpieza y actualización de software.', horas: 7, evidencia: true, estado: 'aprobado', comentario: 'Correcto procedimiento de mantenimiento.' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 4, fecha: '2026-03-03', descripcion: 'Diagnóstico de fallas en la red WiFi del plantel. Reemplazo de access points dañados.', horas: 8, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 5, fecha: '2026-03-10', descripcion: 'Instalación de servidor proxy y filtro de contenido para la red escolar.', horas: 8, evidencia: true, estado: 'aprobado', comentario: 'Buena implementación de seguridad.' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 6, fecha: '2026-03-17', descripcion: 'Capacitación a docentes sobre uso de herramientas digitales y plataforma Moodle.', horas: 6, evidencia: true, estado: 'aprobado', comentario: 'Muy buena disposición con los docentes.' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', semana: 11, fecha: '2026-04-21', descripcion: 'Configuración de firewall y políticas de seguridad perimetral.', horas: 5, evidencia: false, estado: 'pendiente' },
  { estudianteEmail: 'dhernandez@iunav.edu.ve', semana: 1, fecha: '2026-02-10', descripcion: 'Relevamiento de requerimientos para el sistema web de la fundación.', horas: 8, evidencia: true, estado: 'aprobado', comentario: 'Buen análisis de requisitos.' },
  { estudianteEmail: 'dhernandez@iunav.edu.ve', semana: 5, fecha: '2026-03-10', descripcion: 'Integración de pasarela de donaciones y módulo de reportes.', horas: 7, evidencia: true, estado: 'rechazado', comentario: 'Falta documentar la integración con la pasarela. Revisar seguridad.' },
  { estudianteEmail: 'dhernandez@iunav.edu.ve', semana: 6, fecha: '2026-03-17', descripcion: 'Corrección de vulnerabilidades XSS y CSRF en el sistema web.', horas: 8, evidencia: true, estado: 'corregir', comentario: 'Aún quedan puntos por corregir en la validación de inputs.' },
  { estudianteEmail: 'vgarcia@iunav.edu.ve', semana: 1, fecha: '2026-02-10', descripcion: 'Instalación de sensores de temperatura y humedad en áreas verdes.', horas: 8, evidencia: true, estado: 'aprobado', comentario: 'Buena selección de sensores.' },
  { estudianteEmail: 'vgarcia@iunav.edu.ve', semana: 3, fecha: '2026-02-24', descripcion: 'Desarrollo de dashboard para visualización de datos ambientales en tiempo real.', horas: 8, evidencia: true, estado: 'aprobado', comentario: 'Excelente visualización.' },
];

interface SeedServicio {
  estudianteEmail: string;
  tipo: 'social' | 'ambiental';
  fecha: string;
  descripcion: string;
  horas: number;
  evidencia: boolean;
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'corregir';
  comentario?: string;
}

const serviciosSeed: SeedServicio[] = [
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'social', fecha: '2026-02-12', descripcion: 'Taller de alfabetización digital para adultos mayores de la comunidad.', horas: 6, evidencia: true, estado: 'aprobado', comentario: 'Muy buena dinámica con los adultos mayores.' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'social', fecha: '2026-02-19', descripcion: 'Asistencia técnica en el comedor comunitario. Reparación de equipos.', horas: 4, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'social', fecha: '2026-02-26', descripcion: 'Capacitación en ofimática para personal administrativo del CDI.', horas: 6, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'social', fecha: '2026-03-05', descripcion: 'Apoyo en registro de datos del programa de alimentación escolar.', horas: 4, evidencia: true, estado: 'pendiente' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'ambiental', fecha: '2026-02-14', descripcion: 'Jornada de recolección de residuos electrónicos en la comunidad.', horas: 6, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'ambiental', fecha: '2026-02-21', descripcion: 'Taller de reciclaje y disposición adecuada de equipos obsoletos.', horas: 4, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'gmartinez@iunav.edu.ve', tipo: 'ambiental', fecha: '2026-02-28', descripcion: 'Siembra de árboles nativos en áreas verdes de la escuela.', horas: 6, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'dhernandez@iunav.edu.ve', tipo: 'social', fecha: '2026-02-26', descripcion: 'Diseño de afiches digitales para campaña de vacunación.', horas: 4, evidencia: true, estado: 'rechazado', comentario: 'No se evidencia la actividad descrita en las fotos.' },
  { estudianteEmail: 'vgarcia@iunav.edu.ve', tipo: 'ambiental', fecha: '2026-02-14', descripcion: 'Monitoreo de calidad del aire con sensores Arduino.', horas: 6, evidencia: true, estado: 'aprobado' },
  { estudianteEmail: 'vgarcia@iunav.edu.ve', tipo: 'ambiental', fecha: '2026-02-21', descripcion: 'Jornada de limpieza del río Guaire sector El Recreo.', horas: 8, evidencia: true, estado: 'pendiente' },
];

async function seedPeriodo(): Promise<number> {
  const { rows } = await pool.query<{ id_periodo: number }>(
    `select id_periodo from periodos_academicos where nombre_periodo = '2026-I' limit 1`
  );
  if (rows[0]) {
    return rows[0].id_periodo;
  }
  const creado = await pool.query<{ id_periodo: number }>(
    `insert into periodos_academicos (nombre_periodo, fecha_inicio, fecha_fin, activo)
     values ('2026-I', '2026-02-10', '2026-07-15', true)
     returning id_periodo`
  );
  return creado.rows[0].id_periodo;
}

async function seedUsuarios(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const u of usuariosSeed) {
    const { rows } = await pool.query<{ email: string; id_usuario: string }>(
      'select email, id_usuario from usuarios where email = $1',
      [u.email]
    );
    if (rows.length === 0) {
      const hash = await bcrypt.hash(u.password, 10);
      const creado = await pool.query<{ id_usuario: string }>(
        `insert into usuarios (nombre_completo, cedula, email, password_hash, rol)
         values ($1, $2, $3, $4, $5)
         returning id_usuario`,
        [u.nombre, u.cedula, u.email, hash, u.rol]
      );
      ids.set(u.email, creado.rows[0].id_usuario);
      console.log(`  + creado ${u.email} (${u.rol})`);
    } else {
      ids.set(u.email, rows[0].id_usuario);
      console.log(`  = ya existe ${u.email}`);
    }
  }
  return ids;
}

async function seedConfiguracion(idPeriodo: number): Promise<void> {
  const { rows } = await pool.query<{ id_config: number }>('select id_config from configuracion_sistema limit 1');
  if (rows.length === 0) {
    await pool.query(
      `insert into configuracion_sistema (horas_directas, horas_impacto, limite_horas_diarias, periodo_activo)
       values (90, 30, 8, $1)`,
      [idPeriodo]
    );
    console.log('  + configuracion_sistema creada (90h directas + 30h impacto)');
  } else {
    console.log('  = configuracion_sistema ya existe');
  }
}

async function seedProyectos(
  idPeriodo: number,
  ids: Map<string, string>,
  coordinadorId: string
): Promise<void> {
  const { rows } = await pool.query<{ count: string }>('select count(*)::text as count from grupos_proyectos');
  if (Number(rows[0]?.count ?? 0) > 0) {
    console.log('  = grupos_proyectos: ya existen datos');
    return;
  }

  const gruposPorNombre = new Map<string, string>();
  for (const p of proyectosSeed) {
    const tutorId = ids.get(p.tutorEmail);
    if (!tutorId) continue;
    const creado = await pool.query<{ id_grupo: string }>(
      `insert into grupos_proyectos (nombre_proyecto, id_periodo, id_tutor, id_coordinador, proyecto_escrito_url, diapositivas_url, estado)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id_grupo`,
      [
        p.nombre,
        idPeriodo,
        tutorId,
        coordinadorId,
        p.proyectoEscrito ? 'https://iunav.edu.ve/proyectos/escrito.pdf' : null,
        p.diapositivas ? 'https://iunav.edu.ve/proyectos/diapositivas.pdf' : null,
        p.estado,
      ]
    );
    gruposPorNombre.set(p.nombre, creado.rows[0].id_grupo);

    for (const email of p.integrantes) {
      const estudianteId = ids.get(email);
      if (!estudianteId) continue;
      await pool.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         values ($1, $2, 'en_curso')`,
        [creado.rows[0].id_grupo, estudianteId]
      );
    }
    console.log(`  + grupo ${p.nombre} (${p.estado})`);
  }

  const primerGrupo = [...gruposPorNombre.values()][0];

  for (const b of bitacorasSeed) {
    const idEstudiante = ids.get(b.estudianteEmail);
    if (!idEstudiante) continue;
    const idGrupo = b.grupoEmail
      ? gruposPorNombre.get(b.grupoEmail)
      : primerGrupo;
    await pool.query(
      `insert into bitacoras_comunitario
         (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, evidencia_foto_url, estado, comentario_tutor)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        idEstudiante,
        idGrupo,
        b.semana,
        b.fecha,
        b.descripcion,
        b.horas,
        b.evidencia ? 'https://iunav.edu.ve/evidencias/foto-' + b.estudianteEmail.split('@')[0] + '-' + b.semana + '.jpg' : null,
        b.estado,
        b.comentario ?? null,
      ]
    );
  }

  for (const s of serviciosSeed) {
    const idEstudiante = ids.get(s.estudianteEmail);
    if (!idEstudiante) continue;
    await pool.query(
      `insert into control_servicios_institucionales
         (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, evidencia_foto_url, estado, comentario_tutor)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        idEstudiante,
        s.tipo,
        s.fecha,
        s.descripcion,
        s.horas,
        s.evidencia ? 'https://iunav.edu.ve/evidencias/' + s.tipo + '-' + s.estudianteEmail.split('@')[0] + '.jpg' : null,
        s.estado,
        s.comentario ?? null,
      ]
    );
  }
  console.log(`  + ${bitacorasSeed.length} bitácoras comunitarias y ${serviciosSeed.length} servicios sociales/ambientales`);
}

async function main(): Promise<void> {
  console.log('Ejecutando seed de la base de datos...');
  try {
    const idPeriodo = await seedPeriodo();
    console.log(`Periodo académico 2026-I listo (id=${idPeriodo})`);
    const ids = await seedUsuarios();
    await seedConfiguracion(idPeriodo);

    const coordinadorId = ids.get('mlopez@iunav.edu.ve');
    if (!coordinadorId) {
      throw new Error('No se encontró al coordinador en el seed');
    }
    await seedProyectos(idPeriodo, ids, coordinadorId);
    console.log('Seed completado.');
  } finally {
    await pool.end();
  }
}

void main().catch((err: unknown) => {
  console.error('Error en el seed:', err);
  process.exit(1);
});