import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, tokenDe, tokenDeCorreo } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';
import { obtenerDatosActa } from '../src/models/reporte.model.js';

/**
 * Tutor Academico y Tutor Comunitario.
 *
 * La regla que se vigila aqui es la que motivo el cambio: un proyecto tiene DOS
 * tutores y **los dos** validan las horas de sus estudiantes. El riesgo de la
 * migracion era justo el contrario — que al pasar de una columna a dos, alguna
 * consulta se quedara mirando solo una y un tutor dejara de ver a sus propios
 * estudiantes sin que saltara ningun error.
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

/** El tutor comunitario del grupo de prueba (el academico es `tokenDe('tutor')`). */
function tokenComunitario(): Promise<string> {
  return tokenDeCorreo('tutorcomunitario@test.local');
}

describe('los dos tutores validan horas de su grupo', () => {
  it('el tutor academico aprueba una bitacora de su grupo', async () => {
    const res = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado', comentario: 'Visto bueno academico' });
    expect(res.status).toBe(200);
  });

  it('el tutor comunitario tambien aprueba una bitacora del mismo grupo', async () => {
    const res = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenComunitario()))
      .send({ tipo: 'comunitario', estado: 'aprobado', comentario: 'Visto bueno comunitario' });
    expect(res.status).toBe(200);
  });

  it('un tutor ajeno al grupo sigue sin poder validar', async () => {
    const res = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDeCorreo('tutorbeta@test.local')))
      .send({ tipo: 'comunitario', estado: 'aprobado', comentario: 'No deberia poder' });
    expect(res.status).toBe(404);
  });

  it('los dos tutores ven el registro en su bandeja de pendientes', async () => {
    for (const token of [await tokenDe('tutor'), await tokenComunitario()]) {
      const res = await api().get('/api/bitacoras/pendientes').set(auth(token));
      expect(res.status).toBe(200);
      const ids = (res.body.pendientes as { id: string }[]).map((p) => p.id);
      expect(ids).toContain(datos.bitacoraPendiente);
    }
  });

  it('el tutor ajeno no ve nada en su bandeja', async () => {
    const res = await api()
      .get('/api/bitacoras/pendientes')
      .set(auth(await tokenDeCorreo('tutorbeta@test.local')));
    expect(res.status).toBe(200);
    expect(res.body.pendientes).toHaveLength(0);
  });
});

describe('alcance de los dos tutores en el resto de la API', () => {
  it('los dos ven el proyecto en el listado de grupos', async () => {
    for (const token of [await tokenDe('tutor'), await tokenComunitario()]) {
      const res = await api().get('/api/grupos').set(auth(token));
      expect(res.status).toBe(200);
      const ids = (res.body.grupos as { idGrupo: string }[]).map((g) => g.idGrupo);
      expect(ids).toContain(datos.grupo);
    }
  });

  it('los dos abren el detalle del proyecto', async () => {
    for (const token of [await tokenDe('tutor'), await tokenComunitario()]) {
      const res = await api().get(`/api/grupos/${datos.grupo}`).set(auth(token));
      expect(res.status).toBe(200);
    }
  });

  it('los dos bajan el acta de su grupo y el ajeno no', async () => {
    for (const token of [await tokenDe('tutor'), await tokenComunitario()]) {
      const res = await api().get(`/api/reportes/acta/${datos.grupo}.pdf`).set(auth(token));
      expect(res.status).toBe(200);
    }
    const ajeno = await api()
      .get(`/api/reportes/acta/${datos.grupo}.pdf`)
      .set(auth(await tokenDeCorreo('tutorbeta@test.local')));
    expect(ajeno.status).toBe(403);
  });

  it('el dashboard del tutor comunitario cuenta su proyecto', async () => {
    const res = await api().get('/api/dashboard').set(auth(await tokenComunitario()));
    expect(res.status).toBe(200);
    expect(res.body.rol).toBe('tutor');
    expect(res.body.resumen.proyectos).toBe(1);
  });
});

describe('el acta nombra a los dos tutores', () => {
  it('trae el academico y el comunitario', async () => {
    const acta = await obtenerDatosActa(datos.grupo);
    expect(acta).not.toBeNull();
    expect(acta!.grupo.tutorAcademicoNombre).toBe('Tutor Alfa');
    expect(acta!.grupo.tutorComunitarioNombre).toBe('Tutor Comunitario');
  });
});

describe('alta de tutores', () => {
  const base = {
    nombreCompleto: 'Tutor Nuevo',
    cedula: 'V-31.222.333',
    email: 'tutor.nuevo@test.local',
    password: 'claveSegura123',
    rol: 'tutor' as const,
  };

  it('exige el tipo cuando el rol es tutor', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('admin')))
      .send(base);
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('tipoTutor');
  });

  it('crea un tutor comunitario y lo devuelve con su tipo', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('admin')))
      .send({ ...base, tipoTutor: 'comunitario' });
    expect(res.status).toBe(201);
    expect(res.body.usuario.tipoTutor).toBe('comunitario');
  });

  it('rechaza un tipo de tutor en una cuenta que no es tutor', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('admin')))
      .send({ ...base, rol: 'estudiante', tipoTutor: 'academico' });
    expect(res.status).toBe(400);
  });
});

describe('asignacion de tutores a un proyecto', () => {
  const nuevo = (extra: Record<string, unknown>) => ({
    nombreProyecto: 'Proyecto con dos tutores',
    periodoId: datos.periodo,
    coordinadorId: datos.coordinador,
    estado: 'en_curso',
    integrantesIds: [],
    ...extra,
  });

  it('acepta un academico y un comunitario', async () => {
    const res = await api()
      .post('/api/grupos')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevo({ tutorAcademicoId: datos.tutorB, tutorComunitarioId: datos.tutorComunitario }));
    expect(res.status).toBe(201);
    expect(res.body.grupo.tutorAcademicoNombre).toBe('Tutor Beta');
    expect(res.body.grupo.tutorComunitarioNombre).toBe('Tutor Comunitario');
  });

  it('no deja poner un tutor comunitario en el puesto academico', async () => {
    const res = await api()
      .post('/api/grupos')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevo({ tutorAcademicoId: datos.tutorComunitario }));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Tutor Acad');
  });

  it('no deja a la misma persona en los dos puestos', async () => {
    const res = await api()
      .post('/api/grupos')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevo({ tutorAcademicoId: datos.tutorB, tutorComunitarioId: datos.tutorB }));
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('personas distintas');
  });

  it('sigue permitiendo crear un proyecto sin tutores', async () => {
    const res = await api()
      .post('/api/grupos')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevo({}));
    expect(res.status).toBe(201);
  });
});
