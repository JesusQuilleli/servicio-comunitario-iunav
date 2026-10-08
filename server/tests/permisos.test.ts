import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { api, auth, tokenDe, type Rol } from './helpers/app.js';
import { plantillaEstudiantes } from '../src/lib/plantilla.js';
import {
  aplicarEsquema,
  asegurarBaseDePruebas,
  cerrarPool,
  sembrar,
  PASSWORD_SEMILLA,
  type DatosSemilla,
} from './helpers/db.js';

const ROLES: Rol[] = ['admin', 'coordinador', 'tutor', 'estudiante'];

type Metodo = 'get' | 'post' | 'patch' | 'delete';

interface Caso {
  nombre: string;
  metodo: Metodo;
  ruta: (d: DatosSemilla) => string;
  cuerpo?: (d: DatosSemilla) => Record<string, unknown>;
  permitido: Record<Rol, boolean>;
  /** Archivo a adjuntar, para los endpoints que suben uno. */
  adjunto?: { campo: string; nombre: string; tipo: string; cuerpo: Buffer };
}

const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000000020001e221bc330000000049454e44ae426082',
  'hex'
);
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const TODOS: Record<Rol, boolean> = {
  admin: true,
  coordinador: true,
  tutor: true,
  estudiante: true,
};
const GESTION: Record<Rol, boolean> = { admin: true, coordinador: true, tutor: false, estudiante: false };
const SOLO_ADMIN: Record<Rol, boolean> = { admin: true, coordinador: false, tutor: false, estudiante: false };
const SOLO_TUTOR: Record<Rol, boolean> = { admin: false, coordinador: false, tutor: true, estudiante: false };
// Los reportes los pide el tutor tambien (para sus propios estudiantes): es
// gestion mas tutor, sin el estudiante.
const GESTION_Y_TUTOR: Record<Rol, boolean> = {
  admin: true,
  coordinador: true,
  tutor: true,
  estudiante: false,
};
const SOLO_ESTUDIANTE: Record<Rol, boolean> = { admin: false, coordinador: false, tutor: false, estudiante: true };

const CASOS: Caso[] = [
  {
    nombre: 'GET /api/auth/me',
    metodo: 'get',
    ruta: () => '/api/auth/me',
    permitido: TODOS,
  },
  {
    // El coordinador tambien da de alta: el rol que envia es estudiante, que es
    // el que le toca. Crear administradores o coordinadores es del admin.
    nombre: 'POST /api/auth/register',
    metodo: 'post',
    ruta: () => '/api/auth/register',
    cuerpo: () => ({
      nombreCompleto: 'Alta desde prueba',
      cedula: 'V-99999999',
      email: 'alta@test.local',
      password: 'clave1234',
      rol: 'estudiante',
    }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/auth/password',
    metodo: 'patch',
    ruta: () => '/api/auth/password',
    // La contrasena actual es la del seed, asi que cada rol llega al 200 de verdad
    // en vez de toparse con el 400 de "contrasena actual incorrecta".
    cuerpo: () => ({ passwordActual: PASSWORD_SEMILLA, passwordNueva: 'claveNueva9' }),
    permitido: TODOS,
  },
  {
    nombre: 'POST /api/usuarios/:id/password',
    metodo: 'post',
    ruta: (d) => `/api/usuarios/${d.estudianteB}/password`,
    permitido: SOLO_ADMIN,
  },
  { nombre: 'GET /api/dashboard', metodo: 'get', ruta: () => '/api/dashboard', permitido: TODOS },
  {
    // Los reportes van a `gestion`: el tutor los pide para sus estudiantes y
    // el propio estudiante no puede bajar ninguno.
    nombre: 'GET /api/reportes/consolidado-horas.pdf',
    metodo: 'get',
    ruta: () => '/api/reportes/consolidado-horas.pdf',
    permitido: GESTION_Y_TUTOR,
  },
  {
    nombre: 'GET /api/reportes/consolidado-horas.xlsx',
    metodo: 'get',
    ruta: () => '/api/reportes/consolidado-horas.xlsx',
    permitido: GESTION_Y_TUTOR,
  },
  {
    nombre: 'GET /api/reportes/acta/:idGrupo.pdf',
    metodo: 'get',
    ruta: (d) => `/api/reportes/acta/${d.grupo}.pdf`,
    permitido: GESTION_Y_TUTOR,
  },
  {
    nombre: 'GET /api/reportes/certificado/:idUsuario.pdf',
    metodo: 'get',
    ruta: (d) => `/api/reportes/certificado/${d.estudianteA}.pdf`,
    permitido: GESTION_Y_TUTOR,
  },
  { nombre: 'GET /api/usuarios', metodo: 'get', ruta: () => '/api/usuarios', permitido: GESTION },
  {
    nombre: 'GET /api/usuarios/plantilla.xlsx',
    metodo: 'get',
    ruta: () => '/api/usuarios/plantilla.xlsx',
    permitido: GESTION,
  },
  {
    // La plantilla trae dos filas de ejemplo validas: el 201 crea esas cuentas.
    // La base se reinicia antes de cada caso (ver `beforeEach`), asi que no
    // contamina a los demas.
    nombre: 'POST /api/usuarios/importar',
    metodo: 'post',
    ruta: () => '/api/usuarios/importar',
    permitido: GESTION,
    adjunto: {
      campo: 'archivo',
      nombre: 'plantilla-estudiantes.xlsx',
      tipo: XLSX_MIME,
      cuerpo: plantillaEstudiantes(),
    },
  },
  {
    nombre: 'PATCH /api/usuarios/:id/activo',
    metodo: 'patch',
    ruta: (d) => `/api/usuarios/${d.estudianteB}/activo`,
    cuerpo: () => ({ activo: false }),
    permitido: SOLO_ADMIN,
  },
  {
    // Cualquier rol autenticado llega al controlador; el controlador decide si es
    // el propio usuario o el admin. Aqui `tutoralfa` no es el dueño, asi que
    // responde 403 desde la lógica de negocio, no desde `requireRole`.
    nombre: 'POST /api/usuarios/:id/firma (ajena)',
    metodo: 'post',
    ruta: (d) => `/api/usuarios/${d.estudianteB}/firma`,
    permitido: SOLO_ADMIN,
    adjunto: { campo: 'archivo', nombre: 'firma.png', tipo: 'image/png', cuerpo: PNG },
  },
  {
    nombre: 'POST /api/usuarios/:id/sello',
    metodo: 'post',
    ruta: (d) => `/api/usuarios/${d.coordinador}/sello`,
    permitido: SOLO_ADMIN,
    adjunto: { campo: 'archivo', nombre: 'sello.png', tipo: 'image/png', cuerpo: PNG },
  },
  {
    nombre: 'GET /api/bitacoras/mias',
    metodo: 'get',
    ruta: () => '/api/bitacoras/mias',
    permitido: SOLO_ESTUDIANTE,
  },
  {
    nombre: 'GET /api/bitacoras/grupos',
    metodo: 'get',
    ruta: () => '/api/bitacoras/grupos',
    permitido: SOLO_ESTUDIANTE,
  },
  {
    nombre: 'POST /api/bitacoras',
    metodo: 'post',
    ruta: () => '/api/bitacoras',
    cuerpo: () => ({
      tipo: 'social',
      fecha: '2026-03-02',
      descripcion: 'Jornada de prueba para la matriz de permisos',
      horas: 2,
    }),
    permitido: SOLO_ESTUDIANTE,
  },
  {
    nombre: 'GET /api/bitacoras/pendientes',
    metodo: 'get',
    ruta: () => '/api/bitacoras/pendientes',
    permitido: SOLO_TUTOR,
  },
  {
    nombre: 'GET /api/bitacoras/metas',
    metodo: 'get',
    ruta: () => '/api/bitacoras/metas',
    permitido: SOLO_ESTUDIANTE,
  },
  {
    nombre: 'PATCH /api/bitacoras/:id',
    metodo: 'patch',
    ruta: (d) => `/api/bitacoras/${d.bitacoraPendiente}`,
    cuerpo: () => ({
      fecha: '2026-02-10',
      descripcion: 'Registro editado desde la matriz de permisos',
      horas: 4,
    }),
    permitido: SOLO_ESTUDIANTE,
  },
  {
    nombre: 'DELETE /api/bitacoras/:id',
    metodo: 'delete',
    ruta: (d) => `/api/bitacoras/${d.bitacoraPendiente}`,
    permitido: SOLO_ESTUDIANTE,
  },
  {
    nombre: 'PATCH /api/bitacoras/:id/estado',
    metodo: 'patch',
    ruta: (d) => `/api/bitacoras/${d.bitacoraPendiente}/estado`,
    cuerpo: () => ({ tipo: 'comunitario', estado: 'aprobado', comentario: 'Aprobado en pruebas' }),
    permitido: SOLO_TUTOR,
  },
  {
    nombre: 'GET /api/grupos',
    metodo: 'get',
    ruta: () => '/api/grupos',
    permitido: { admin: true, coordinador: true, tutor: true, estudiante: false },
  },
  {
    nombre: 'GET /api/grupos/:id',
    metodo: 'get',
    ruta: (d) => `/api/grupos/${d.grupo}`,
    permitido: TODOS,
  },
  {
    nombre: 'POST /api/grupos',
    metodo: 'post',
    ruta: () => '/api/grupos',
    cuerpo: (d) => ({
      nombreProyecto: 'Grupo creado desde pruebas',
      periodoId: d.periodo,
      tutorId: d.tutorA,
      coordinadorId: d.coordinador,
      estado: 'en_curso',
      integrantesIds: [],
    }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/grupos/:id',
    metodo: 'patch',
    ruta: (d) => `/api/grupos/${d.grupo}`,
    cuerpo: (d) => ({
      nombreProyecto: 'Grupo editado desde pruebas',
      periodoId: d.periodo,
      tutorId: d.tutorA,
      coordinadorId: d.coordinador,
      estado: 'en_curso',
      // La lista de integrantes se reemplaza completa: hay que reenviar a los
      // tres, porque la app rechaza con 409 quitar a quien ya tiene horas.
      integrantesIds: [d.estudianteA, d.estudianteB, d.integranteSinHoras],
    }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/grupos/:id/estado',
    metodo: 'patch',
    ruta: (d) => `/api/grupos/${d.grupo}/estado`,
    cuerpo: () => ({ estado: 'finalizado' }),
    permitido: GESTION,
  },
  {
    nombre: 'POST /api/grupos/:id/integrantes',
    metodo: 'post',
    ruta: (d) => `/api/grupos/${d.grupo}/integrantes`,
    cuerpo: (d) => ({ estudiantesIds: [d.outsider] }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/grupos/:id/integrantes/:idEstudiante',
    metodo: 'patch',
    ruta: (d) => `/api/grupos/${d.grupo}/integrantes/${d.estudianteA}`,
    cuerpo: () => ({ estadoFinal: 'aprobado' }),
    permitido: GESTION,
  },
  {
    nombre: 'DELETE /api/grupos/:id/integrantes/:idEstudiante',
    metodo: 'delete',
    ruta: (d) => `/api/grupos/${d.grupo}/integrantes/${d.integranteSinHoras}`,
    permitido: GESTION,
  },
  {
    nombre: 'POST /api/grupos/:id/documentos',
    metodo: 'post',
    ruta: (d) => `/api/grupos/${d.grupo}/documentos`,
    permitido: { admin: true, coordinador: true, tutor: true, estudiante: false },
    adjunto: {
      campo: 'proyectoEscrito',
      nombre: 'proyecto.pdf',
      tipo: 'application/pdf',
      cuerpo: PDF,
    },
  },
  { nombre: 'GET /api/periodos', metodo: 'get', ruta: () => '/api/periodos', permitido: TODOS },
  {
    nombre: 'POST /api/periodos',
    metodo: 'post',
    ruta: () => '/api/periodos',
    cuerpo: () => ({ nombrePeriodo: '2026-II', fechaInicio: '2026-08-01', fechaFin: '2026-12-15' }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/periodos/:id',
    metodo: 'patch',
    ruta: (d) => `/api/periodos/${d.periodo}`,
    cuerpo: () => ({ nombrePeriodo: '2026-I-editado', fechaInicio: '2026-01-15', fechaFin: '2026-06-30' }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/periodos/:id/activo',
    metodo: 'patch',
    ruta: (d) => `/api/periodos/${d.periodo}/activo`,
    cuerpo: () => ({ activo: false }),
    permitido: GESTION,
  },
  {
    nombre: 'GET /api/configuracion',
    metodo: 'get',
    ruta: () => '/api/configuracion',
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/configuracion',
    metodo: 'patch',
    ruta: () => '/api/configuracion',
    cuerpo: (d) => ({
      horasDirectas: 90,
      horasImpacto: 30,
      limiteHorasDiarias: 8,
      periodoActivoId: d.periodo,
    }),
    permitido: SOLO_ADMIN,
  },
  {
    nombre: 'GET /api/configuracion/plantillas',
    metodo: 'get',
    ruta: () => '/api/configuracion/plantillas',
    permitido: GESTION,
  },
  {
    nombre: 'POST /api/configuracion/plantillas',
    metodo: 'post',
    ruta: () => '/api/configuracion/plantillas',
    cuerpo: () => ({
      nombre: 'Plantilla creada desde pruebas',
      descripcion: 'Creada por la matriz de permisos',
      tipo: 'acta',
      urlDocumento: null,
    }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/configuracion/plantillas/:id',
    metodo: 'patch',
    ruta: (d) => `/api/configuracion/plantillas/${d.plantilla}`,
    cuerpo: () => ({ nombre: 'Plantilla editada desde pruebas', tipo: 'informe' }),
    permitido: GESTION,
  },
  {
    nombre: 'PATCH /api/configuracion/plantillas/:id/activo',
    metodo: 'patch',
    ruta: (d) => `/api/configuracion/plantillas/${d.plantilla}/activo`,
    cuerpo: () => ({ activo: false }),
    permitido: GESTION,
  },
  {
    nombre: 'POST /api/configuracion/plantillas/:id/documento',
    metodo: 'post',
    ruta: (d) => `/api/configuracion/plantillas/${d.plantilla}/documento`,
    permitido: GESTION,
    adjunto: { campo: 'documento', nombre: 'plantilla.pdf', tipo: 'application/pdf', cuerpo: PDF },
  },
];

/** Adjunta un archivo de relleno a los casos que suben uno. El contenido puede ser promesa. */
async function adjuntar(peticion: supertest.Test, caso: Caso): Promise<supertest.Test> {
  if (!caso.adjunto) return peticion;
  const { campo, nombre, tipo, cuerpo } = caso.adjunto;
  return peticion.attach(campo, await cuerpo, { filename: nombre, contentType: tipo });
}

async function pedir(caso: Caso, token: string, d: DatosSemilla): Promise<supertest.Test> {
  const a = api();
  const cabeceras = auth(token);
  const cuerpo = caso.cuerpo ? caso.cuerpo(d) : {};
  switch (caso.metodo) {
    case 'get':
      return a.get(caso.ruta(d)).set(cabeceras).send(cuerpo);
    case 'post': {
      const peticion = a.post(caso.ruta(d)).set(cabeceras);
      // `.send()` fija `Content-Type: application/json` y dejaria sin efecto el
      // `multipart` de `.attach()`, asi que los dos son excluyentes.
      return caso.adjunto ? adjuntar(peticion, caso) : peticion.send(cuerpo);
    }
    case 'patch':
      return a.patch(caso.ruta(d)).set(cabeceras).send(cuerpo);
    case 'delete':
      return a.delete(caso.ruta(d)).set(cabeceras).send(cuerpo);
  }
}

let datos: DatosSemilla;

beforeAll(async () => {
  await asegurarBaseDePruebas();
  await aplicarEsquema();
  datos = await sembrar();
});

afterAll(async () => {
  await cerrarPool();
});

describe('matriz de permisos por rol', () => {
  // Cada caso parte de datos limpios: las pruebas que mutan no se contaminan.
  beforeEach(async () => {
    datos = await sembrar();
  });

  for (const rol of ROLES) {
    describe(`sesion de ${rol}`, () => {
      for (const caso of CASOS) {
        const esperado = caso.permitido[rol] ? 'permitido' : '403';

        it(`${caso.nombre} -> ${esperado}`, async () => {
          const token = await tokenDe(rol);
          const res = await pedir(caso, token, datos);

          if (caso.permitido[rol]) {
            expect(
              [200, 201, 204],
              `respondio ${res.status}: ${JSON.stringify(res.body)}`
            ).toContain(res.status);
          } else {
            expect(res.status, `respondio ${res.status}: ${JSON.stringify(res.body)}`).toBe(403);
            expect(res.body.message).toMatch(/Acceso denegado/i);
          }
        });
      }
    });
  }
});

describe('ningun endpoint acepta un token ausente', () => {
  for (const caso of CASOS) {
    it(`${caso.nombre} -> 401`, async () => {
      const res = await pedir(caso, '', datos);
      expect(res.status, `respondio ${res.status}: ${JSON.stringify(res.body)}`).toBe(401);
    });
  }
});

describe('ningun endpoint acepta un token invalido', () => {
  for (const caso of CASOS) {
    it(`${caso.nombre} -> 401`, async () => {
      const res = await pedir(caso, 'token.inventado.aqui', datos);
      expect(res.status, `respondio ${res.status}: ${JSON.stringify(res.body)}`).toBe(401);
    });
  }
});

describe('el rol no se puede falsear dentro del token', () => {
  it('un token de estudiante no puede abrir GET /api/usuarios', async () => {
    const token = await tokenDe('estudiante');
    const res = await api().get('/api/usuarios').set(auth(token));
    expect(res.status).toBe(403);
  });

  it('un token de tutor no puede tocar la configuracion', async () => {
    const token = await tokenDe('tutor');
    const res = await api().get('/api/configuracion').set(auth(token));
    expect(res.status).toBe(403);
  });
});

describe('cobertura de la matriz', () => {
  it('cubre los 43 endpoints de la API', () => {
    expect(CASOS).toHaveLength(43);
  });

  it('todo caso declara al menos un rol autorizado', () => {
    for (const caso of CASOS) {
      expect(Object.values(caso.permitido).some(Boolean), caso.nombre).toBe(true);
    }
  });
});
