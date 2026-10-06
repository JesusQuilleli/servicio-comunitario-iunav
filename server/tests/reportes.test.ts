import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';
import { pool } from '../src/db/pool.js';
import {
  esIntegranteDeTutor,
  obtenerConsolidado,
  obtenerDatosActa,
  obtenerDatosCertificado,
} from '../src/models/reporte.model.js';

/**
 * Reportes en PDF y Excel.
 *
 * El contrato HTTP se prueba por API (codigo, tipo de contenido, cabecera de
 * descarga) y las cifras se prueban contra el modelo: un PDF comprimido no
 * sirve para comprobar que el total es el correcto.
 */

let datos: DatosSemilla;

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
});

afterAll(async () => {
  await cerrarPool();
});

beforeEach(async () => {
  datos = await sembrar();
});

/** Inserta horas ya validadas; `impacto` en 0 no crea registro de servicio. */
async function agregarHoras(
  idEstudiante: string,
  idGrupo: string,
  directas: number,
  impacto: number
): Promise<void> {
  await pool.query(
    `insert into bitacoras_comunitario
       (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
     values ($1, $2, 2, '2026-03-01', 'Jornada ya validada', $3, 'aprobado')`,
    [idEstudiante, idGrupo, directas]
  );
  if (impacto > 0) {
    await pool.query(
      `insert into control_servicios_institucionales
         (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, estado)
       values ($1, 'social', '2026-03-02', 'Servicio ya validado', $2, 'aprobado')`,
      [idEstudiante, impacto]
    );
  }
}

interface Descarga {
  status: number;
  tipo: string;
  disposicion: string;
  cache: string;
  cuerpo: Buffer;
}

async function descargar(ruta: string, token: string): Promise<Descarga> {
  const res = await api()
    .get(ruta)
    .set(auth(token))
    .responseType('blob');
  return {
    status: res.status,
    tipo: String(res.headers['content-type'] ?? ''),
    disposicion: String(res.headers['content-disposition'] ?? ''),
    cache: String(res.headers['cache-control'] ?? ''),
    cuerpo: Buffer.from(res.body ?? Buffer.alloc(0)),
  };
}

const CABECERA_PDF = Buffer.from('%PDF-');
const CABECERA_XLSX = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK.." de un zip

describe('descarga del consolidado', () => {
  it('llega como PDF con la cabecera correcta', async () => {
    const d = await descargar('/api/reportes/consolidado-horas.pdf', await tokenDe('admin'));

    expect(d.status).toBe(200);
    expect(d.tipo).toBe('application/pdf');
    expect(d.cuerpo.subarray(0, 5).equals(CABECERA_PDF)).toBe(true);
    // Un PDF de verdad pesa mas que un mensaje de error.
    expect(d.cuerpo.length).toBeGreaterThan(1000);
  });

  it('propone un nombre de archivo sin acentos ni espacios', async () => {
    const d = await descargar('/api/reportes/consolidado-horas.pdf', await tokenDe('admin'));
    expect(d.disposicion).toBe('attachment; filename="consolidado-horas-2026-i.pdf"');
  });

  it('no se cachea en el navegador', async () => {
    const d = await descargar('/api/reportes/consolidado-horas.pdf', await tokenDe('admin'));
    expect(d.cache).toBe('no-store');
  });

  it('llega como Excel, que por dentro es un zip', async () => {
    const d = await descargar('/api/reportes/consolidado-horas.xlsx', await tokenDe('admin'));

    expect(d.status).toBe(200);
    expect(d.tipo).toContain('spreadsheetml.sheet');
    expect(d.cuerpo.subarray(0, 4).equals(CABECERA_XLSX)).toBe(true);
  });

  it('funciona sin resultados: el PDF sale igual, no revienta', async () => {
    const d = await descargar(
      `/api/reportes/consolidado-horas.pdf?grupoId=00000000-0000-0000-0000-000000000000`,
      await tokenDe('admin')
    );
    expect(d.status).toBe(200);
    expect(d.cuerpo.subarray(0, 5).equals(CABECERA_PDF)).toBe(true);
  });

  it('rechaza un periodo que no es un numero', async () => {
    const res = await api()
      .get('/api/reportes/consolidado-horas.pdf?periodoId=abc')
      .set(auth(await tokenDe('admin')));
    expect(res.status).toBe(400);
  });

  it('exige token', async () => {
    const res = await api().get('/api/reportes/consolidado-horas.pdf').responseType('blob');
    expect(res.status).toBe(401);
  });
});

describe('permisos de los reportes', () => {
  const rutas = (d: DatosSemilla) => [
    '/api/reportes/consolidado-horas.pdf',
    '/api/reportes/consolidado-horas.xlsx',
    `/api/reportes/acta/${d.grupo}.pdf`,
    `/api/reportes/certificado/${d.estudianteA}.pdf`,
  ];

  it('el estudiante no descarga ninguno', async () => {
    const token = await tokenDe('estudiante');
    for (const ruta of rutas(datos)) {
      // Sin `responseType('blob')`: aqui interesa el mensaje de error en JSON,
      // no los bytes del archivo.
      const res = await api().get(ruta).set(auth(token));
      expect(res.status, ruta).toBe(403);
      expect(res.body.message).toMatch(/Acceso denegado/i);
    }
  });

  it('el tutor descarga todo lo que es suyo', async () => {
    const token = await tokenDe('tutor');
    for (const ruta of rutas(datos)) {
      const res = await api().get(ruta).set(auth(token)).responseType('blob');
      expect(res.status, ruta).toBe(200);
    }
  });

  it('un tutor no saca el acta de un grupo de otro tutor', async () => {
    // El token de prueba es el de tutoralfa, y el grupo del seed es suyo; con un
    // grupo ajeno el mismo endpoint tiene que negarse.
    const { rows } = await pool.query<{ id_grupo: string }>(
      `insert into grupos_proyectos (nombre_proyecto, id_periodo, id_tutor)
       values ('Grupo de tut_beta', $1, $2) returning id_grupo`,
      [datos.periodo, datos.tutorB]
    );
    const res = await api()
      .get(`/api/reportes/acta/${rows[0].id_grupo}.pdf`)
      .set(auth(await tokenDe('tutor')))
      .responseType('blob');
    expect(res.status).toBe(403);
  });

  it('un tutor no saca el certificado de un estudiante que no es suyo', async () => {
    const res = await api()
      .get(`/api/reportes/certificado/${datos.outsider}.pdf`)
      .set(auth(await tokenDe('tutor')))
      .responseType('blob');
    expect(res.status).toBe(403);
  });

  it('da 404 si el grupo no existe', async () => {
    const res = await api()
      .get('/api/reportes/acta/00000000-0000-0000-0000-000000000000.pdf')
      .set(auth(await tokenDe('admin')))
      .responseType('blob');
    expect(res.status).toBe(404);
  });

  it('no emite certificado de quien no es estudiante', async () => {
    const res = await api()
      .get(`/api/reportes/certificado/${datos.admin}.pdf`)
      .set(auth(await tokenDe('admin')))
      .responseType('blob');
    expect(res.status).toBe(404);
  });
});

describe('cifras del consolidado', () => {
  it('cuenta solo las horas aprobadas y separa lo pendiente', async () => {
    // El seed deja una bitacora pendiente de 4 h para la estudiante A.
    await agregarHoras(datos.estudianteA, datos.grupo, 40, 12);

    const filas = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: null,
      idTutor: null,
    });
    const ana = filas.find((f) => f.idUsuario === datos.estudianteA)!;

    expect(ana.horasDirectas).toBe(40);
    expect(ana.directasPendientes).toBe(4);
    expect(ana.horasImpacto).toBe(12);
    expect(ana.totalAprobadas).toBe(52);
  });

  it('el filtro por grupo aprieta las horas directas a ese grupo', async () => {
    const { rows: otro } = await pool.query<{ id_grupo: string }>(
      `insert into grupos_proyectos (nombre_proyecto, id_periodo, id_tutor)
       values ('Grupo paralelo', $1, $2) returning id_grupo`,
      [datos.periodo, datos.tutorA]
    );
    await agregarHoras(datos.estudianteA, datos.grupo, 10, 0);
    await agregarHoras(datos.estudianteA, otro[0].id_grupo, 25, 0);

    const soloGrupo = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: datos.grupo,
      idTutor: null,
    });
    const delGrupo = soloGrupo.find((f) => f.idUsuario === datos.estudianteA)!;
    expect(delGrupo.horasDirectas).toBe(10);

    const sinFiltro = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: null,
      idTutor: null,
    });
    const total = sinFiltro.find((f) => f.idUsuario === datos.estudianteA)!;
    expect(total.horasDirectas).toBe(35);
  });

  it('el filtro por periodo deja fuera lo de otro periodo', async () => {
    const { rows: p2 } = await pool.query<{ id_periodo: number }>(
      `insert into periodos_academicos (nombre_periodo, fecha_inicio, fecha_fin, activo)
       values ('2026-II', '2026-07-01', '2026-12-15', false) returning id_periodo`
    );
    const { rows: g2 } = await pool.query<{ id_grupo: string }>(
      `insert into grupos_proyectos (nombre_proyecto, id_periodo, id_tutor)
       values ('Grupo del segundo periodo', $1, $2) returning id_grupo`,
      [p2[0].id_periodo, datos.tutorA]
    );
    await pool.query(
      `insert into integrantes_grupo (id_grupo, id_estudiante, estado_final)
       values ($1, $2, 'en_curso')`,
      [g2[0].id_grupo, datos.estudianteA]
    );
    await agregarHoras(datos.estudianteA, datos.grupo, 15, 0);
    await agregarHoras(datos.estudianteA, g2[0].id_grupo, 33, 0);

    const enPrimero = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: null,
      idTutor: null,
    });
    expect(enPrimero.find((f) => f.idUsuario === datos.estudianteA)!.horasDirectas).toBe(15);

    const enSegundo = await obtenerConsolidado({
      periodoId: p2[0].id_periodo,
      idGrupo: null,
      idTutor: null,
    });
    expect(enSegundo.find((f) => f.idUsuario === datos.estudianteA)!.horasDirectas).toBe(33);
  });

  it('el tutor solo recibe estudiantes de sus grupos', async () => {
    await agregarHoras(datos.estudianteA, datos.grupo, 10, 0);

    const delTutor = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: null,
      idTutor: datos.tutorA,
    });
    const ids = delTutor.map((f) => f.idUsuario);

    expect(ids).toContain(datos.estudianteA);
    expect(ids).toContain(datos.estudianteB);
    // Carla no esta en ningun grupo del tutor.
    expect(ids).not.toContain(datos.outsider);
  });

  it('un tutor sin grupos recibe una lista vacia, no un error', async () => {
    const filas = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: null,
      idTutor: datos.tutorB,
    });
    expect(filas).toEqual([]);
  });

  it('la gestion ve tambien a quien no esta en ningun grupo', async () => {
    const filas = await obtenerConsolidado({
      periodoId: datos.periodo,
      idGrupo: null,
      idTutor: null,
    });
    const ids = filas.map((f) => f.idUsuario);
    expect(ids).toContain(datos.outsider);
    // Y deja fuera a la cuenta desactivada.
    expect(ids).not.toContain(datos.estudianteInactivo);
  });

  it('esIntegranteDeTutor distingue propio de ajeno', async () => {
    expect(await esIntegranteDeTutor(datos.estudianteA, datos.tutorA)).toBe(true);
    expect(await esIntegranteDeTutor(datos.estudianteA, datos.tutorB)).toBe(false);
  });
});

describe('acta de culminacion', () => {
  it('lista a los integrantes con sus horas y su estado final', async () => {
    await agregarHoras(datos.estudianteA, datos.grupo, 20, 5);

    const acta = await obtenerDatosActa(datos.grupo);
    expect(acta).not.toBeNull();

    const ana = acta!.integrantes.find((i) => i.nombreCompleto === 'Estudiante Ana')!;
    expect(ana.horasDirectas).toBe(20);
    expect(ana.horasImpacto).toBe(5);
    expect(ana.total).toBe(25);
    expect(ana.estadoFinal).toBe('en_curso');

    expect(acta!.totales.directas).toBe(20);
    expect(acta!.totales.impacto).toBe(5);
    expect(acta!.periodo?.nombre).toBe('2026-I');
    expect(acta!.grupo.tutorNombre).toBe('Tutor Alfa');
  });

  it('el nombre del archivo del acta sale del proyecto, no del id', async () => {
    const res = await api()
      .get(`/api/reportes/acta/${datos.grupo}.pdf`)
      .set(auth(await tokenDe('admin')));
    expect(res.headers['content-disposition']).toBe(
      'attachment; filename="acta-grupo-de-prueba.pdf"'
    );
  });
});

describe('certificado', () => {
  it('acredita a quien cumple las dos metas', async () => {
    await agregarHoras(datos.estudianteA, datos.grupo, 95, 30);

    const d = await obtenerDatosCertificado(datos.estudianteA, datos.periodo);
    expect(d!.horasDirectas).toBe(95);
    expect(d!.horasImpacto).toBe(30);
    expect(d!.metas).toEqual({ directas: 90, impacto: 30 });
    expect(d!.cumpleMetas).toBe(true);
  });

  it('no acredita a quien se queda corto, y lo dice cuantas horas faltan', async () => {
    await agregarHoras(datos.estudianteA, datos.grupo, 90, 20);

    const d = await obtenerDatosCertificado(datos.estudianteA, datos.periodo);
    expect(d!.cumpleMetas).toBe(false);
    // El seed deja un registro pendiente, que tambien se reporta.
    expect(d!.pendientes).toBe(1);
  });

  it('el PDF lleva el nombre del estudiante y marca el estado de acreditacion', async () => {
    const d = await descargar(
      `/api/reportes/certificado/${datos.estudianteA}.pdf`,
      await tokenDe('admin')
    );

    expect(d.status).toBe(200);
    expect(d.tipo).toBe('application/pdf');
    expect(d.disposicion).toBe('attachment; filename="certificado-estudiante-ana.pdf"');
    expect(d.cuerpo.subarray(0, 5).equals(CABECERA_PDF)).toBe(true);
  });
});