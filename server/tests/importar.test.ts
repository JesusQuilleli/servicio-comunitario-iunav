import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import ExcelJS from 'exceljs';
import { api, auth, tokenDe } from './helpers/app.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  type DatosSemilla,
} from './helpers/db.js';
import { pool } from '../src/db/pool.js';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function plantillaDe(filas: Record<string, string | null>[]): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet('Estudiantes');
  hoja.addRow(['nombreCompleto', 'cedula', 'email', 'grupo']);
  for (const f of filas) {
    hoja.addRow([f.nombreCompleto, f.cedula, f.email, f.grupo ?? '']);
  }
  return Buffer.from(await libro.xlsx.writeBuffer());
}

function adjuntar(peticion: supertest.Test, buffer: Buffer): supertest.Test {
  return peticion.attach('archivo', buffer, {
    filename: 'estudiantes.xlsx',
    contentType: XLSX_MIME,
  });
}

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

describe('GET /api/usuarios/plantilla.xlsx', () => {
  it('devuelve un .xlsx con las columnas esperadas', async () => {
    const res = await api()
      .get('/api/usuarios/plantilla.xlsx')
      .set(auth(await tokenDe('admin')))
      .responseType('blob');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain(XLSX_MIME);
    expect(res.headers['content-disposition']).toContain('plantilla-estudiantes.xlsx');

    const libro = new ExcelJS.Workbook();
    await libro.xlsx.load(res.body as unknown as ArrayBuffer);
    const hoja = libro.getWorksheet('Estudiantes');
    expect(hoja).toBeDefined();
    expect(hoja!.getCell(1, 1).value).toBe('nombreCompleto');
    expect(hoja!.getCell(1, 2).value).toBe('cedula');
    expect(hoja!.getCell(1, 3).value).toBe('email');
  });
});

describe('POST /api/usuarios/importar', () => {
  const dosValidos = () => [
    {
      nombreCompleto: 'Ana María Pérez González',
      cedula: 'V-12345678',
      email: 'ana.perez@iunav.edu.ve',
      grupo: 'Grupo de prueba',
    },
    {
      nombreCompleto: 'Luis Enrique Rodríguez Mata',
      cedula: 'V-87654321',
      email: 'luis.rodriguez@iunav.edu.ve',
      grupo: null,
    },
  ];

  it('crea los estudiantes y les deja la cédula como clave inicial obligatoria de cambiar', async () => {
    const res = await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('coordinador')))
      .send()
      .attach('archivo', await plantillaDe(dosValidos()), {
        filename: 'estudiantes.xlsx',
        contentType: XLSX_MIME,
      });

    expect(res.status).toBe(201);
    expect(res.body.creados).toBe(2);
    expect(res.body.asignados).toBe(1);
    expect(res.body.errores).toEqual([]);
    expect(res.body.claves).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'ana.perez@iunav.edu.ve', claveInicial: 'V-12345678' }),
        expect.objectContaining({ email: 'luis.rodriguez@iunav.edu.ve', claveInicial: 'V-87654321' }),
      ])
    );

    const { rows } = await pool.query<{ rol: string; password_temporal: boolean }>(
      `select rol, password_temporal from usuarios where email = 'ana.perez@iunav.edu.ve'`
    );
    expect(rows[0].rol).toBe('estudiante');
    expect(rows[0].password_temporal).toBe(true);

    const { rows: miembros } = await pool.query<{ id_grupo: string }>(
      `select ig.id_grupo from integrantes_grupo ig
       join usuarios u on u.id_usuario = ig.id_estudiante
       where u.email = 'ana.perez@iunav.edu.ve'`
    );
    expect(miembros.map((m) => m.id_grupo)).toContain(datos.grupo);
  });

  it('quien entra con la clave de la cédula queda forzado a cambiarla', async () => {
    await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('admin')))
      .attach('archivo', await plantillaDe(dosValidos()), {
        filename: 'estudiantes.xlsx',
        contentType: XLSX_MIME,
      });

    const login = await api()
      .post('/api/auth/login')
      .send({ email: 'ana.perez@iunav.edu.ve', password: 'V-12345678' });
    expect(login.status).toBe(200);

    const conTemporal = await api()
      .get('/api/usuarios')
      .set(auth(login.body.token as string));
    expect(conTemporal.status).toBe(403);
    expect(conTemporal.body.code).toBe('PASSWORD_TEMPORAL');
  });

  it('reporta por fila los datos inválidos y crea solo las filas buenas', async () => {
    const { rows } = await pool.query<{ cedula: string }>(
      `select cedula from usuarios where email = 'estudianteana@test.local'`
    );
    const cedulaDelSeed = rows[0].cedula;

    const buffer = await plantillaDe([
      { nombreCompleto: 'Repetida', cedula: cedulaDelSeed, email: 'repetida@test.local', grupo: null },
      { nombreCompleto: 'Correo', cedula: 'V-33333333', email: 'no-es-un-correo', grupo: null },
      { nombreCompleto: 'Sin cedula', cedula: '', email: 'sancedula@test.local', grupo: null },
      { nombreCompleto: 'Grupo inexistente', cedula: 'V-44444444', email: 'grupo@test.local', grupo: 'No existe este grupo' },
      { nombreCompleto: 'Cedula repetida en el archivo', cedula: 'V-55555555', email: 'once@test.local', grupo: null },
      { nombreCompleto: 'Cedula repetida en el archivo', cedula: 'V-55555555', email: 'dos@test.local', grupo: null },
      { nombreCompleto: 'Una buena', cedula: 'V-66666666', email: 'buena@test.local', grupo: 'Grupo de prueba' },
    ]);

    const res = await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('admin')))
      .attach('archivo', buffer, { filename: 'estudiantes.xlsx', contentType: XLSX_MIME });

    expect(res.status).toBe(201);
    expect(res.body.creados).toBe(2);
    expect(res.body.asignados).toBe(1);
    expect(res.body.errores).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fila: 2, campo: 'cedula' }),
        expect.objectContaining({ fila: 3, campo: 'email' }),
        expect.objectContaining({ fila: 4, campo: 'cedula' }),
        expect.objectContaining({ fila: 5, campo: 'grupo' }),
        expect.objectContaining({ fila: 7, campo: 'cedula' }),
      ])
    );
    expect(res.body.errores).toHaveLength(5);
    expect(res.body.claves.map((c: { email: string }) => c.email)).toEqual([
      'once@test.local',
      'buena@test.local',
    ]);
  });

  it('si la cédula no cumple la política genera una clave temporal distinta', async () => {
    const buffer = await plantillaDe([
      { nombreCompleto: 'Sin letra', cedula: '123456789', email: 'sintitulo@test.local', grupo: null },
    ]);

    const res = await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('admin')))
      .attach('archivo', buffer, { filename: 'estudiantes.xlsx', contentType: XLSX_MIME });

    expect(res.status).toBe(201);
    expect(res.body.creados).toBe(1);
    const clave = res.body.claves[0].claveInicial as string;
    expect(clave).toHaveLength(12);
    expect(clave).not.toBe('123456789');
  });

  it('rechaza un archivo que no es .xlsx con 400', async () => {
    const res = await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('admin')))
      .attach('archivo', Buffer.from('no-es-un-xlsx'), {
        filename: 'estudiantes.xlsx',
        contentType: XLSX_MIME,
      });
    expect(res.status).toBe(400);
  });

  it('rechaza el pedido sin archivo con 400', async () => {
    const res = await api().post('/api/usuarios/importar').set(auth(await tokenDe('admin')));
    expect(res.status).toBe(400);
  });

  it('rechaza una plantilla sin filas de datos con 400', async () => {
    const libro = new ExcelJS.Workbook();
    const hoja = libro.addWorksheet('Estudiantes');
    hoja.addRow(['nombreCompleto', 'cedula', 'email', 'grupo']);
    const buffer = Buffer.from(await libro.xlsx.writeBuffer());

    const res = await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('admin')))
      .attach('archivo', buffer, { filename: 'estudiantes.xlsx', contentType: XLSX_MIME });
    expect(res.status).toBe(400);
  });
});

describe('el resto de roles no pueden importar (lo cubre la matriz, pero se recuerda)', () => {
  it('un tutor recibe 403', async () => {
    const res = await api()
      .post('/api/usuarios/importar')
      .set(auth(await tokenDe('tutor')))
      .attach('archivo', await plantillaDe([]), { filename: 'x.xlsx', contentType: XLSX_MIME });
    expect(res.status).toBe(403);
  });
});