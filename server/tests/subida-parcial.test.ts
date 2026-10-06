import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { api, auth, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';
import { escribirRuta } from '../src/models/archivo.model.js';

const escribir = vi.mocked(escribirRuta);

/**
 * Fallos a mitad de una subida con dos archivos.
 *
 * Cuando se suben el proyecto escrito y las diapositivas en la misma peticion,
 * cada columna se escribe por separado. Si la segunda escritura falla, el
 * archivo de la primera ya esta referenciado en la fila del grupo: borrarlo
 * dejaria un registro apuntando a un archivo inexistente, que es peor que dejar
 * un archivo huerfano en disco.
 */

let llamadas: string[] = [];

vi.mock('../src/models/archivo.model.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/models/archivo.model.js')>();
  return {
    ...real,
    escribirRuta: vi.fn(
      async (tabla: string, id: string, columna: string, ruta: string): Promise<void> => {
        llamadas.push(columna);
        // La segunda columna es la que se rompe; la primera debe quedar escrita.
        if (columna === 'diapositivas_url') {
          throw new Error('la base de datos no responde');
        }
        await real.escribirRuta(
          tabla as Parameters<typeof real.escribirRuta>[0],
          id,
          columna as Parameters<typeof real.escribirRuta>[2],
          ruta
        );
      }
    ),
  };
});

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
  llamadas = [];
  escribir.mockClear();
  await rm(raizSubidas, { recursive: true, force: true });
});

async function existe(relativo: string | null): Promise<boolean> {
  if (!relativo) return false;
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

async function rutaEnBase(columna: string, id: string): Promise<string | null> {
  const { pool } = await import('../src/db/pool.js');
  const { rows } = await pool.query<{ valor: string | null }>(
    `select ${columna} as valor from grupos_proyectos where id_grupo = $1`,
    [id]
  );
  return rows[0]?.valor ?? null;
}

describe('subida parcial de documentos del grupo', () => {
  it('conserva el archivo ya referenciado y borra el que no llego a guardarse', async () => {
    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' })
      .attach('diapositivas', PDF, { filename: 'diapo.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(llamadas).toEqual(['proyecto_escrito_url', 'diapositivas_url']);

    const escrito = await rutaEnBase('proyecto_escrito_url', datos.grupo);
    const diapositivas = await rutaEnBase('diapositivas_url', datos.grupo);

    // La primera columna quedo escrita y su archivo sigue en disco.
    expect(escrito).toMatch(/^proyectos\/[0-9a-f-]{36}\.pdf$/);
    expect(await existe(escrito)).toBe(true);

    // La segunda no se guardo: ni ruta en la base ni archivo huerfano.
    expect(diapositivas).toBeNull();
    expect(await archivosEn('proyectos')).toHaveLength(1);
  });

  it('no deja archivos cuando falla la primera escritura', async () => {
    escribir.mockRejectedValueOnce(new Error('la base de datos no responde'));

    const res = await api()
      .post(`/api/grupos/${datos.grupo}/documentos`)
      .set(auth(await tokenDe('tutor')))
      .attach('proyectoEscrito', PDF, { filename: 'proyecto.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(500);
    expect(await archivosEn('proyectos')).toHaveLength(0);
    expect(await rutaEnBase('proyecto_escrito_url', datos.grupo)).toBeNull();
  });
});