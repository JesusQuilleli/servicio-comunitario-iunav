import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { api, auth, CORREOS, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  PASSWORD_SEMILLA,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';

let datos: DatosSemilla;

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
});

beforeEach(async () => {
  datos = await sembrar();
});

afterAll(async () => {
  await cerrarPool();
});

describe('POST /api/auth/login', () => {
  it('devuelve token y usuario con credenciales validas', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: CORREOS.admin, password: PASSWORD_SEMILLA });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.usuario.email).toBe(CORREOS.admin);
    expect(res.body.usuario.rol).toBe('admin');
    // El hash nunca debe salir por la API.
    expect(res.body.usuario.password_hash).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$2');
  });

  it('rechaza contrasena incorrecta con 401', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: CORREOS.estudiante, password: 'no-es-la-clave' });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Credenciales incorrectas');
  });

  it('rechaza correo inexistente con el mismo mensaje que una contrasena mala', async () => {
    const inexistente = await api()
      .post('/api/auth/login')
      .send({ email: 'nadie@test.local', password: PASSWORD_SEMILLA });

    const contrasenaMala = await api()
      .post('/api/auth/login')
      .send({ email: CORREOS.estudiante, password: 'no-es-la-clave' });

    expect(inexistente.status).toBe(401);
    // No debe revelar si el correo existe o no.
    expect(inexistente.body.message).toBe(contrasenaMala.body.message);
  });

  it('rechaza correo malformado con 400 señalando el campo', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'no-es-un-correo', password: 'x' });

    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'email' })])
    );
  });

  it('rechaza contrasena vacia con 400', async () => {
    const res = await api().post('/api/auth/login').send({ email: CORREOS.estudiante, password: '' });

    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'password' })])
    );
  });

  it('bloquea el acceso a una cuenta desactivada con 403', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'inactivo@test.local', password: PASSWORD_SEMILLA });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/desactivada/i);
  });

  it('el correo no distingue mayusculas', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: CORREOS.estudiante.toUpperCase(), password: PASSWORD_SEMILLA });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/auth/me', () => {
  it('devuelve el usuario del token', async () => {
    const token = await tokenDe('tutor');
    const res = await api().get('/api/auth/me').set(auth(token));

    expect(res.status).toBe(200);
    expect(res.body.usuario.rol).toBe('tutor');
  });

  it('exige token: 401 sin cabecera', async () => {
    const res = await api().get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rechaza un token con firma manipulada', async () => {
    const token = await tokenDe('admin');
    const partes = token.split('.');
    const falsificado = `${partes[0]}.${partes[1]}.${'a'.repeat(partes[2].length)}`;

    const res = await api().get('/api/auth/me').set(auth(falsificado));
    expect(res.status).toBe(401);
  });

  it('rechaza un token que dice admin pero fue firmado como estudiante', async () => {
    const tokenEstudiante = await tokenDe('estudiante');
    const [, payload] = tokenEstudiante.split('.');
    const alterado = Buffer.from(
      JSON.stringify({ sub: datos.admin, rol: 'admin', iat: 1, exp: 9_999_999_999 })
    ).toString('base64url');

    const res = await api().get('/api/auth/me').set(auth(`${tokenEstudiante.split('.')[0]}.${alterado}.${payload}`));
    expect(res.status).toBe(401);
  });
});

describe('POST /api/auth/register', () => {
  const nuevo = {
    nombreCompleto: 'Persona Nueva',
    cedula: 'V-11111111',
    email: 'nueva@test.local',
    password: 'clave1234',
    rol: 'estudiante',
  };

  it('el administrador puede crear un usuario', async () => {
    const token = await tokenDe('admin');
    const res = await api().post('/api/auth/register').set(auth(token)).send(nuevo);

    expect(res.status).toBe(201);
    expect(res.body.usuario.email).toBe('nueva@test.local');
    expect(res.body.usuario.password_hash).toBeUndefined();
  });

  it('rechaza correo duplicado con 409', async () => {
    const token = await tokenDe('admin');
    const res = await api()
      .post('/api/auth/register')
      .set(auth(token))
      .send({ ...nuevo, email: CORREOS.estudiante });

    expect(res.status).toBe(409);
  });

  it('rechaza contrasena corta con 400', async () => {
    const token = await tokenDe('admin');
    const res = await api()
      .post('/api/auth/register')
      .set(auth(token))
      .send({ ...nuevo, password: '123' });

    expect(res.status).toBe(400);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([expect.objectContaining({ campo: 'password' })])
    );
  });

  it('rechaza un rol fuera del catalogo con 400', async () => {
    const token = await tokenDe('admin');
    const res = await api()
      .post('/api/auth/register')
      .set(auth(token))
      .send({ ...nuevo, rol: 'superusuario' });

    expect(res.status).toBe(400);
  });

  it('no permite registrarse sin token', async () => {
    const res = await api().post('/api/auth/register').send(nuevo);
    expect(res.status).toBe(401);
  });
});
