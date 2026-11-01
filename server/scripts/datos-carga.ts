/**
 * Genera un conjunto de datos realista para medir el rendimiento.
 *
 * El escenario que pidió la revisión es **60 estudiantes y 20 tutores**
 * trabajando a la vez, con cabida para 1000. El seed de demostración tiene 8
 * usuarios: con esos números no se mide nada, porque cualquier consulta sobre
 * 8 filas es instantánea aunque esté mal escrita.
 *
 *   npm run db:carga                        60 estudiantes, 20 tutores
 *   npm run db:carga -- --estudiantes=1000  el tope del enunciado
 *
 * SIEMPRE escribe en una base aparte, nunca en la de desarrollo: reutiliza la
 * misma guardia de nombre que `reset-test-db.ts` y aborta si el nombre no
 * termina en el sufijo esperado.
 */
import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { Client, Pool } from 'pg';
import { PASSWORD_CARGA, urlDeCarga } from './carga-comun.js';

function argumento(nombre: string, porDefecto: number): number {
  const crudo = process.argv.find((a) => a.startsWith(`--${nombre}=`));
  if (!crudo) return porDefecto;
  const valor = Number(crudo.split('=')[1]);
  if (!Number.isInteger(valor) || valor < 1) {
    throw new Error(`--${nombre} debe ser un entero positivo`);
  }
  return valor;
}

const estudiantes = argumento('estudiantes', 60);
const tutores = argumento('tutores', 20);
const grupos = argumento('grupos', Math.max(1, Math.ceil(estudiantes / 4)));
const semanas = argumento('semanas', 12);

async function recrearBase(nombre: string): Promise<void> {
  const url = new URL(process.env.DATABASE_URL as string);
  if (url.pathname.slice(1) === nombre) {
    throw new Error('DATABASE_URL ya apunta a la base de carga: aborto por seguridad');
  }
  url.pathname = '/postgres';
  url.search = '';

  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    const { rows } = await admin.query<{ n: number }>(
      'select count(*)::int as n from pg_database where datname = $1',
      [nombre]
    );
    if (rows[0].n > 0) {
      // Una sola sesion abierta (una API levantada contra esta base, una
      // consola olvidada) hace fallar el `drop`. Se cierran primero: la base de
      // carga es desechable por definicion, nadie tiene nada que perder ahi.
      await admin.query(
        `select pg_terminate_backend(pid) from pg_stat_activity
         where datname = $1 and pid <> pg_backend_pid()`,
        [nombre]
      );
      await admin.query(`drop database "${nombre}"`);
      console.log(`Base descartada: ${nombre}`);
    }
    await admin.query(`create database "${nombre}"`);
    console.log(`Base creada: ${nombre}`);
  } finally {
    await admin.end();
  }
}

function cedula(n: number): string {
  return `V-${String(10_000_000 + n).replace(/(\d{2})(\d{3})(\d{3})/, '$1.$2.$3')}`;
}

/** Fecha de la semana `s` del periodo, desplazada `dia` dias. */
function fechaDeSemana(inicio: Date, s: number, dia: number): string {
  const d = new Date(inicio);
  d.setUTCDate(d.getUTCDate() + (s - 1) * 7 + dia);
  return d.toISOString().slice(0, 10);
}

async function main(): Promise<void> {
  const { url, nombre } = urlDeCarga();
  await recrearBase(nombre);

  const pool = new Pool({ connectionString: url.toString(), ssl: false });
  const comenzo = Date.now();

  try {
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    await pool.query(await readFile(path.join(raiz, 'sql', 'schema.sql'), 'utf8'));
    console.log('Esquema aplicado.');

    // 4 rondas en vez de 10: son cuentas desechables y con 1000 usuarios la
    // diferencia es de minutos.
    const hash = await bcrypt.hash(PASSWORD_CARGA, 4);

    const inicioPeriodo = new Date(Date.UTC(2026, 0, 12));
    const finPeriodo = new Date(inicioPeriodo);
    finPeriodo.setUTCDate(finPeriodo.getUTCDate() + semanas * 7 + 30);

    const { rows: per } = await pool.query<{ id_periodo: number }>(
      `insert into periodos_academicos (nombre_periodo, fecha_inicio, fecha_fin, activo)
       values ('Carga-2026', $1, $2, true) returning id_periodo`,
      [inicioPeriodo.toISOString().slice(0, 10), finPeriodo.toISOString().slice(0, 10)]
    );
    const periodo = per[0].id_periodo;

    await pool.query(
      `insert into configuracion_sistema (horas_directas, horas_impacto, limite_horas_diarias, periodo_activo)
       values (90, 30, 8, $1)`,
      [periodo]
    );

    // --- usuarios -------------------------------------------------------
    // `unnest` en una sola sentencia: con 1000 estudiantes, mil `insert`
    // sueltos tardan minutos y aqui son segundos.
    async function crearLote(
      prefijo: string,
      cantidad: number,
      rol: string,
      desplazamiento: number,
      tipoTutor: string | null = null
    ): Promise<string[]> {
      const nombres: string[] = [];
      const cedulas: string[] = [];
      const correos: string[] = [];
      for (let i = 1; i <= cantidad; i += 1) {
        nombres.push(`${prefijo} ${i}`);
        cedulas.push(cedula(desplazamiento + i));
        correos.push(`${prefijo.toLowerCase().replace(/ /g, '')}${i}@carga.local`);
      }
      const { rows } = await pool.query<{ id_usuario: string }>(
        `insert into usuarios (nombre_completo, cedula, email, password_hash, rol, tipo_tutor)
         select n, c, e, $4, $5, $6
         from unnest($1::text[], $2::text[], $3::text[]) as t(n, c, e)
         returning id_usuario`,
        [nombres, cedulas, correos, hash, rol, tipoTutor]
      );
      return rows.map((r) => r.id_usuario);
    }

    const [admin] = await crearLote('Admin Carga', 1, 'admin', 0);
    const [coordinador] = await crearLote('Coord Carga', 1, 'coordinador', 1000);
    const academicos = await crearLote('TutorAcad', Math.ceil(tutores / 2), 'tutor', 2000, 'academico');
    const comunitarios = await crearLote(
      'TutorComun',
      Math.floor(tutores / 2) || 1,
      'tutor',
      3000,
      'comunitario'
    );
    const alumnos = await crearLote('Estudiante', estudiantes, 'estudiante', 100_000);
    console.log(`Usuarios: 1 admin, 1 coordinador, ${tutores} tutores, ${estudiantes} estudiantes.`);

    // --- grupos ---------------------------------------------------------
    const idsGrupo: string[] = [];
    for (let i = 0; i < grupos; i += 1) {
      const { rows } = await pool.query<{ id_grupo: string }>(
        `insert into grupos_proyectos
           (nombre_proyecto, id_periodo, id_tutor_academico, id_tutor_comunitario, id_coordinador, estado)
         values ($1, $2, $3, $4, $5, 'en_curso')
         returning id_grupo`,
        [
          `Proyecto de carga ${i + 1}`,
          periodo,
          academicos[i % academicos.length],
          comunitarios[i % comunitarios.length],
          coordinador,
        ]
      );
      idsGrupo.push(rows[0].id_grupo);
    }

    const grupoDe = new Map<string, string>();
    for (const [i, idEstudiante] of alumnos.entries()) {
      const idGrupo = idsGrupo[i % idsGrupo.length];
      grupoDe.set(idEstudiante, idGrupo);
      await pool.query(
        `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
         values ($1, $2, 'en_curso')`,
        [idGrupo, idEstudiante]
      );
    }
    console.log(`Grupos: ${grupos}, con ${estudiantes} integrantes repartidos.`);

    // --- registros de horas ---------------------------------------------
    // Una bitacora por estudiante y semana, mas un servicio institucional cada
    // tres semanas. Dos tercios aprobados y el resto pendiente: asi la bandeja
    // del tutor y el consolidado tienen trabajo de verdad que hacer.
    const estados = ['aprobado', 'aprobado', 'pendiente'];
    let bitacoras = 0;
    let servicios = 0;

    for (let s = 1; s <= semanas; s += 1) {
      const ids: string[] = [];
      const gruposFila: string[] = [];
      const fechas: string[] = [];
      const horas: number[] = [];
      const estadosFila: string[] = [];

      for (const [i, idEstudiante] of alumnos.entries()) {
        ids.push(idEstudiante);
        gruposFila.push(grupoDe.get(idEstudiante) as string);
        fechas.push(fechaDeSemana(inicioPeriodo, s, i % 5));
        horas.push(4 + (i % 3));
        estadosFila.push(estados[(i + s) % estados.length]);
      }

      await pool.query(
        `insert into bitacoras_comunitario
           (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
         select e, g, $6::int, f::date, 'Jornada de la semana ' || $6::text, h, st
         from unnest($1::uuid[], $2::uuid[], $3::text[], $4::numeric[], $5::text[]) as t(e, g, f, h, st)`,
        [ids, gruposFila, fechas, horas, estadosFila, s]
      );
      bitacoras += ids.length;

      if (s % 3 === 0) {
        await pool.query(
          `insert into control_servicios_institucionales
             (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, estado)
           select e, case when random() < 0.5 then 'social' else 'ambiental' end,
                  f::date, 'Servicio institucional de la semana ' || $4::text, 3, st
           from unnest($1::uuid[], $2::text[], $3::text[]) as t(e, f, st)`,
          [ids, fechas, estadosFila, s]
        );
        servicios += ids.length;
      }
    }

    console.log(`Registros: ${bitacoras} bitácoras y ${servicios} servicios institucionales.`);
    console.log(`\nListo en ${((Date.now() - comenzo) / 1000).toFixed(1)} s.`);
    console.log(`Base: ${nombre}`);
    console.log(`Cuentas: <prefijo><n>@carga.local / ${PASSWORD_CARGA}`);
    console.log('\nPara medir:  npm run test:carga');
  } finally {
    await pool.end();
  }
}

await main();
