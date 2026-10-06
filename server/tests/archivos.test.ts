import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { readFile, rm, access } from 'node:fs/promises';
import path from 'node:path';
import { api, auth, tokenDe, tokenDeCorreo } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';

/**
 * Archivos, edicion de bitacora y metas 90/30.
 *
 * Estos casos no entran en la matriz de `permisos.test.ts` porque el archivo que
 * descargan tiene que existir de verdad en disco: un `404` alli significaria
 * "aun no hay evidencia", no "no tiene permiso".
 */

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082',
  'hex'
);

let datos: DatosSemilla;
let raizSubidas: string;

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
  raizSubidas = path.resolve(process.cwd(), process.env.UPLOAD_DIR as string);
  await rm(raizSubidas, { recursive: true, force: true });
});

afterAll(async () => {
  await rm(raizSubidas, { recursive: true, force: true });
  await cerrarPool();
});

beforeEach(async () => {
  datos = await sembrar();
  await rm(raizSubidas, { recursive: true, force: true });
});

async function existe(relativo: string): Promise<boolean> {
  try {
    await access(path.join(raizSubidas, relativo));
    return true;
  } catch {
    return false;
  }
}

/** Crea una bitacora comunitaria con evidencia PNG y devuelve su ruta. */
async function crearConEvidencia(
  token: string,
  fecha = '2026-04-06'
): Promise<{ id: string; ruta: string }> {
  const res = await api()
    .post('/api/bitacoras')
    .set(auth(token))
    .field('tipo', 'comunitario')
    .field('fecha', fecha)
    .field('descripcion', 'Visita al comedor comunitario con evidencia')
    .field('horas', '3')
    .field('semana', '5')
    .field('idGrupo', datos.grupo)
    .attach('evidencia', PNG, { filename: 'cualquiero.png', contentType: 'image/png' });

  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { id: res.body.registro.id, ruta: res.body.registro.evidenciaUrl as string };
}

describe('subida de evidencia', () => {
  it('acepta multipart y guarda el archivo con nombre UUID del servidor', async () => {
    const token = await tokenDe('estudiante');
    const { ruta } = await crearConEvidencia(token);

    expect(ruta).toMatch(/^evidencias\/[0-9a-f-]{36}\.png$/);
    // El nombre que envio el cliente no aparece en ningun sitio.
    expect(ruta).not.toContain('cualquiero');
    expect(await existe(ruta)).toBe(true);

    const enDisco = await readFile(path.join(raizSubidas, ruta));
    expect(enDisco.equals(PNG)).toBe(true);
  });

  it('sigue aceptando JSON sin evidencia, para el cliente ya construido', async () => {
    const token = await tokenDe('estudiante');
    const res = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .send({
        tipo: 'social',
        fecha: '2026-04-06',
        descripcion: 'Jornada de salud sin foto',
        horas: 2,
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.registro.evidenciaUrl).toBeNull();
  });

  it('rechaza un tipo de archivo no permitido y no deja nada en disco', async () => {
    const token = await tokenDe('estudiante');
    const res = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'social')
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Intento con ejecutable')
      .field('horas', '2')
      .attach('evidencia', Buffer.from('MZ'), {
        filename: 'virus.exe',
        contentType: 'application/x-msdownload',
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no permitido/i);
    // Sin ruta guardada, el rollback no deja archivos huerfanos.
    await expect(existe('evidencias')).resolves.toBe(false);
  });

  it('no crea el registro cuando la evidencia es valida pero los datos no', async () => {
    const token = await tokenDe('estudiante');
    const res = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'social')
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Horas invalidas')
      .field('horas', '0')
      .attach('evidencia', PNG, { filename: 'evidencia.png', contentType: 'image/png' });

    // El cuerpo se valida antes de tocar el disco: no hay archivo huerfano.
    expect(res.status).toBe(400);
    await expect(existe('evidencias')).resolves.toBe(false);
  });
});

describe('descarga de archivos', () => {
  it('el estudiante descarga su propia evidencia', async () => {
    const token = await tokenDe('estudiante');
    const { ruta } = await crearConEvidencia(token);
    const [carpeta, nombre] = ruta.split('/');

    // `responseType('blob')` evita que superagent intente parsear el PNG.
    const res = await api()
      .get(`/api/archivos/${carpeta}/${nombre}`)
      .set(auth(token))
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(Buffer.from(res.body).equals(PNG)).toBe(true);
  });

it('el tutor descarga la evidencia de un estudiante de su grupo', async () => {
    const { ruta } = await crearConEvidencia(await tokenDe('estudiante'));
    const [carpeta, nombre] = ruta.split('/');

    // El token se pide antes de armar la peticion: anidar el login dentro de
    // `.set()` hace que el agente de supertest reutilice la conexion en mal
    // momento y la peticion salga sin cabecera.
    const tokenTutor = await tokenDe('tutor');
    const res = await api().get(`/api/archivos/${carpeta}/${nombre}`).set(auth(tokenTutor));

    expect(res.status).toBe(200);
  });

  it('el administrador y el coordinador tambien pueden verlo', async () => {
    const { ruta } = await crearConEvidencia(await tokenDe('estudiante'));
    const [carpeta, nombre] = ruta.split('/');

    for (const rol of ['admin', 'coordinador'] as const) {
      const res = await api().get(`/api/archivos/${carpeta}/${nombre}`).set(auth(await tokenDe(rol)));
      expect(res.status, `rol ${rol}`).toBe(200);
    }
  });

  it('otro estudiante recibe 404, no 403, para no confirmar que el archivo existe', async () => {
    const { ruta } = await crearConEvidencia(await tokenDe('estudiante'));
    const [carpeta, nombre] = ruta.split('/');

    const res = await api()
      .get(`/api/archivos/${carpeta}/${nombre}`)
      .set(auth(await tokenDeCorreo('estudiantebeto@test.local')));

    expect(res.status).toBe(404);
  });

  it('un estudiante de otro grupo tampoco lo abre', async () => {
    const { ruta } = await crearConEvidencia(await tokenDe('estudiante'));
    const [carpeta, nombre] = ruta.split('/');

    const res = await api()
      .get(`/api/archivos/${carpeta}/${nombre}`)
      .set(auth(await tokenDeCorreo('estudiantecarla@test.local')));

    expect(res.status).toBe(404);
  });

  it('un tutor que no supervisa al estudiante recibe 404', async () => {
    const { ruta } = await crearConEvidencia(await tokenDe('estudiante'));
    const [carpeta, nombre] = ruta.split('/');

    const res = await api()
      .get(`/api/archivos/${carpeta}/${nombre}`)
      .set(auth(await tokenDeCorreo('tutorbeta@test.local')));

    expect(res.status).toBe(404);
  });

  it('exige token', async () => {
    const { ruta } = await crearConEvidencia(await tokenDe('estudiante'));
    const [carpeta, nombre] = ruta.split('/');

    const res = await api().get(`/api/archivos/${carpeta}/${nombre}`);

    expect(res.status).toBe(401);
  });

  it('no se puede escapar de la carpeta con ..', async () => {
    const res = await api()
      .get('/api/archivos/evidencias/..%2F..%2F.env')
      .set(auth(await tokenDe('admin')));

    expect(res.status).toBe(404);
    expect(res.text ?? '').not.toContain('DATABASE_URL');
  });

  it('una carpeta fuera de la lista blanca da 404', async () => {
    const res = await api()
      .get('/api/archivos/secreto/9f1c2d3e-4a5b-4c6d-8e9f-0a1b2c3d4e5f.txt')
      .set(auth(await tokenDe('admin')));

    expect(res.status).toBe(404);
  });

  it('un nombre con forma distinta de UUID da 404 aunque exista en disco', async () => {
    const res = await api()
      .get('/api/archivos/evidencias/../../package.json')
      .set(auth(await tokenDe('admin')));

    expect(res.status).toBe(404);
  });
});

describe('edicion de la bitacora propia', () => {
  it('el estudiante cambia los campos y el registro vuelve a pendiente', async () => {
    const token = await tokenDe('estudiante');
    const { id, ruta } = await crearConEvidencia(token);

    const tutor = await tokenDe('tutor');
    const veredicto = await api()
      .patch(`/api/bitacoras/${id}/estado`)
      .set(auth(tutor))
      .send({ tipo: 'comunitario', estado: 'corregir', comentario: 'Falta el detalle' });
    expect(veredicto.status).toBe(200);

    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('fecha', '2026-04-08')
      .field('descripcion', 'Visita con el detalle que pidio el tutor')
      .field('horas', '5');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.registro.estado).toBe('pendiente');
    expect(res.body.registro.reiniciado).toBe(true);
    // Sin archivo nuevo, la evidencia se conserva.
    expect(res.body.registro.evidenciaUrl).toBe(ruta);
    expect(await existe(ruta)).toBe(true);

    const listado = await api().get('/api/bitacoras/mias').set(auth(token));
    const own = listado.body.registros.find((r: { id: string }) => r.id === id);
    expect(own.estado).toBe('pendiente');
    expect(own.comentarioTutor).toBeNull();
    expect(own.horas).toBe(5);
  });

  it('al reemplazar la evidencia se borra el archivo anterior', async () => {
    const token = await tokenDe('estudiante');
    const { id, ruta: rutaVieja } = await crearConEvidencia(token);
    expect(await existe(rutaVieja)).toBe(true);

    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Evidencia corregida')
      .field('horas', '3')
      .attach('evidencia', PNG, { filename: 'nueva.png', contentType: 'image/png' });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const rutaNueva = res.body.registro.evidenciaUrl as string;
    expect(rutaNueva).not.toBe(rutaVieja);
    expect(await existe(rutaNueva)).toBe(true);
    expect(await existe(rutaVieja)).toBe(false);
  });

  it('se puede quitar la evidencia', async () => {
    const token = await tokenDe('estudiante');
    const { id, ruta } = await crearConEvidencia(token);

    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Sin foto ahora')
      .field('horas', '3')
      .field('quitarEvidencia', 'true');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.registro.evidenciaUrl).toBeNull();
    expect(await existe(ruta)).toBe(false);
  });

  it('no deja el archivo nuevo huerfano si la edicion falla', async () => {
    const token = await tokenDe('estudiante');
    const { id } = await crearConEvidencia(token);

    // 24h + lo que ya hay ese dia supera el limite diario de 8.
    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Demasiadas horas')
      .field('horas', '24')
      .attach('evidencia', PNG, { filename: 'nueva.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
    await expect(existe('evidencias')).resolves.toBe(true);
    const archivos = await import('node:fs/promises').then((fs) =>
      fs.readdir(path.join(raizSubidas, 'evidencias'))
    );
    expect(archivos).toHaveLength(1);
  });

  it('no deja editar la bitacora de otro estudiante', async () => {
    const { id } = await crearConEvidencia(await tokenDe('estudiante'));

    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(await tokenDeCorreo('estudiantebeto@test.local')))
      .field('fecha', '2026-04-06')
      .field('descripcion', 'No es mio')
      .field('horas', '3');

    expect(res.status).toBe(404);
  });

  it('no deja editar un registro ya aprobado', async () => {
    const token = await tokenDe('estudiante');
    const { id } = await crearConEvidencia(token);
    const tutor = await tokenDe('tutor');

    await api()
      .patch(`/api/bitacoras/${id}/estado`)
      .set(auth(tutor))
      .send({ tipo: 'comunitario', estado: 'aprobado' });

    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Cambio despues de aprobar')
      .field('horas', '3');

    expect(res.status).toBe(409);
  });

  it('no deja cambiar el tipo del registro', async () => {
    const token = await tokenDe('estudiante');
    const { id } = await crearConEvidencia(token);

    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('tipo', 'social')
      .field('fecha', '2026-04-06')
      .field('descripcion', 'Quiero cambiarlo a social')
      .field('horas', '3');

    // Zod descarta los campos no declarados: el registro sigue siendo comunitario.
    expect(res.status).toBe(200);
    expect(res.body.registro.tipo).toBe('comunitario');
  });
});

describe('borrado de la bitacora propia', () => {
  it('borra el registro y su evidencia', async () => {
    const token = await tokenDe('estudiante');
    const { id, ruta } = await crearConEvidencia(token);

    const res = await api().delete(`/api/bitacoras/${id}`).set(auth(token));

    expect(res.status).toBe(204);
    expect(await existe(ruta)).toBe(false);
    const listado = await api().get('/api/bitacoras/mias').set(auth(token));
    expect(listado.body.registros.find((r: { id: string }) => r.id === id)).toBeUndefined();
  });

  it('no borra un registro aprobado', async () => {
    const token = await tokenDe('estudiante');
    const { id } = await crearConEvidencia(token);

    await api()
      .patch(`/api/bitacoras/${id}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado' });

    const res = await api().delete(`/api/bitacoras/${id}`).set(auth(token));

    expect(res.status).toBe(409);
  });

  it('no borra la bitacora de otro estudiante', async () => {
    const { id } = await crearConEvidencia(await tokenDe('estudiante'));

    const res = await api()
      .delete(`/api/bitacoras/${id}`)
      .set(auth(await tokenDeCorreo('estudiantebeto@test.local')));

    expect(res.status).toBe(404);
  });
});

describe('limite diario y metas 90/30', () => {
  it('GET /metas devuelve las tres reglas vigentes', async () => {
    const res = await api().get('/api/bitacoras/metas').set(auth(await tokenDe('estudiante')));

    expect(res.status).toBe(200);
    expect(res.body.metas).toMatchObject({ horasDirectas: 90, horasImpacto: 30, limiteDiario: 8 });
  });

  it('bloquea cuando el mismo dia se pasa del limite', async () => {
    const token = await tokenDe('estudiante');

    const primero = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'social')
      .field('fecha', '2026-04-07')
      .field('descripcion', 'Primera del dia')
      .field('horas', '6');
    expect(primero.status).toBe(201);

    const segundo = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'social')
      .field('fecha', '2026-04-07')
      .field('descripcion', 'Segunda del dia')
      .field('horas', '4');
    expect(segundo.status).toBe(400);
    expect(segundo.body.message).toMatch(/l[ií]mite diario/i);
  });

  it('la edicion excluye al propio registro del calculo diario', async () => {
    const token = await tokenDe('estudiante');
    const { id } = await crearConEvidencia(token, '2026-04-09');

    // Sube a 6h un dia que ya tiene 3h suyos: 3 - 3 + 6 = 6, dentro del limite.
    const res = await api()
      .patch(`/api/bitacoras/${id}`)
      .set(auth(token))
      .field('fecha', '2026-04-09')
      .field('descripcion', 'Mas horas el mismo dia')
      .field('horas', '6');

    expect(res.status, JSON.stringify(res.body)).toBe(200);
  });

  it('bloquea al pasar de la meta de trabajo directo, contando solo aprobado', async () => {
    const { pool } = await import('../src/db/pool.js');
    // Meta recortada para la prueba: 5h ya aprobadas y meta de 6h.
    await pool.query('update configuracion_sistema set horas_directas = 6');
    await pool.query(
      `update bitacoras_comunitario set horas_invertidas = 5, estado = 'aprobado'
        where id_bitacora = $1`,
      [datos.bitacoraPendiente]
    );

    const res = await api()
      .post('/api/bitacoras')
      .set(auth(await tokenDe('estudiante')))
      .field('tipo', 'comunitario')
      .field('fecha', '2026-04-10')
      .field('descripcion', 'Dos horas mas')
      .field('horas', '2')
      .field('semana', '6')
      .field('idGrupo', datos.grupo);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/meta de trabajo directo/i);
  });

  it('las horas pendientes todavia no cuentan para la meta', async () => {
    const token = await tokenDe('estudiante');

    // 4h pendientes + 4h pendientes = 8h en registros no validados: la meta de 90
    // esta lejos, asi que el limite que muerde es el diario, no el de la meta.
    const res = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'comunitario')
      .field('fecha', '2026-04-11')
      .field('descripcion', 'Trabajo directo del dia')
      .field('horas', '8')
      .field('semana', '7')
      .field('idGrupo', datos.grupo);

    expect(res.status).toBe(201);
  });

  it('las metas de impacto cuentan la tabla de servicios, no la de trabajo directo', async () => {
    const { pool } = await import('../src/db/pool.js');
    await pool.query('update configuracion_sistema set horas_impacto = 2');

    // 5h aprobadas de trabajo directo no deben comer la meta de 2h de impacto.
    await pool.query(
      `update bitacoras_comunitario set horas_invertidas = 5, estado = 'aprobado'
        where id_bitacora = $1`,
      [datos.bitacoraPendiente]
    );

    const token = await tokenDe('estudiante');
    const ok = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'ambiental')
      .field('fecha', '2026-04-12')
      .field('descripcion', 'Jornada de siembra')
      .field('horas', '2');
    expect(ok.status).toBe(201);

    // Mientras siga `pendiente` no cuenta: la meta de 2h permite otra mas.
    const aunPendiente = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'ambiental')
      .field('fecha', '2026-04-13')
      .field('descripcion', 'Otra jornada')
      .field('horas', '1');
    expect(aunPendiente.status).toBe(201);

    // Al aprobarla, las 2h ya cuentan y una hora mas se pasa de la meta.
    await api()
      .patch(`/api/bitacoras/${ok.body.registro.id}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'ambiental', estado: 'aprobado' });

    const excedido = await api()
      .post('/api/bitacoras')
      .set(auth(token))
      .field('tipo', 'ambiental')
      .field('fecha', '2026-04-14')
      .field('descripcion', 'Tercera jornada')
      .field('horas', '1');
    expect(excedido.status).toBe(400);
    expect(excedido.body.message).toMatch(/impacto social o ambiental/i);
  });

  it('no acepta fecha futura', async () => {
    const manana = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    const res = await api()
      .post('/api/bitacoras')
      .set(auth(await tokenDe('estudiante')))
      .send({ tipo: 'social', fecha: manana, descripcion: 'Actividad del mañana', horas: 2 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/futura/i);
  });
});