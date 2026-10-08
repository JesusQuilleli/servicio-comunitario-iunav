import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { generarConsolidadoPdf, generarConsolidadoExcel } from '../src/lib/reportes/consolidado.js';
import { generarActaPdf } from '../src/lib/reportes/acta.js';
import { generarCertificadoPdf } from '../src/lib/reportes/certificado.js';
import type { FilaConsolidado } from '../src/models/reporte.model.js';
import type { DetalleGrupo } from '../src/models/grupo.model.js';

const salida = path.join(os.tmpdir(), 'muestras-iunav');
fs.mkdirSync(salida, { recursive: true });

const filas: FilaConsolidado[] = [
  ['V-12345678', 'Ana Maria Perez Gonzalez', 90, 0, 30, 0, 120],
  ['V-87654321', 'Maria Alejandra Rodriguez Gonzalez Hernandez de la Cruz', 45, 12, 10, 4, 55],
  ['V-11223344', 'Luis Enrique González Rodríguez', 90, 0, 30, 0, 120],
  ['V-20304050', 'José Ramón Quiñones Mata', 78, 6, 25, 2, 103],
  ['V-30405060', 'Yorgelis Andreina Briceño Fuenmayor', 90, 0, 30, 0, 120],
  ['V-40506070', 'Cristian David Suárez Molina', 60, 30, 20, 10, 80],
  ['V-50607080', 'Danilo Antonio Rincón Cárdenas', 90, 0, 28, 2, 118],
  ['V-60708090', 'Génesis del Carmen Paredes de Salas', 90, 0, 30, 0, 120],
  ['V-70809010', 'Pedro Javier Martínez Núñez', 12, 78, 5, 25, 17],
  ['V-80901020', 'Andreína Sofía Colmenares Villalobos', 90, 0, 30, 0, 120],
  ['V-90102030', 'Erick Alejandro Díaz Pernía', 84, 6, 30, 0, 114],
  ['V-10203040', 'Yanet Carolina Ovalles Márquez', 0, 90, 0, 30, 0],
].map(([cedula, nombreCompleto, horasDirectas, directasPendientes, horasImpacto, impactoPendientes, totalAprobadas], i) => ({
  idUsuario: `u-${i}`,
  cedula,
  nombreCompleto,
  horasDirectas,
  directasPendientes,
  horasImpacto,
  impactoPendientes,
  totalAprobadas,
}));

const consolidado = {
  filas,
  periodo: { id: 1, nombre: '2026-I', fechaInicio: '2026-01-05', fechaFin: '2026-06-30' },
  alcance: 'todos los estudiantes de servicio comunitario',
  generadoPor: 'Prueba (admin)',
};

const integrantes = filas.slice(0, 6).map((f) => ({
  cedula: f.cedula,
  nombreCompleto: f.nombreCompleto,
  estadoFinal: f.horasDirectas >= 90 ? ('aprobado' as const) : f.horasDirectas > 0 ? ('en_curso' as const) : null,
  horasDirectas: f.horasDirectas,
  horasImpacto: f.horasImpacto,
  total: f.horasDirectas + f.horasImpacto,
}));

const grupo = {
  idGrupo: 'g-1',
  nombreProyecto: 'Huerto escolar comunitario y educación ambiental en la parroquia Alberto Arvelo Torrealba',
  estado: 'activo',
  periodoId: 1,
  periodo: '2026-I',
  tutorId: 'u-t',
  tutorNombre: 'Prof. María Eugenia Laya',
  coordinadorId: 'u-c',
  coordinadorNombre: 'Ing. Rafael Antonio Moreno',
  proyectoEscritoUrl: null,
  diapositivasUrl: null,
  integrantes: integrantes.length,
  horasAprobadas: 540,
  horasPendientes: 96,
  creadoEn: '2026-01-10T08:00:00.000Z',
  listaIntegrantes: [],
} as unknown as DetalleGrupo;

const acta = {
  grupo,
  periodo: consolidado.periodo,
  integrantes,
  totales: integrantes.reduce(
    (a, i) => ({ directas: a.directas + i.horasDirectas, impacto: a.impacto + i.horasImpacto, total: a.total + i.total }),
    { directas: 0, impacto: 0, total: 0 }
  ),
};

const certificadoBase = {
  idUsuario: 'u-1',
  periodo: consolidado.periodo,
  metas: { directas: 90, impacto: 30 },
  generadoPor: 'Prueba (admin)',
};

const certificadoCumple = {
  ...certificadoBase,
  cedula: 'V-12345678',
  nombreCompleto: 'Ana Maria Perez Gonzalez',
  horasDirectas: 90,
  horasImpacto: 30,
  total: 120,
  cumpleMetas: true,
  pendientes: 0,
};

const certificadoPendiente = {
  ...certificadoBase,
  cedula: 'V-70809010',
  nombreCompleto: 'Pedro Javier Martínez Núñez',
  horasDirectas: 12,
  horasImpacto: 5,
  total: 17,
  cumpleMetas: false,
  pendientes: 7,
};

const archivos: [string, Promise<Buffer>][] = [
  ['consolidado.pdf', generarConsolidadoPdf(consolidado)],
  ['consolidado.xlsx', generarConsolidadoExcel(consolidado)],
  ['acta.pdf', generarActaPdf(acta, 'Prueba (admin)')],
  ['certificado-cumple.pdf', generarCertificadoPdf(certificadoCumple, 'Prueba (admin)')],
  ['certificado-pendiente.pdf', generarCertificadoPdf(certificadoPendiente, 'Prueba (admin)')],
];

for (const [nombre, promesa] of archivos) {
  const buffer = await promesa;
  fs.writeFileSync(path.join(salida, nombre), buffer);
  console.log(nombre, buffer.length, 'bytes');
}

console.log(salida);
process.exit(0);
