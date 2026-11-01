import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { Transporter } from 'nodemailer';
import { api, auth, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';
import { pool } from '../src/db/pool.js';
import { usarTransporte } from '../src/lib/correo.js';
import { env } from '../src/config/env.js';

/**
 * Modulo de notificaciones.
 *
 * Lo que se vigila aqui NO es que el correo salga bonito, sino el invariante
 * que lo hace seguro: **un servidor de correo caido no puede deshacer lo que el
 * usuario acaba de hacer**. Dar de alta a un estudiante, validarle unas horas o
 * cerrar un proyecto tienen que quedar guardados aunque el envio falle.
 *
 * El transporte real se sustituye por uno falso: las pruebas no abren
 * conexiones SMTP.
 */

interface CorreoEnviado {
  to: string;
  subject: string;
  html: string;
}

let enviados: CorreoEnviado[] = [];
let fallarEnvio = false;

/** Transporte falso: anota lo que le piden mandar y puede fingir una caida. */
function transporteFalso(): Transporter {
  return {
    async sendMail(opciones: { to: string; subject: string; html: string }) {
      if (fallarEnvio) {
        throw new Error('ECONNREFUSED: el servidor de correo no responde');
      }
      enviados.push({ to: opciones.to, subject: opciones.subject, html: opciones.html });
      return { messageId: 'prueba' };
    },
  } as unknown as Transporter;
}

/**
 * `enviarNotificacion` se lanza sin esperarlo (`void`) para no bloquear la
 * respuesta HTTP en un SMTP lento, asi que hay que darle un respiro antes de
 * mirar la cola.
 */
async function dejarQueSalgaElCorreo(): Promise<void> {
  await new Promise((r) => setTimeout(r, 120));
}

async function colaDe(tipo: string): Promise<{ estado: string; error: string | null }[]> {
  const { rows } = await pool.query<{ estado: string; error: string | null }>(
    'select estado, error from notificaciones where tipo = $1 order by creado_en asc',
    [tipo]
  );
  return rows;
}

let datos: DatosSemilla;

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
  // `correoConfigurado()` mira esto: sin host, el modulo ni lo intenta.
  env.smtpHost = 'smtp.pruebas.local';
  env.smtpDesde = 'no-responder@iunav.edu.ve';
});

afterAll(async () => {
  usarTransporte(null);
  env.smtpHost = '';
  await cerrarPool();
});

beforeEach(async () => {
  datos = await sembrar();
  // El seed deja un aviso ya encolado (lo necesita la matriz de permisos para
  // probar el reintento). Aqui estorba: casi todo lo que se mide son conteos de
  // la cola, asi que se parte de cero.
  await pool.query('delete from notificaciones');
  enviados = [];
  fallarEnvio = false;
  usarTransporte(transporteFalso());
});

afterEach(() => {
  usarTransporte(null);
});

const nuevoEstudiante = {
  nombreCompleto: 'Estudiante Notificado',
  cedula: 'V-33.444.555',
  email: 'notificado@test.local',
  password: 'claveSegura123',
  rol: 'estudiante' as const,
};

describe('correo de bienvenida al dar de alta', () => {
  it('manda la clave temporal a la cuenta nueva', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    expect(res.status).toBe(201);
    await dejarQueSalgaElCorreo();

    expect(enviados).toHaveLength(1);
    expect(enviados[0].to).toBe('notificado@test.local');
    expect(enviados[0].subject).toContain('cuenta');
    // La clave va en el cuerpo: es el unico canal para entregarla.
    expect(enviados[0].html).toContain('claveSegura123');
    expect(enviados[0].html).toContain('Estudiante Notificado');
  });

  it('la cuenta nace con la clave marcada como temporal', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    expect(res.body.usuario.passwordTemporal).toBe(true);
  });

  it('deja el aviso como enviado en la cola', async () => {
    await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    await dejarQueSalgaElCorreo();

    const cola = await colaDe('bienvenida');
    expect(cola).toHaveLength(1);
    expect(cola[0].estado).toBe('enviada');
  });
});

describe('un fallo de correo no deshace la operacion', () => {
  it('el alta se guarda aunque el SMTP este caido', async () => {
    fallarEnvio = true;

    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);

    // Lo que importa: 201, no 500.
    expect(res.status).toBe(201);
    await dejarQueSalgaElCorreo();

    // Y la cuenta existe de verdad: se puede entrar con ella.
    const login = await api()
      .post('/api/auth/login')
      .send({ email: nuevoEstudiante.email, password: nuevoEstudiante.password });
    expect(login.status).toBe(200);

    const cola = await colaDe('bienvenida');
    expect(cola[0].estado).toBe('fallida');
    expect(cola[0].error).toContain('ECONNREFUSED');
  });

  it('la validacion de horas se guarda aunque el correo falle', async () => {
    fallarEnvio = true;

    const res = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado', comentario: 'Visto bueno' });
    expect(res.status).toBe(200);
    await dejarQueSalgaElCorreo();

    const { rows } = await pool.query<{ estado: string }>(
      'select estado from bitacoras_comunitario where id_bitacora = $1',
      [datos.bitacoraPendiente]
    );
    expect(rows[0].estado).toBe('aprobado');
  });
});

describe('avisos de avance', () => {
  it('avisa al estudiante cuando le aprueban horas', async () => {
    await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado', comentario: 'Buen trabajo' });
    await dejarQueSalgaElCorreo();

    const aviso = enviados.find((e) => e.subject.includes('aprobadas'));
    expect(aviso).toBeDefined();
    expect(aviso?.to).toBe('estudianteana@test.local');
  });

  it('avisa tambien cuando le piden corregir, con el comentario', async () => {
    await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'corregir', comentario: 'Falta la evidencia' });
    await dejarQueSalgaElCorreo();

    const aviso = enviados.find((e) => e.subject.includes('correcci'));
    expect(aviso).toBeDefined();
    expect(aviso?.html).toContain('Falta la evidencia');
  });

  it('felicita al cerrar una meta, y solo una vez', async () => {
    // 86h ya aprobadas + las 4 del registro pendiente = 90, la meta exacta.
    await pool.query(
      `insert into bitacoras_comunitario
         (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
       values ($1, $2, 1, '2026-02-01', 'Horas previas', 86, 'aprobado')`,
      [datos.estudianteA, datos.grupo]
    );

    // `comentario` es opcional pero no admite null: al aprobar simplemente no
    // se manda.
    const aprobacion = await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado' });
    expect(aprobacion.status, JSON.stringify(aprobacion.body)).toBe(200);
    await dejarQueSalgaElCorreo();

    expect(enviados.filter((e) => e.subject.includes('Completaste'))).toHaveLength(1);

    // Volver a aprobar el mismo registro no vuelve a felicitar: la meta ya
    // estaba cerrada antes de esta validacion.
    enviados = [];
    await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado' });
    await dejarQueSalgaElCorreo();
    expect(enviados.filter((e) => e.subject.includes('Completaste'))).toHaveLength(0);
  });

  it('no felicita cuando todavia falta para la meta', async () => {
    await api()
      .patch(`/api/bitacoras/${datos.bitacoraPendiente}/estado`)
      .set(auth(await tokenDe('tutor')))
      .send({ tipo: 'comunitario', estado: 'aprobado' });
    await dejarQueSalgaElCorreo();

    expect(enviados.filter((e) => e.subject.includes('Completaste'))).toHaveLength(0);
  });

  it('avisa a los integrantes al finalizar el proyecto', async () => {
    for (const id of [datos.estudianteA, datos.estudianteB, datos.integranteSinHoras]) {
      await pool.query(
        `insert into bitacoras_comunitario
           (id_estudiante, id_grupo, numero_semana, fecha_actividad, descripcion, horas_invertidas, estado)
         values ($1, $2, 1, '2026-02-01', 'Completas', 90, 'aprobado')`,
        [id, datos.grupo]
      );
      await pool.query(
        `insert into control_servicios_institucionales
           (id_estudiante, tipo, fecha_actividad, descripcion, horas_invertidas, estado)
         values ($1, 'social', '2026-02-02', 'Completas', 30, 'aprobado')`,
        [id]
      );
    }
    enviados = [];

    const res = await api()
      .patch(`/api/grupos/${datos.grupo}/estado`)
      .set(auth(await tokenDe('coordinador')))
      .send({ estado: 'finalizado' });
    expect(res.status).toBe(200);
    await dejarQueSalgaElCorreo();

    const cierres = enviados.filter((e) => e.subject.includes('finalizado'));
    expect(cierres).toHaveLength(3);
    expect(cierres[0].html).toContain('Grupo de prueba');
  });
});

describe('bandeja de salida', () => {
  it('el administrador la ve con su resumen', async () => {
    await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    await dejarQueSalgaElCorreo();

    const res = await api().get('/api/notificaciones').set(auth(await tokenDe('admin')));
    expect(res.status).toBe(200);
    expect(res.body.notificaciones).toHaveLength(1);
    expect(res.body.resumen.enviada).toBe(1);
    expect(res.body.correoConfigurado).toBe(true);
  });

  it('filtra por estado', async () => {
    fallarEnvio = true;
    await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    await dejarQueSalgaElCorreo();

    const res = await api()
      .get('/api/notificaciones?estado=fallida')
      .set(auth(await tokenDe('admin')));
    expect(res.body.notificaciones).toHaveLength(1);
    expect(res.body.notificaciones[0].estado).toBe('fallida');
  });

  it('reintenta un envio fallido y lo deja enviado', async () => {
    fallarEnvio = true;
    await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    await dejarQueSalgaElCorreo();

    fallarEnvio = false;
    const lista = await api().get('/api/notificaciones').set(auth(await tokenDe('admin')));
    const id = lista.body.notificaciones[0].idNotificacion;

    const res = await api()
      .post(`/api/notificaciones/${id}/reintentar`)
      .set(auth(await tokenDe('admin')))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.enviada).toBe(true);
    expect(res.body.notificacion.estado).toBe('enviada');
    expect(res.body.notificacion.intentos).toBe(2);
  });

  it('reintenta todas las pendientes de una vez', async () => {
    fallarEnvio = true;
    await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send({ ...nuevoEstudiante, cedula: 'V-33.444.666', email: 'otro@test.local' });
    await dejarQueSalgaElCorreo();

    fallarEnvio = false;
    const res = await api()
      .post('/api/notificaciones/reintentar-todas')
      .set(auth(await tokenDe('admin')))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.enviadas).toBe(2);
    expect(res.body.resumen.fallida).toBe(0);
  });

  it('devuelve 404 al reintentar algo que no existe', async () => {
    const res = await api()
      .post('/api/notificaciones/8f1b4a1e-0000-4000-8000-000000000000/reintentar')
      .set(auth(await tokenDe('admin')))
      .send({});
    expect(res.status).toBe(404);
  });
});

describe('sin servidor de correo configurado', () => {
  beforeEach(() => {
    env.smtpHost = '';
  });

  afterEach(() => {
    env.smtpHost = 'smtp.pruebas.local';
  });

  it('el alta funciona igual y el aviso queda en cola para despues', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set(auth(await tokenDe('coordinador')))
      .send(nuevoEstudiante);
    expect(res.status).toBe(201);
    await dejarQueSalgaElCorreo();

    expect(enviados).toHaveLength(0);
    const cola = await colaDe('bienvenida');
    expect(cola[0].estado).toBe('fallida');
    expect(cola[0].error).toContain('SMTP_HOST');
  });

  it('la bandeja lo dice en vez de mostrar fallos sin explicacion', async () => {
    const res = await api().get('/api/notificaciones').set(auth(await tokenDe('admin')));
    expect(res.body.correoConfigurado).toBe(false);
  });
});
