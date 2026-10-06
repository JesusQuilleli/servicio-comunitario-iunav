import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  PASSWORD_SEMILLA,
  type DatosSemilla,
} from './helpers/db.js';
import { MIN_PASSWORD, generarPasswordTemporal } from '../src/lib/password.js';

/**
 * Contrasenas: cambio propio y restablecimiento por el administrador.
 *
 * El punto que mas importa es el bloqueo por clave temporal: un token con la
 * marca `tmp` solo debe poder cambiar la clave, nada mas. Si ese filtro falla,
 * un usuario con clave temporal podria leer las bitacoras de los demas.
 */

const ESTUDIANTE = 'estudianteana@test.local';

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

/** Login con una contrasena concreta; `null` si no es esa. */
async function login(email: string, password: string): Promise<string | null> {
  const res = await api().post('/api/auth/login').send({ email, password });
  return res.status === 200 ? (res.body.token as string) : null;
}

/** El admin restablece la clave de un usuario y devuelve la temporal generada. */
async function restablecer(idUsuario: string): Promise<string> {
  const res = await api()
    .post(`/api/usuarios/${idUsuario}/password`)
    .set(auth(await tokenDe('admin')));
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body.passwordTemporal as string;
}

describe('restablecimiento de contrasena por el administrador', () => {
  it('genera una clave temporal que sirve para entrar', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.estudianteA}/password`)
      .set(auth(await tokenDe('admin')));

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.passwordTemporal.length).toBeGreaterThanOrEqual(MIN_PASSWORD);
    expect(res.body.usuario.passwordTemporal).toBe(true);

    // La clave antigua deja de servir y la nueva sí.
    expect(await login(ESTUDIANTE, PASSWORD_SEMILLA)).toBeNull();
    expect(await login(ESTUDIANTE, res.body.passwordTemporal)).not.toBeNull();
  });

  it('el token con clave temporal no accede a nada mas', async () => {
    const token = await login(ESTUDIANTE, await restablecer(datos.estudianteA));
    expect(token).not.toBeNull();

    const rutas: [string, string][] = [
      ['GET', '/api/dashboard'],
      ['GET', '/api/bitacoras/mias'],
      ['GET', '/api/usuarios'],
      ['GET', `/api/grupos/${datos.grupo}`],
      ['GET', '/api/configuracion'],
      ['GET', '/api/periodos'],
    ];

    for (const [metodo, ruta] of rutas) {
      const res = await (metodo === 'GET'
        ? api().get(ruta)
        : api().post(ruta)
      ).set(auth(token as string));
      expect(res.status, `${metodo} ${ruta}`).toBe(403);
      expect(res.body.code).toBe('PASSWORD_TEMPORAL');
    }
  });

  it('el token con clave temporal tampoco descarga archivos', async () => {
    const subida = await api()
      .post(`/api/usuarios/${datos.estudianteA}/firma`)
      .set(auth(await tokenDe('estudiante')))
      .attach('archivo', Buffer.from('89504e470d0a1a0a0000000d494844520000000100000001', 'hex'), {
        filename: 'firma.png',
        contentType: 'image/png',
      });
    const ruta = subida.body.usuario.firmaUrl as string;

    const token = await login(ESTUDIANTE, await restablecer(datos.estudianteA));
    const res = await api().get(`/api/archivos/${ruta}`).set(auth(token as string));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_TEMPORAL');
  });

  it('el login y el perfil avisan de que la clave es temporal', async () => {
    const temporal = await restablecer(datos.estudianteA);

    const loginRes = await api().post('/api/auth/login').send({ email: ESTUDIANTE, password: temporal });
    expect(loginRes.body.usuario.passwordTemporal).toBe(true);

    // `/auth/me` queda exento del bloqueo: es de donde sale la propia sesion.
    const perfil = await api().get('/api/auth/me').set(auth(loginRes.body.token));
    expect(perfil.status).toBe(200);
    expect(perfil.body.usuario.passwordTemporal).toBe(true);
  });

  it('cada reset genera una clave distinta', async () => {
    const primera = await restablecer(datos.estudianteA);
    const segunda = await restablecer(datos.estudianteA);
    expect(primera).not.toBe(segunda);
  });

  it('solo el administrador puede restablecer', async () => {
    for (const rol of ['coordinador', 'tutor', 'estudiante'] as const) {
      const res = await api()
        .post(`/api/usuarios/${datos.estudianteA}/password`)
        .set(auth(await tokenDe(rol)));
      expect(res.status, `rol ${rol}`).toBe(403);
    }
  });

  it('el administrador con clave temporal tampoco puede crear cuentas', async () => {
    // `/auth/register` no aplica el guard global del router, asi que este es el
    // unico punto donde se podria colar un alta con clave temporal.
    const temporal = await restablecer(datos.admin);
    const token = await login('admin@test.local', temporal);
    expect(token).not.toBeNull();

    const res = await api()
      .post('/api/auth/register')
      .set(auth(token as string))
      .send({
        nombreCompleto: 'Alta con clave temporal',
        cedula: 'V-12345678',
        email: 'alta-temporal@test.local',
        password: 'clave1234',
        rol: 'estudiante',
      });

    expect(res.status).toBe(403);
    expect(res.body.code).toBe('PASSWORD_TEMPORAL');
  });

  it('da 404 si el usuario no existe', async () => {
    const res = await api()
      .post('/api/usuarios/00000000-0000-0000-0000-000000000000/password')
      .set(auth(await tokenDe('admin')));
    expect(res.status).toBe(404);
  });
});

describe('cambio de contrasena por el usuario', () => {
  it('cambia la clave y devuelve un token utilizable', async () => {
    const res = await api()
      .patch('/api/auth/password')
      .set(auth(await tokenDe('estudiante')))
      .send({ passwordActual: PASSWORD_SEMILLA, passwordNueva: 'nuevaClave9' });

    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.usuario.passwordTemporal).toBe(false);
    expect(typeof res.body.token).toBe('string');

    expect(await login(ESTUDIANTE, 'nuevaClave9')).not.toBeNull();
    expect(await login(ESTUDIANTE, PASSWORD_SEMILLA)).toBeNull();

    const dashboard = await api().get('/api/dashboard').set(auth(res.body.token));
    expect(dashboard.status).toBe(200);
  });

  it('exige la contrasena actual', async () => {
    const res = await api()
      .patch('/api/auth/password')
      .set(auth(await tokenDe('estudiante')))
      .send({ passwordActual: 'noEsLaMia9', passwordNueva: 'nuevaClave9' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/actual no es correcta/i);
  });

  it('aplica la politica de contrasenas', async () => {
    const casos: [string, RegExp][] = [
      ['corta1', /al menos/i],
      ['sinnumeros', /número/i],
      ['12345678', /letra/i],
      ['a'.repeat(80), /72 caracteres/i],
    ];

    for (const [passwordNueva, esperado] of casos) {
      const res = await api()
        .patch('/api/auth/password')
        .set(auth(await tokenDe('estudiante')))
        .send({ passwordActual: PASSWORD_SEMILLA, passwordNueva });
      expect(res.status, `contrasena "${passwordNueva.slice(0, 12)}"`).toBe(400);
      expect(JSON.stringify(res.body)).toMatch(esperado);
    }
  });

  it('no admite repetir la contrasena actual', async () => {
    const res = await api()
      .patch('/api/auth/password')
      .set(auth(await tokenDe('estudiante')))
      .send({ passwordActual: PASSWORD_SEMILLA, passwordNueva: PASSWORD_SEMILLA });

    expect(res.status).toBe(400);
  });

  it('requiere autenticacion', async () => {
    const res = await api()
      .patch('/api/auth/password')
      .send({ passwordActual: PASSWORD_SEMILLA, passwordNueva: 'nuevaClave9' });
    expect(res.status).toBe(401);
  });

  it('tras cambiar desde clave temporal, el token nuevo ya no esta bloqueado', async () => {
    const temporal = await restablecer(datos.estudianteA);
    const tokenTemporal = await login(ESTUDIANTE, temporal);

    const cambio = await api()
      .patch('/api/auth/password')
      .set(auth(tokenTemporal as string))
      .send({ passwordActual: temporal, passwordNueva: 'propia9segura' });

    expect(cambio.status, JSON.stringify(cambio.body)).toBe(200);

    const dashboard = await api().get('/api/dashboard').set(auth(cambio.body.token));
    expect(dashboard.status).toBe(200);
  });
});

describe('generador de clave temporal', () => {
  it('respeta la politica de contrasenas', () => {
    for (let i = 0; i < 200; i += 1) {
      const clave = generarPasswordTemporal();
      expect(clave.length).toBeGreaterThanOrEqual(MIN_PASSWORD);
      expect(clave).toMatch(/[a-zA-Z]/);
      expect(clave).toMatch(/[0-9]/);
    }
  });

  it('no se repite en 100 generaciones', () => {
    const claves = new Set(Array.from({ length: 100 }, () => generarPasswordTemporal()));
    expect(claves.size).toBe(100);
  });
});

describe('registro de usuarios', () => {
  it('aplica la politica tambien al crear la cuenta', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('admin')))
      .send({
        nombreCompleto: 'Persona Nueva',
        cedula: 'V-00009999',
        email: 'nueva@test.local',
        password: 'corta',
        rol: 'estudiante',
      });

    expect(res.status).toBe(400);
  });

  it('crea la cuenta con una clave valida y sin marca de temporal', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('admin')))
      .send({
        nombreCompleto: 'Persona Nueva',
        cedula: 'V-00009999',
        email: 'nueva@test.local',
        password: 'primeraClave9',
        rol: 'estudiante',
      });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.usuario.passwordTemporal).toBe(false);
    expect(await login('nueva@test.local', 'primeraClave9')).not.toBeNull();
  });
});

describe('no se filtran datos sensibles', () => {
  it('el listado de usuarios no expone el hash', async () => {
    const res = await api().get('/api/usuarios').set(auth(await tokenDe('admin')));
    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/password_hash|passwordHash/);
  });
});