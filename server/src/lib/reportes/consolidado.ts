import type { FilaConsolidado, PeriodoInfo } from '../../models/reporte.model.js';
import { DocumentoPdf, horas, pdfSeguro, porcentaje } from './pdf.js';
import { obtenerConfiguracion } from '../../models/configuracion.model.js';
import ExcelJS from 'exceljs';

export interface DatosConsolidado {
  filas: FilaConsolidado[];
  periodo: PeriodoInfo | null;
  alcance: string;
  generadoPor: string;
}

const COLUMNAS = [
  { titulo: 'Cedula', ancho: 65, alinear: 'left' as const },
  { titulo: 'Estudiante', ancho: 180, alinear: 'left' as const },
  { titulo: 'Directas', ancho: 60, alinear: 'right' as const },
  { titulo: 'Pend.', ancho: 50, alinear: 'right' as const },
  { titulo: 'Impacto', ancho: 55, alinear: 'right' as const },
  { titulo: 'Pend.', ancho: 50, alinear: 'right' as const },
  { titulo: 'Total', ancho: 55, alinear: 'right' as const },
];

export async function generarConsolidadoPdf(d: DatosConsolidado): Promise<Buffer> {
  const metas = await obtenerConfiguracion();
  const pdf = new DocumentoPdf({
    titulo: 'Consolidado de horas',
    subtitulo: 'Horas aprobadas por estudiante',
    datos: [
      { etiqueta: 'Periodo', valor: d.periodo?.nombre ?? 'Todos los periodos' },
      { etiqueta: 'Alcance', valor: d.alcance },
      {
        etiqueta: 'Metas',
        valor: `${metas.horasDirectas} h directas / ${metas.horasImpacto} h de impacto`,
      },
      { etiqueta: 'Emitido', valor: new Date().toLocaleDateString('es-VE') },
    ],
    generadoPor: d.generadoPor,
  });

  const filas = d.filas.map((f) => [
    f.cedula,
    pdfSeguro(f.nombreCompleto),
    horas(f.horasDirectas),
    f.directasPendientes > 0 ? horas(f.directasPendientes) : '-',
    horas(f.horasImpacto),
    f.impactoPendientes > 0 ? horas(f.impactoPendientes) : '-',
    horas(f.totalAprobadas),
  ]);

  if (filas.length === 0) {
    pdf.parrafo('No hay estudiantes que cumplan el alcance seleccionado.');
  } else {
    pdf.tabla(COLUMNAS, filas);
    const t = totales(d.filas);
    pdf.parrafo(
      `Total del grupo: ${horas(t.directas)} h directas, ${horas(t.impacto)} h de impacto, ` +
        `${horas(t.total)} h aprobadas. ${cumple(d.filas, metas.horasDirectas)} de ` +
        `${d.filas.length} estudiantes cumplen las metas.`,
      { negrita: true, size: 9 }
    );
    pdf.parrafo(
      'Las columnas "Pend." resumen los registros aún no validados; no cuentan para las metas.',
      { size: 8, color: '#6b7280' }
    );
  }

  return pdf.finalizar(d.generadoPor);
}

function totales(filas: FilaConsolidado[]): {
  directas: number;
  impacto: number;
  total: number;
} {
  return filas.reduce(
    (a, f) => ({
      directas: a.directas + f.horasDirectas,
      impacto: a.impacto + f.horasImpacto,
      total: a.total + f.totalAprobadas,
    }),
    { directas: 0, impacto: 0, total: 0 }
  );
}

function cumple(filas: FilaConsolidado[], metaDirectas: number): number {
  return filas.filter((f) => f.horasDirectas >= metaDirectas).length;
}

export async function generarConsolidadoExcel(d: DatosConsolidado): Promise<Buffer> {
  const metas = await obtenerConfiguracion();
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Comunidad IUNAV';
  libro.created = new Date();

  const hoja = libro.addWorksheet('Consolidado de horas', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  hoja.columns = [
    { header: 'Cedula', key: 'cedula', width: 14 },
    { header: 'Estudiante', key: 'estudiante', width: 32 },
    { header: `Directas (meta ${metas.horasDirectas})`, key: 'directas', width: 18 },
    { header: 'Directas pendientes', key: 'directasPend', width: 20 },
    { header: `Impacto (meta ${metas.horasImpacto})`, key: 'impacto', width: 18 },
    { header: 'Impacto pendiente', key: 'impactoPend', width: 19 },
    { header: 'Total aprobado', key: 'total', width: 15 },
    { header: '% directas', key: 'pctDirectas', width: 12 },
    { header: '% impacto', key: 'pctImpacto', width: 12 },
  ];

  for (const f of d.filas) {
    hoja.addRow({
      cedula: f.cedula,
      estudiante: f.nombreCompleto,
      directas: f.horasDirectas,
      directasPend: f.directasPendientes,
      impacto: f.horasImpacto,
      impactoPend: f.impactoPendientes,
      total: f.totalAprobadas,
      pctDirectas: (f.horasDirectas / metas.horasDirectas) * 100,
      pctImpacto: (f.horasImpacto / metas.horasImpacto) * 100,
    });
  }

  const encab = hoja.getRow(1);
  encab.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encab.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  encab.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  encab.height = 28;

  // Los porcentajes se pintan como fraccion con formato, no como numero plano.
  hoja.getColumn('pctDirectas').numFmt = '0"%"';
  hoja.getColumn('pctImpacto').numFmt = '0"%"';
  for (const col of ['directas', 'directasPend', 'impacto', 'impactoPend', 'total']) {
    hoja.getColumn(col).numFmt = '0.0';
    hoja.getColumn(col).alignment = { horizontal: 'right' };
  }
  for (const col of ['pctDirectas', 'pctImpacto']) {
    hoja.getColumn(col).alignment = { horizontal: 'right' };
  }

  if (d.filas.length > 0) {
    const t = totales(d.filas);
    const total = hoja.addRow({
      cedula: '',
      estudiante: 'TOTAL',
      directas: t.directas,
      directasPend: d.filas.reduce((a, f) => a + f.directasPendientes, 0),
      impacto: t.impacto,
      impactoPend: d.filas.reduce((a, f) => a + f.impactoPendientes, 0),
      total: t.total,
    });
    total.font = { bold: true };
    total.eachCell((celda) => {
      celda.border = { top: { style: 'double' } };
    });

    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
  }

  const pie = hoja.addRow([]);
  pie.getCell(1).value =
    `Periodo: ${d.periodo?.nombre ?? 'todos'} | Alcance: ${d.alcance} | ` +
    `Emitido: ${new Date().toLocaleString('es-VE')} por ${d.generadoPor}`;
  pie.getCell(1).font = { size: 9, color: { argb: 'FF6B7280' } };

  const salida = await libro.xlsx.writeBuffer();
  return Buffer.from(salida);
}