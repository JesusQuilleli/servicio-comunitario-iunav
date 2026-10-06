import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { access, readdir, rm } from 'node:fs/promises';
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
 * Documentos del proyecto, firma, sello y plantillas.
 *
 * Cada uno tiene su carpeta y su regla de permiso, asi que se prueban por
 * separado: no comparten codigo salvo el par `guardarArchivo` / `borrarArchivo`,
 * que ya cubre `archivos.test.ts`.
 */

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082',
  'hex'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');

let datos: DatosSemilla;
let raizSubidas: string;

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
  raizSubidas = path.resolve(process.cwd(), process.env.UPLOAD_DIR as string);
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

async function archivosEn(carpeta: string): Promise<string[]> {
  try {
    return (await readdir(path.join(raizSubidas, carpeta))).sort();
  } catch {
    return [];
  }
}

async function rutaEnBase(
  tabla: 'grupos_proyectos' | 'usuarios' | 'plantillas_documento',
  columna: string,
  id: string
): Promise<string | null> {
  const { pool } = await import('../src/db/pool.js');
  const clave =
    tabla === 'grupos_proyectos' ? 'id_grupo' : tabla === 'usuarios' ? 'id_usuario' : 'id_plantilla';
  const { rows } = await pool.query<{ valor: string | null }>(
    `select ${columna} as valor from ${tabla} where ${clave} = $1`,
    [id]
  );
  return rows[0]?.valor ?? null;
}

describe('documentos del proyecto', () => {
  it('el tutor sube el proyecto escrito y las diapositivas', async () => {
    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' })
      .attach('diapositivas', PDF, { filename: 'diapo.pdf', contentType: 'application/pdf' });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.grupo.proyectoEscritoUrl).toMatch(/^proyectos\/[0-9a-f-]{36}\.pdf$/);
    expect(res.body.grupo.diapositivasUrl).toMatch(/^proyectos\/[0-9a-f-]{36}\.pdf$/);
    expect(await archivosEn('proyectos')).toHaveLength(2);
  });

  it('acepta subir solo uno de los dos documentos', async () => {
    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('coordinador')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(201);
    expect(res.body.grupo.diapositivasUrl).toBeNull();
    expect(await archivosEn('proyectos')).toHaveLength(1);
  });

  it('exige al menos un archivo', async () => {
    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')));

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/al menos un archivo/i);
  });

  it('un tutor no puede subir documentos de un grupo que no tutoriza', async () => {
    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDeCorreo('tutorbeta@test.local')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    // El permiso se comprueba antes de escribir: no queda nada en disco.
    expect(await archivosEn('proyectos')).toHaveLength(0);
  });

  it('al reemplazar un documento se borra el anterior', async () => {
    const primero = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'v1.pdf', contentType: 'application/pdf' });
    const rutaVieja = primero.body.grupo.proyectoEscritoUrl as string;
    expect(await existe(rutaVieja)).toBe(true);

    const segundo = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'v2.pdf', contentType: 'application/pdf' });

    expect(segundo.status, JSON.stringify(segundo.body)).toBe(201);
    expect(await existe(rutaVieja)).toBe(false);
    expect(await archivosEn('proyectos')).toHaveLength(1);
  });

  it('editar el grupo no borra los documentos ya subidos', async () => {
    const subida = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' });
    const ruta = subida.body.grupo.proyectoEscritoUrl as string;

    const edicion = await api()
      .patch(`/api/grupos/${datos.grupo}`)
      .set(auth(await tokenDe('coordinador')))
      .send({
        nombreProyecto: 'Proyecto renombrado',
        estado: 'en_curso',
        integrantesIds: [datos.estudianteA],
      });

    expect(edicion.status, JSON.stringify(edicion.body)).toBe(200);
    expect(edicion.body.grupo.nombreProyecto).toBe('Proyecto renombrado');
    expect(edicion.body.grupo.proyectoEscritoUrl).toBe(ruta);
    expect(await existe(ruta)).toBe(true);
  });

  it('el estudiante no sube documentos del proyecto', async () => {
    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('estudiante')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(await archivosEn('proyectos')).toHaveLength(0);
  });
});

describe('firma y sello', () => {
  it('el usuario sube su propia firma', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.estudianteA}/firma`)
      .set(auth(await tokenDe('estudiante')))
      .attach('archivo', PNG, { filename: 'firma.png', contentType: 'image/png' });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.usuario.firmaUrl).toMatch(/^firmas\/[0-9a-f-]{36}\.png$/);
    expect(await archivosEn('firmas')).toHaveLength(1);
  });

  it('el admin sube la firma de otro usuario', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.tutorA}/firma`)
      .set(auth(await tokenDe('admin')))
      .attach('archivo', PNG, { filename: 'firma.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.usuario.firmaUrl).toMatch(/^firmas\//);
  });

  it('un estudiante no sube la firma de otro', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.estudianteB}/firma`)
      .set(auth(await tokenDe('estudiante')))
      .attach('archivo', PNG, { filename: 'firma.png', contentType: 'image/png' });

    expect(res.status).toBe(403);
    expect(await archivosEn('firmas')).toHaveLength(0);
  });

  it('la firma no puede ser un PDF', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.estudianteA}/firma`)
      .set(auth(await tokenDe('estudiante')))
      .attach('archivo', PDF, { filename: 'firma.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/solo se admiten imagenes/i);
    expect(await archivosEn('firmas')).toHaveLength(0);
  });

  it('reemplazar la firma borra la anterior', async () => {
    const token = await tokenDe('estudiante');
    const primero = await api()
      .post(`/api/usuarios/${datos.estudianteA}/firma`)
      .set(auth(token))
      .attach('archivo', PNG, { filename: 'a.png', contentType: 'image/png' });
    const rutaVieja = primero.body.usuario.firmaUrl as string;

    await api()
      .post(`/api/usuarios/${datos.estudianteA}/firma`)
      .set(auth(token))
      .attach('archivo', PNG, { filename: 'b.png', contentType: 'image/png' });

    expect(await existe(rutaVieja)).toBe(false);
    expect(await archivosEn('firmas')).toHaveLength(1);
  });

  it('el sello lo sube solo el administrador', async () => {
    const res = await api()
      .post(`/api/usuarios/${datos.coordinador}/sello`)
      .set(auth(await tokenDe('admin')))
      .attach('archivo', PNG, { filename: 'sello.png', contentType: 'image/png' });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.usuario.selloUrl).toMatch(/^sellos\//);
  });

  it('ni el coordinador ni el propio usuario pueden subir el sello', async () => {
    for (const rol of ['coordinador', 'tutor'] as const) {
      const res = await api()
        .post(`/api/usuarios/${datos.estudianteA}/sello`)
        .set(auth(await tokenDe(rol)))
        .attach('archivo', PNG, { filename: 'sello.png', contentType: 'image/png' });

      expect(res.status, `rol ${rol}`).toBe(403);
    }
    expect(await archivosEn('sellos')).toHaveLength(0);
  });

  it('el usuario descarga su propia firma, pero no el sello', async () => {
    const token = await tokenDe('estudiante');
    await api()
      .post(`/api/usuarios/${datos.estudianteA}/firma`)
      .set(auth(token))
      .attach('archivo', PNG, { filename: 'firma.png', contentType: 'image/png' });
    await api()
      .post(`/api/usuarios/${datos.estudianteA}/sello`)
      .set(auth(await tokenDe('admin')))
      .attach('archivo', PNG, { filename: 'sello.png', contentType: 'image/png' });

    const firma = (await rutaEnBase('usuarios', 'firma_url', datos.estudianteA)) as string;
    const sello = (await rutaEnBase('usuarios', 'sello_url', datos.estudianteA)) as string;

    const propia = await api().get(`/api/archivos/${firma}`).set(auth(token));
    expect(propia.status).toBe(200);

    const delSello = await api().get(`/api/archivos/${sello}`).set(auth(token));
    expect(delSello.status).toBe(403);
  });

  it('el tutor ve el documento de su grupo, no el de otro', async () => {
    const subida = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' });
    const ruta = subida.body.grupo.proyectoEscritoUrl as string;

    const suyo = await api().get(`/api/archivos/${ruta}`).set(auth(await tokenDe('tutor')));
    expect(suyo.status).toBe(200);

    const ajeno = await api()
      .get(`/api/archivos/${ruta}`)
      .set(auth(await tokenDeCorreo('tutorbeta@test.local')));
    expect(ajeno.status).toBe(404);
  });
});

describe('documento de plantilla', () => {
  it('la gestión adjunta el archivo de la plantilla', async () => {
    const res = await api()
      .post(`/api/configuracion/plantillas/${datos.plantilla}/documento`)
      .set(auth(await tokenDe('coordinador')))
      .attach('documento', PDF, { filename: 'plantilla.pdf', contentType: 'application/pdf' });

    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.plantilla.urlDocumento).toMatch(/^plantillas\/[0-9a-f-]{36}\.pdf$/);
    expect(await archivosEn('plantillas')).toHaveLength(1);
  });

  it('da 404 si la plantilla no existe y no deja archivos', async () => {
    const res = await api()
      .post('/api/configuracion/plantillas/999999/documento')
      .set(auth(await tokenDe('admin')))
      .attach('documento', PDF, { filename: 'plantilla.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(404);
    expect(await archivosEn('plantillas')).toHaveLength(0);
  });

  it('el estudiante no accede a las plantillas', async () => {
    const res = await api()
      .post(`/api/configuracion/plantillas/${datos.plantilla}/documento`)
      .set(auth(await tokenDe('estudiante')))
      .attach('documento', PDF, { filename: 'plantilla.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(403);
    expect(await archivosEn('plantillas')).toHaveLength(0);
  });

  it('al reemplazar el documento se borra el anterior', async () => {
    const primera = await api()
      .post(`/api/configuracion/plantillas/${datos.plantilla}/documento`)
      .set(auth(await tokenDe('admin')))
      .attach('documento', PDF, { filename: 'v1.pdf', contentType: 'application/pdf' });
    const rutaVieja = primera.body.plantilla.urlDocumento as string;
    expect(await existe(rutaVieja)).toBe(true);

    const segunda = await api()
      .post(`/api/configuracion/plantillas/${datos.plantilla}/documento`)
      .set(auth(await tokenDe('admin')))
      .attach('documento', PDF, { filename: 'v2.pdf', contentType: 'application/pdf' });

    expect(segunda.status, JSON.stringify(segunda.body)).toBe(201);
    expect(segunda.body.plantilla.urlDocumento).not.toBe(rutaVieja);
    expect(await existe(rutaVieja)).toBe(false);
    expect(await archivosEn('plantillas')).toHaveLength(1);

    // Y la columna apunta al archivo nuevo, no al borrado.
    expect(await rutaEnBase('plantillas_documento', 'url_documento', String(datos.plantilla))).toBe(
      segunda.body.plantilla.urlDocumento
    );
  });

  it('editar la plantilla no borra su documento', async () => {
    const subida = await api()
      .post(`/api/configuracion/plantillas/${datos.plantilla}/documento`)
      .set(auth(await tokenDe('admin')))
      .attach('documento', PDF, { filename: 'plantilla.pdf', contentType: 'application/pdf' });
    const ruta = subida.body.plantilla.urlDocumento as string;

    const edicion = await api()
      .patch(`/api/configuracion/plantillas/${datos.plantilla}`)
      .set(auth(await tokenDe('admin')))
      .send({ nombre: 'Plantilla renombrada', tipo: 'informe' });

    expect(edicion.status, JSON.stringify(edicion.body)).toBe(200);
    expect(edicion.body.plantilla.nombre).toBe('Plantilla renombrada');
    expect(edicion.body.plantilla.urlDocumento).toBe(ruta);
    expect(await existe(ruta)).toBe(true);
  });

  it('la plantilla no se puede descargar desde el rol estudiante', async () => {
    const subida = await api()
      .post(`/api/configuracion/plantillas/${datos.plantilla}/documento`)
      .set(auth(await tokenDe('admin')))
      .attach('documento', PDF, { filename: 'plantilla.pdf', contentType: 'application/pdf' });
    const ruta = subida.body.plantilla.urlDocumento as string;

    const delEstudiante = await api()
      .get(`/api/archivos/${ruta}`)
      .set(auth(await tokenDe('estudiante')));
    expect(delEstudiante.status).toBe(403);

    const deLaGestion = await api().get(`/api/archivos/${ruta}`).set(auth(await tokenDe('admin')));
    expect(deLaGestion.status).toBe(200);
  });
});