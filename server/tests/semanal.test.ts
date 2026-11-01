import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, tokenDe, tokenDeCorreo } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';
import { pool } from '../src/db/pool.js';
import { obtenerDetalleSemanal } from '../src/models/reporte.model.js';

/**
 * Reporte semanal de actividades.
 *
 * Dos cosas que vigilar:
 *
 *  1. **El calculo de la semana.** Se deriva del inicio del periodo academico y
 *     no del calendario, porque `control_servicios_institucionales` no tiene
 *     columna de semana. Si la aritmetica se desplaza un dia, todas las
 *     actividades caen en la semana equivocada.
 *  2. **El alcance.** Es el primer reporte que baja el estudiante, asi que un
 *     fallo aqui no es un numero mal puesto: es ver las actividades de otro.
 */

// El periodo de prueba empieza el 2026-01-15 (ver `sembrar`).
const INICIO_PERIODO = '2026-01-15';

let datos: DatosSemilla;

/** Inserta una bitacora comunitaria en una fecha concreta. */
async function bitacoraEn(
  idEstudiante: string,
  fecha: string,
  horas: number,
  opciones: { semanaDeclarada?: number; estado?: string } = {}
): Promise<void> {
  await pool.query(
    `insert into bitacoras_comunitario
       (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [
      idEstudiante,
      datos.grupo,
      opciones.semanaDeclarada ?? 1,
      fecha,
      `Actividad del ${fecha}`,
      horas,
      opciones.estado ?? 'aprobado',
    ]
  );
}

async function servicioEn(idEstudiante: string, fecha: string, horas: number): Promise<void> {
  await pool.query(
    `insert into control_servicios_institucionales
       (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, estado)
     values ($1, 'social', $2, $3, $4, 'aprobado')`,
    [idEstudiante, fecha, `Servicio del ${fecha}`, horas]
  );
}

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
});

afterAll(async () => {
  await cerrarPool();
});

beforeEach(async () => {
  datos = await sembrar();
  // El seed deja una bitacora suelta en 2026-02-10 (semana 4 del periodo). Este
  // archivo mide el calculo de la semana actividad por actividad, asi que se
  // parte de cero y cada prueba pone exactamente lo que quiere medir.
  await pool.query('delete from bitacoras_comunitario');
});

describe('la semana se calcula desde el inicio del periodo', () => {
  it('el primer dia del periodo es la semana 1', async () => {
    await bitacoraEn(datos.estudianteA, INICIO_PERIODO, 3);
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].semana).toBe(1);
  });

  it('el septimo dia sigue siendo la semana 1 y el octavo es la 2', async () => {
    await bitacoraEn(datos.estudianteA, '2026-01-21', 2); // dia 7
    await bitacoraEn(datos.estudianteA, '2026-01-22', 2); // dia 8
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    expect(filas.map((f) => f.semana)).toEqual([1, 2]);
  });

  it('la misma regla vale para el servicio social, que no guarda semana', async () => {
    await servicioEn(datos.estudianteA, '2026-01-29', 4); // dia 15 -> semana 3
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].semana).toBe(3);
    expect(filas[0].semanaDeclarada).toBeNull();
    expect(filas[0].tipo).toBe('social');
  });

  it('conserva la semana que declaro el estudiante para poder contrastarla', async () => {
    await bitacoraEn(datos.estudianteA, '2026-01-22', 2, { semanaDeclarada: 9 });
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    expect(filas[0].semana).toBe(2);
    expect(filas[0].semanaDeclarada).toBe(9);
  });

  it('deja fuera lo que cae fuera del periodo', async () => {
    await bitacoraEn(datos.estudianteA, '2025-12-20', 3); // antes del inicio
    await bitacoraEn(datos.estudianteA, '2026-02-02', 3); // dentro
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    expect(filas).toHaveLength(1);
    expect(filas[0].fecha).toBe('2026-02-02');
  });
});

describe('filtro por semana', () => {
  beforeEach(async () => {
    await bitacoraEn(datos.estudianteA, '2026-01-16', 3); // semana 1
    await bitacoraEn(datos.estudianteA, '2026-01-23', 4); // semana 2
    await bitacoraEn(datos.estudianteB, '2026-01-24', 5); // semana 2
  });

  it('devuelve solo las actividades de esa semana', async () => {
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: 2,
      idGrupo: null,
      idEstudiante: null,
      idTutor: null,
    });
    expect(filas).toHaveLength(2);
    expect(filas.every((f) => f.semana === 2)).toBe(true);
  });

  it('lista las semanas con actividad y sus totales', async () => {
    const res = await api()
      .get(`/api/reportes/semanas?periodoId=${datos.periodo}`)
      .set(auth(await tokenDe('coordinador')));
    expect(res.status).toBe(200);

    const semanas = res.body.semanas as { semana: number; actividades: number; horas: number }[];
    expect(semanas.map((s) => s.semana)).toEqual([1, 2]);
    expect(semanas[0]).toMatchObject({ actividades: 1, horas: 3 });
    expect(semanas[1]).toMatchObject({ actividades: 2, horas: 9 });
  });
});

describe('alcance por rol', () => {
  beforeEach(async () => {
    await bitacoraEn(datos.estudianteA, '2026-01-16', 3);
    await bitacoraEn(datos.estudianteB, '2026-01-17', 4);
  });

  async function pdf(token: string, query = '') {
    return api().get(`/api/reportes/semanal.pdf${query}`).set(auth(token)).responseType('blob');
  }

  it('el estudiante baja su reporte', async () => {
    const res = await pdf(await tokenDe('estudiante'));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toContain('.pdf');
  });

  it('el estudiante NO puede pedir el de otro: el id se ignora', async () => {
    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      // Lo que el controlador fuerza para una sesion de estudianteA, pase lo
      // que pase por la query string.
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    expect(filas.every((f) => f.idEstudiante === datos.estudianteA)).toBe(true);

    // Y por HTTP: pedir el de estudianteB con sesion de estudianteA responde
    // 200 pero con los datos propios, no los ajenos.
    const res = await pdf(await tokenDe('estudiante'), `?estudianteId=${datos.estudianteB}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toContain('ana');
  });

  it('el tutor ve a los estudiantes de sus grupos', async () => {
    const res = await pdf(await tokenDe('tutor'));
    expect(res.status).toBe(200);
  });

  it('el tutor comunitario tambien', async () => {
    const res = await pdf(await tokenDeCorreo('tutorcomunitario@test.local'));
    expect(res.status).toBe(200);
  });

  it('el tutor no puede pedir un grupo ajeno', async () => {
    const { rows } = await pool.query<{ id_grupo: string }>(
      `insert into grupos_proyectos (nombre_proyecto, id_periodo, id_tutor_academico)
       values ('Grupo ajeno', $1, $2) returning id_grupo`,
      [datos.periodo, datos.tutorB]
    );
    const res = await pdf(await tokenDe('tutor'), `?grupoId=${rows[0].id_grupo}`);
    expect(res.status).toBe(403);
  });

  it('el tutor no puede pedir un estudiante que no es suyo', async () => {
    const res = await pdf(await tokenDe('tutor'), `?estudianteId=${datos.outsider}`);
    expect(res.status).toBe(403);
  });

  it('la coordinacion lo ve todo', async () => {
    const res = await pdf(await tokenDe('coordinador'));
    expect(res.status).toBe(200);
  });

  it('el estudiante solo ve sus propias semanas en el selector', async () => {
    const res = await api()
      .get('/api/reportes/semanas')
      .set(auth(await tokenDe('estudiante')));
    expect(res.status).toBe(200);
    const semanas = res.body.semanas as { actividades: number }[];
    // Solo la suya: una actividad, no las dos del grupo.
    expect(semanas).toHaveLength(1);
    expect(semanas[0].actividades).toBe(1);
  });
});

describe('contenido del PDF', () => {
  it('incluye las pendientes y las rechazadas, no solo las aprobadas', async () => {
    await bitacoraEn(datos.estudianteA, '2026-01-16', 3, { estado: 'aprobado' });
    await bitacoraEn(datos.estudianteA, '2026-01-17', 2, { estado: 'pendiente' });
    await bitacoraEn(datos.estudianteA, '2026-01-18', 1, { estado: 'rechazado' });

    const filas = await obtenerDetalleSemanal(datos.periodo, {
      periodoId: datos.periodo,
      semana: null,
      idGrupo: null,
      idEstudiante: datos.estudianteA,
      idTutor: null,
    });
    // Un registro de actividades que solo mostrara lo aprobado no serviria para
    // revisar la semana, que es justo cuando aun no esta validado.
    expect(filas).toHaveLength(3);
    expect(new Set(filas.map((f) => f.estado))).toEqual(
      new Set(['aprobado', 'pendiente', 'rechazado'])
    );
  });

  it('genera un PDF de verdad', async () => {
    await bitacoraEn(datos.estudianteA, '2026-01-16', 3);
    const res = await api()
      .get('/api/reportes/semanal.pdf?semana=1')
      .set(auth(await tokenDe('admin')))
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(res.body.length).toBeGreaterThan(900);
  });

  it('un periodo sin actividades sigue dando un PDF, no un error', async () => {
    const res = await api()
      .get('/api/reportes/semanal.pdf')
      .set(auth(await tokenDe('admin')))
      .responseType('blob');
    expect(res.status).toBe(200);
    expect(res.body.subarray(0, 4).toString()).toBe('%PDF');
  });
});
