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

/**
 * No se aprueba un proyecto sin horas.
 *
 * Antes de esto, `PATCH /grupos/:id/estado` era un `update` de una sola
 * sentencia: se podia dar por finalizado un proyecto con cero horas validadas, y
 * marcar `estado_final = 'aprobado'` a un estudiante que no habia registrado
 * nada. Las dos cosas acreditan el servicio comunitario de una persona.
 *
 * El escape existe y es deliberado: el administrador puede forzar dejando un
 * motivo, y ese motivo queda en el historial de acciones.
 */

let datos: DatosSemilla;
let tokenAdmin: string;
let tokenCoordinador: string;

/** Mete horas YA APROBADAS, que son las unicas que cuentan. */
async function darHoras(
  idEstudiante: string,
  idGrupo: string,
  directas: number,
  impacto: number
): Promise<void> {
  if (directas > 0) {
    await pool.query(
      `insert into bitacoras_comunitario
         (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
       values ($1, $2, 1, '2026-03-01', 'Jornada ya validada', $3, 'aprobado')`,
      [idEstudiante, idGrupo, directas]
    );
  }
  if (impacto > 0) {
    await pool.query(
      `insert into control_servicios_institucionales
         (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, estado)
       values ($1, 'social', '2026-03-02', 'Servicio ya validado', $2, 'aprobado')`,
      [idEstudiante, impacto]
    );
  }
}

/** Deja al grupo entero cumpliendo las metas del programa (90 + 30). */
async function completarGrupo(): Promise<void> {
  for (const id of [datos.estudianteA, datos.estudianteB, datos.integranteSinHoras]) {
    await darHoras(id, datos.grupo, 90, 30);
  }
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
  tokenAdmin = await tokenDe('admin');
  tokenCoordinador = await tokenDe('coordinador');
});

function finalizar(token: string, cuerpo: Record<string, unknown> = {}) {
  return api()
    .patch(`/api/grupos/${datos.grupo}/estado`)
    .set(auth(token))
    .send({ estado: 'finalizado', ...cuerpo });
}

function aprobarIntegrante(token: string, cuerpo: Record<string, unknown> = {}) {
  return api()
    .patch(`/api/grupos/${datos.grupo}/integrantes/${datos.estudianteA}`)
    .set(auth(token))
    .send({ estadoFinal: 'aprobado', ...cuerpo });
}

describe('finalizar un proyecto exige las horas', () => {
  it('409 con el detalle de quien no llega', async () => {
    const res = await finalizar(tokenCoordinador);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('trabajo directo');
    // La lista nombre por nombre: la interfaz la necesita para no dejar al
    // coordinador adivinando a quien le falta.
    expect(Array.isArray(res.body.faltantes)).toBe(true);
    expect(res.body.faltantes.length).toBeGreaterThan(0);
    expect(res.body.faltantes[0]).toHaveProperty('faltanDirectas');
  });

  it('no cambia el estado cuando rechaza', async () => {
    await finalizar(tokenCoordinador);
    const res = await api().get(`/api/grupos/${datos.grupo}`).set(auth(tokenAdmin));
    expect(res.body.grupo.estado).not.toBe('finalizado');
  });

  it('bloquea aunque falte solo la mitad de la meta', async () => {
    for (const id of [datos.estudianteA, datos.estudianteB, datos.integranteSinHoras]) {
      await darHoras(id, datos.grupo, 90, 0); // directas completas, impacto en cero
    }
    const res = await finalizar(tokenCoordinador);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('impacto');
    expect(res.body.message).not.toContain('trabajo directo');
  });

  it('200 cuando todos cumplen', async () => {
    await completarGrupo();
    const res = await finalizar(tokenCoordinador);
    expect(res.status).toBe(200);
    expect(res.body.grupo.estado).toBe('finalizado');
  });

  it('no exige horas a quien ya esta reprobado', async () => {
    await darHoras(datos.estudianteA, datos.grupo, 90, 30);
    await darHoras(datos.estudianteB, datos.grupo, 90, 30);
    await api()
      .patch(`/api/grupos/${datos.grupo}/integrantes/${datos.integranteSinHoras}`)
      .set(auth(tokenCoordinador))
      .send({ estadoFinal: 'reprobado' });

    const res = await finalizar(tokenCoordinador);
    expect(res.status).toBe(200);
  });

  it('suspender no exige nada: no acredita a nadie', async () => {
    const res = await api()
      .patch(`/api/grupos/${datos.grupo}/estado`)
      .set(auth(tokenCoordinador))
      .send({ estado: 'suspendido' });
    expect(res.status).toBe(200);
  });
});

describe('la salida de escape del administrador', () => {
  it('el coordinador no puede forzar aunque mande un motivo', async () => {
    const res = await finalizar(tokenCoordinador, { motivo: 'Lo autorizo yo' });
    expect(res.status).toBe(409);
  });

  it('el admin tampoco fuerza sin motivo', async () => {
    const res = await finalizar(tokenAdmin);
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('motivo');
  });

  it('el admin fuerza con un motivo y queda en el historial', async () => {
    const res = await finalizar(tokenAdmin, {
      motivo: 'Convalidacion aprobada por el consejo academico',
    });
    expect(res.status).toBe(200);
    expect(res.body.grupo.estado).toBe('finalizado');

    const historial = await api().get('/api/historial?entidad=grupo').set(auth(tokenAdmin));
    const evento = (historial.body.eventos as { accion: string; datos: Record<string, unknown> }[])
      .find((e) => e.accion === 'grupo.estado.forzado');
    expect(evento, 'forzar tiene que dejar rastro').toBeDefined();
    expect(evento?.datos?.motivo).toContain('consejo academico');
    expect((evento?.datos?.incompletos as unknown[]).length).toBeGreaterThan(0);
  });

  it('un motivo en blanco no sirve como motivo', async () => {
    const res = await finalizar(tokenAdmin, { motivo: '   ' });
    expect(res.status).toBe(409);
  });
});

describe('aprobar a un integrante exige sus horas', () => {
  it('409 si no llega a las metas', async () => {
    const res = await aprobarIntegrante(tokenCoordinador);
    expect(res.status).toBe(409);
    expect(res.body.faltantes).toHaveLength(1);
    expect(res.body.faltantes[0].nombreCompleto).toBe('Estudiante Ana');
  });

  it('solo mira al estudiante en cuestion, no a sus companeros', async () => {
    await darHoras(datos.estudianteA, datos.grupo, 90, 30);
    const res = await aprobarIntegrante(tokenCoordinador);
    expect(res.status).toBe(200);
  });

  it('reprobar no exige horas', async () => {
    const res = await api()
      .patch(`/api/grupos/${datos.grupo}/integrantes/${datos.estudianteA}`)
      .set(auth(tokenCoordinador))
      .send({ estadoFinal: 'reprobado' });
    expect(res.status).toBe(200);
  });

  it('el admin puede forzar con motivo', async () => {
    const res = await aprobarIntegrante(tokenAdmin, { motivo: 'Horas convalidadas de otro periodo' });
    expect(res.status).toBe(200);
  });
});

describe('las horas del proyecto suman las dos metas', () => {
  it('el detalle trae directas e impacto por separado', async () => {
    await darHoras(datos.estudianteA, datos.grupo, 40, 12);
    const res = await api().get(`/api/grupos/${datos.grupo}`).set(auth(tokenAdmin));
    expect(res.status).toBe(200);

    const ana = (res.body.grupo.listaIntegrantes as {
      nombreCompleto: string;
      horasDirectas: number;
      horasImpacto: number;
      horasAprobadas: number;
    }[]).find((i) => i.nombreCompleto === 'Estudiante Ana')!;

    expect(ana.horasDirectas).toBe(40);
    expect(ana.horasImpacto).toBe(12);
    // Antes el total ignoraba el servicio social/ambiental y se quedaba en 40.
    expect(ana.horasAprobadas).toBe(52);
    expect(res.body.grupo.horasAprobadas).toBe(52);
  });
});

describe('editar un registro no permite pasarse de la meta', () => {
  it('rechaza subir las horas por encima del tope al editar', async () => {
    // 85h ya aprobadas: quedan 5 de las 90 de trabajo directo.
    await darHoras(datos.estudianteA, datos.grupo, 85, 0);

    const tokenEstudiante = await tokenDe('estudiante');
    const res = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}`)
      .set(auth(tokenEstudiante))
      .send({ fecha: '2026-04-10', descripcion: 'Intento de pasarme del tope', horas: 8 });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('meta');
  });

  it('deja editar mientras quepa en la meta', async () => {
    await darHoras(datos.estudianteA, datos.grupo, 85, 0);

    const tokenEstudiante = await tokenDe('estudiante');
    const res = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}`)
      .set(auth(tokenEstudiante))
      .send({ fecha: '2026-04-10', descripcion: 'Edicion que si cabe', horas: 4 });

    expect(res.status).toBe(200);
  });
});
