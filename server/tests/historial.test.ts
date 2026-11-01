import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';

/**
 * Historial de acciones administrativas y de configuracion.
 *
 * Lo que se vigila aqui no es el endpoint de lectura (eso ya lo cubre la matriz
 * de permisos) sino que **las operaciones dejen rastro**: antes de esto, cambiar
 * las metas del programa no dejaba ninguno, y cambiar `horas_directas` reescribe
 * de forma retroactiva quien cumple el servicio comunitario.
 */

interface EventoRespuesta {
  idEvento: string;
  actorNombre: string;
  actorRol: string;
  accion: string;
  entidad: string;
  idEntidad: string | null;
  descripcion: string;
  datos: Record<string, unknown> | null;
  creadoEn: string;
}

let datos: DatosSemilla;
let tokenAdmin: string;
let tokenCoordinador: string;

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

async function historial(token: string, query = ''): Promise<EventoRespuesta[]> {
  const res = await api().get(`/api/historial${query}`).set(auth(token));
  expect(res.status).toBe(200);
  return res.body.eventos as EventoRespuesta[];
}

describe('historial: la configuracion deja rastro', () => {
  it('registra quien cambio las metas y desde que valores', async () => {
    const antes = await api().get('/api/configuracion').set(auth(tokenAdmin));
    expect(antes.status).toBe(200);

    const res = await api()
      .patch('/api/configuracion')
      .set(auth(tokenAdmin))
      .send({
        horasDirectas: 120,
        horasImpacto: 40,
        limiteHorasDiarias: 6,
        periodoActivoId: datos.periodo,
      });
    expect(res.status).toBe(200);

    const eventos = await historial(tokenAdmin);
    const evento = eventos.find((e) => e.accion === 'configuracion.actualizar');
    expect(evento, 'el cambio de configuracion tiene que quedar registrado').toBeDefined();
    expect(evento?.entidad).toBe('configuracion');
    expect(evento?.actorRol).toBe('admin');

    // Lo importante: el valor ANTERIOR, que el `update` destruye.
    const cambios = evento?.datos?.cambios as Record<string, { antes: unknown; despues: unknown }>;
    expect(cambios.horasDirectas).toEqual({
      antes: antes.body.configuracion.horasDirectas,
      despues: 120,
    });
    expect(cambios.horasImpacto.despues).toBe(40);
    expect(evento?.descripcion).toContain('horas de trabajo directo');
  });

  it('no escribe nada si la configuracion no cambia', async () => {
    const actual = await api().get('/api/configuracion').set(auth(tokenAdmin));
    const { horasDirectas, horasImpacto, limiteHorasDiarias, periodoActivoId } =
      actual.body.configuracion;

    await api()
      .patch('/api/configuracion')
      .set(auth(tokenAdmin))
      .send({ horasDirectas, horasImpacto, limiteHorasDiarias, periodoActivoId });

    const eventos = await historial(tokenAdmin);
    expect(eventos.filter((e) => e.accion === 'configuracion.actualizar')).toHaveLength(0);
  });
});

describe('historial: acciones administrativas', () => {
  it('registra el alta de un usuario con su autor', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(tokenCoordinador))
      .send({
        nombreCompleto: 'Nuevo Estudiante',
        cedula: 'V-30.111.222',
        email: 'nuevo.historial@test.local',
        password: 'claveSegura123',
        rol: 'estudiante',
      });
    expect(res.status).toBe(201);

    const eventos = await historial(tokenAdmin, '?entidad=usuario');
    const evento = eventos.find((e) => e.accion === 'usuario.crear');
    expect(evento).toBeDefined();
    expect(evento?.actorRol).toBe('coordinador');
    expect(evento?.descripcion).toContain('Nuevo Estudiante');
    expect(evento?.idEntidad).toBe(res.body.usuario.idUsuario);
  });

  it('registra la desactivacion de una cuenta', async () => {
    const res = await api()
      .patch(`/api/usuarios/${datos.estudianteA}/activo`)
      .set(auth(tokenAdmin))
      .send({ activo: false });
    expect(res.status).toBe(200);

    const eventos = await historial(tokenAdmin, '?entidad=usuario');
    const evento = eventos.find((e) => e.accion === 'usuario.activo');
    expect(evento?.descripcion).toContain('Desactivó');
  });

  it('registra el restablecimiento de clave sin guardar la clave', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.estudianteA}/password`)
      .set(auth(tokenAdmin))
      .send({});
    expect(res.status).toBe(201);
    const temporal = res.body.passwordTemporal as string;

    const eventos = await historial(tokenAdmin, '?entidad=usuario');
    const evento = eventos.find((e) => e.accion === 'usuario.password');
    expect(evento).toBeDefined();
    expect(JSON.stringify(evento)).not.toContain(temporal);
  });

  it('registra la creacion de un proyecto', async () => {
    const res = await api()
      .post('/api/grupos')
      .set(auth(tokenCoordinador))
      .send({
        nombreProyecto: 'Proyecto auditado',
        periodoId: datos.periodo,
        tutorAcademicoId: datos.tutorA,
        tutorComunitarioId: datos.tutorComunitario,
        coordinadorId: datos.coordinador,
        estado: 'en_curso',
        integrantesIds: [],
      });
    expect(res.status).toBe(201);

    const eventos = await historial(tokenAdmin, '?entidad=grupo');
    expect(eventos.some((e) => e.descripcion.includes('Proyecto auditado'))).toBe(true);
  });
});

describe('historial: lectura y filtros', () => {
  beforeEach(async () => {
    // Dos acciones de modulos distintos para poder filtrar entre ellas.
    await api()
      .patch('/api/configuracion')
      .set(auth(tokenAdmin))
      .send({ horasDirectas: 100, horasImpacto: 20, limiteHorasDiarias: 8, periodoActivoId: datos.periodo });
    await api()
      .post('/api/periodos')
      .set(auth(tokenCoordinador))
      .send({ nombrePeriodo: 'Periodo auditado', fechaInicio: '2026-01-06', fechaFin: '2026-06-30' });
  });

  it('el coordinador tambien ve el historial', async () => {
    const eventos = await historial(tokenCoordinador);
    expect(eventos.length).toBeGreaterThanOrEqual(2);
  });

  it('filtra por modulo', async () => {
    const eventos = await historial(tokenAdmin, '?entidad=periodo');
    expect(eventos.length).toBeGreaterThan(0);
    expect(eventos.every((e) => e.entidad === 'periodo')).toBe(true);
  });

  it('busca por texto en la descripcion', async () => {
    const eventos = await historial(tokenAdmin, '?q=Periodo%20auditado');
    expect(eventos).toHaveLength(1);
    expect(eventos[0].accion).toBe('periodo.crear');
  });

  it('devuelve lo mas reciente primero', async () => {
    const eventos = await historial(tokenAdmin);
    const fechas = eventos.map((e) => new Date(e.creadoEn).getTime());
    expect(fechas).toEqual([...fechas].sort((a, b) => b - a));
  });

  it('pagina y mantiene coherente el total', async () => {
    const res = await api().get('/api/historial?porPagina=1').set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.eventos).toHaveLength(1);
    expect(res.body.porPagina).toBe(1);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it('rechaza un filtro de fecha mal escrito', async () => {
    const res = await api().get('/api/historial?desde=25-10-2026').set(auth(tokenAdmin));
    expect(res.status).toBe(400);
  });

  it('expone las acciones registradas para el filtro de la interfaz', async () => {
    const res = await api().get('/api/historial/acciones').set(auth(tokenAdmin));
    expect(res.status).toBe(200);
    expect(res.body.acciones).toContain('periodo.crear');
    expect(res.body.entidades).toContain('configuracion');
  });
});
