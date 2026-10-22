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
 * Paginacion server-side de los cuatro listados (`?pagina=` y `?porPagina=`).
 *
 * Cada `it` reseedea la base (`sembrar()` hace truncate + insert), asi que los
 * totales son deterministicos: 9 usuarios, 1 grupo, 1 bitacora propia y 1
 * pendiente del tutor. Con `porPagina` pequeno se comprueba el troceado real
 * sin tener que crear datos a mano.
 */
let datos: DatosSemilla;

const USUARIOS_SEMILLA = 9;

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

describe('GET /api/usuarios paginado', () => {
  it('sin query devuelve la primera pagina y conserva la clave heredada', async () => {
    const res = await api().get('/api/usuarios').set(auth(await tokenDe('admin')));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(20);
    expect(res.body.total).toBe(USUARIOS_SEMILLA);
    expect(res.body.items).toHaveLength(USUARIOS_SEMILLA);
    // Retrocompatibilidad: `usuarios` sigue ahi y es la misma pagina.
    expect(res.body.usuarios).toEqual(res.body.items);
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash/);
  });

  it('trocea en paginas de porPagina sin repetir ni perder filas', async () => {
    const token = await tokenDe('admin');
    const primera = await api().get('/api/usuarios?porPagina=4').set(auth(token));
    const segunda = await api().get('/api/usuarios?porPagina=4&pagina=2').set(auth(token));
    const tercera = await api().get('/api/usuarios?porPagina=4&pagina=3').set(auth(token));

    expect([primera.status, segunda.status, tercera.status]).toEqual([200, 200, 200]);
    expect(primera.body.items).toHaveLength(4);
    expect(segunda.body.items).toHaveLength(4);
    expect(tercera.body.items).toHaveLength(1);
    expect(segunda.body.pagina).toBe(2);
    expect(segunda.body.porPagina).toBe(4);
    for (const pagina of [primera, segunda, tercera]) {
      expect(pagina.body.total).toBe(USUARIOS_SEMILLA);
    }

    const ids = [...primera.body.items, ...segunda.body.items, ...tercera.body.items].map(
      (u: { idUsuario: string }) => u.idUsuario
    );
    expect(new Set(ids).size).toBe(USUARIOS_SEMILLA);
  });

  it('una pagina fuera de rango responde 200 con items vacio y el total correcto', async () => {
    const res = await api().get('/api/usuarios?pagina=99').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.usuarios).toEqual([]);
    expect(res.body.total).toBe(USUARIOS_SEMILLA);
    expect(res.body.pagina).toBe(99);
  });

  it('recorta porPagina al tope de 100 en vez de rechazarlo', async () => {
    const res = await api().get('/api/usuarios?porPagina=500').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(200);
    expect(res.body.porPagina).toBe(100);
    expect(res.body.items).toHaveLength(USUARIOS_SEMILLA);
    expect(res.body.total).toBe(USUARIOS_SEMILLA);
  });

  it('rechaza pagina=0 con el 400 de Zod', async () => {
    const res = await api().get('/api/usuarios?pagina=0').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Datos inválidos');
    expect(res.body.errores[0]).toMatchObject({ campo: 'pagina' });
  });

  it('rechaza un pagina negativo con el 400 de Zod', async () => {
    const res = await api().get('/api/usuarios?pagina=-3').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Datos inválidos');
    expect(res.body.errores[0]).toMatchObject({ campo: 'pagina' });
  });

  it('rechaza porPagina=0 con el 400 de Zod', async () => {
    const res = await api().get('/api/usuarios?porPagina=0').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(400);
    expect(res.body.errores[0]).toMatchObject({ campo: 'porPagina' });
  });

  it('rechaza un porPagina no numerico con el 400 de Zod', async () => {
    const res = await api().get('/api/usuarios?porPagina=abc').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Datos inválidos');
    expect(res.body.errores[0]).toMatchObject({ campo: 'porPagina' });
  });
});

describe('GET /api/grupos paginado', () => {
  it('sin query devuelve la primera pagina con la clave heredada', async () => {
    const res = await api().get('/api/grupos').set(auth(await tokenDe('tutor')));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(20);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.grupos).toEqual(res.body.items);
    expect(res.body.items[0].idGrupo).toBe(datos.grupo);
  });

  it('mantiene los filtros existentes junto a la paginacion', async () => {
    const token = await tokenDe('admin');
    const enCurso = await api().get('/api/grupos?estado=en_curso&porPagina=1').set(auth(token));
    const suspendidos = await api().get('/api/grupos?estado=suspendido').set(auth(token));

    expect(enCurso.status, JSON.stringify(enCurso.body)).toBe(200);
    expect(enCurso.body.total).toBe(1);
    expect(enCurso.body.items).toHaveLength(1);
    expect(suspendidos.status).toBe(200);
    expect(suspendidos.body.total).toBe(0);
    expect(suspendidos.body.items).toEqual([]);
  });

  it('una pagina fuera de rango no es un 404', async () => {
    const res = await api().get('/api/grupos?pagina=50').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(1);
  });

  it('rechaza un pagina decimal con el 400 de Zod', async () => {
    const res = await api().get('/api/grupos?pagina=1.5').set(auth(await tokenDe('admin')));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Datos inválidos');
    expect(res.body.errores[0]).toMatchObject({ campo: 'pagina' });
  });
});

describe('GET /api/bitacoras/mias paginado', () => {
  it('sin query devuelve la primera pagina y conserva registros', async () => {
    const res = await api().get('/api/bitacoras/mias').set(auth(await tokenDe('estudiante')));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(20);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.registros).toEqual(res.body.items);
    expect(res.body.items[0].id).toBe(datos.bitacoraPendiente);
  });

  it('una pagina fuera de rango devuelve items vacio con total correcto', async () => {
    const res = await api()
      .get('/api/bitacoras/mias?pagina=3')
      .set(auth(await tokenDe('estudiante')));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(1);
  });
});

describe('GET /api/bitacoras/pendientes paginado', () => {
  it('sin query devuelve la primera pagina y conserva pendientes', async () => {
    const res = await api().get('/api/bitacoras/pendientes').set(auth(await tokenDe('tutor')));

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.pagina).toBe(1);
    expect(res.body.porPagina).toBe(20);
    expect(res.body.total).toBe(1);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.pendientes).toEqual(res.body.items);
    expect(res.body.items[0].id).toBe(datos.bitacoraPendiente);
  });

  it('una pagina fuera de rango devuelve items vacio con total correcto', async () => {
    const res = await api()
      .get('/api/bitacoras/pendientes?pagina=2')
      .set(auth(await tokenDe('tutor')));

    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(1);
  });

  it('rechaza un porPagina negativo con el 400 de Zod', async () => {
    const res = await api()
      .get('/api/bitacoras/pendientes?porPagina=-1')
      .set(auth(await tokenDe('tutor')));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Datos inválidos');
    expect(res.body.errores[0]).toMatchObject({ campo: 'porPagina' });
  });
});
