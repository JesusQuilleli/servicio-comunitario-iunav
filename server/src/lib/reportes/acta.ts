import type { DatosActa } from '../../models/reporte.model.js';
import { DocumentoPdf, horas, pdfSeguro, porcentaje } from './pdf.js';
import { obtenerConfiguracion } from '../../models/configuracion.model.js';

/**
 * Acta de culminación del grupo.
 *
 * Es el documento que se firma al cierre del periodo, asi que deja huecos de
 * firma para el tutor, el coordinador y cada integrante.
 */
export async function generarActaPdf(d: DatosActa, generadoPor: string): Promise<Buffer> {
  const metas = await obtenerConfiguracion();
  const { grupo, periodo } = d;

  const pdf = new DocumentoPdf({
    titulo: 'Acta de culminación',
    subtitulo: pdfSeguro(grupo.nombreProyecto),
    datos: [
      { etiqueta: 'Periodo', valor: periodo?.nombre ?? 'No asignado' },
      { etiqueta: 'Tutor Academico', valor: grupo.tutorAcademicoNombre ?? 'No asignado' },
      { etiqueta: 'Tutor Comunitario', valor: grupo.tutorComunitarioNombre ?? 'No asignado' },
      { etiqueta: 'Coordinador', valor: grupo.coordinadorNombre ?? 'No asignado' },
      {
        etiqueta: 'Fechas',
        valor: periodo ? `${periodo.fechaInicio} al ${periodo.fechaFin}` : 'Sin definir',
      },
      { etiqueta: 'Emitido', valor: new Date().toLocaleDateString('es-VE') },
    ],
    generadoPor,
  });

  pdf.parrafo(
    'Los abajo firmantes firman el presente acta como constancia de haber culminado las ' +
      'horas de servicio comunitario del periodo indicado. Se hacen constar las horas ' +
      'aprobadas por el tutor segun el siguiente detalle:',
  );

  pdf.tituloSeccion('Detalle de integrantes');

  const incompletos = d.integrantes.filter(
    (i) => i.estadoFinal === null || i.horasDirectas < metas.horasDirectas
  );

  pdf.tabla(
    [
      { titulo: 'Cedula', ancho: 62 },
      { titulo: 'Integrante', ancho: 148 },
      { titulo: 'Directas', ancho: 55, alinear: 'right' },
      { titulo: 'Impacto', ancho: 55, alinear: 'right' },
      { titulo: 'Total', ancho: 50, alinear: 'right' },
      { titulo: '% compl.', ancho: 50, alinear: 'right' },
      { titulo: 'Estado', ancho: 95, alinear: 'left' },
    ],
    d.integrantes.map((i) => [
      i.cedula,
      pdfSeguro(i.nombreCompleto),
      horas(i.horasDirectas),
      horas(i.horasImpacto),
      horas(i.total),
      porcentaje(i.horasDirectas, metas.horasDirectas),
      ESTADO[i.estadoFinal ?? 'en_curso'],
    ])
  );

  pdf.parrafo(
    `Total aprobado: ${horas(d.totales.directas)} h directas y ` +
      `${horas(d.totales.impacto)} h de impacto, para un total de ${horas(d.totales.total)} h. ` +
      `Meta del programa: ${metas.horasDirectas} h directas y ${metas.horasImpacto} h de impacto.`,
    { negrita: true, size: 9 }
  );

  if (incompletos.length > 0) {
    pdf.parrafo(
      `Observación: ${incompletos.length} de ${d.integrantes.length} integrantes no tienen ` +
        'estado final asignado o no alcanzan la meta de horas directas. El acta debe ' +
        'firmarse para los que si la cumplen.',
      { size: 8.5, color: '#9a3412' }
    );
  }

  pdf.tituloSeccion('Firmas');
  pdf.parrafo(
    'En unión, a los ____ días del mes de ______________ de ______, firman los RESPONSABLES.',
    { size: 9.5 }
  );
  pdf.nuevaPagina();
  pdf.parrafo(
    'Los firmantes manifiestan conformidad con el detalle expuesto, declarando que las horas ' +
      'registradas corresponden al trabajo realmente realizado por los integrantes.',
    { size: 9.5 }
  );

  const yFirmas = pdf.doc.y + 10;
  pdf.doc.font('Helvetica').fontSize(8).fillColor('#6b7280');
  // Tres huecos de firma: los dos tutores del proyecto y la coordinacion. Con
  // 40 de margen y 515 de ancho util, 170 por columna entra justo en A4.
  const pares: [string, string][] = [
    ['Tutor Academico', grupo.tutorAcademicoNombre ?? ''],
    ['Tutor Comunitario', grupo.tutorComunitarioNombre ?? ''],
    ['Coordinación', grupo.coordinadorNombre ?? ''],
  ];
  pares.forEach(([rol, nombre], i) => {
    const x = 40 + i * 172;
    pdf.doc.text('____________________', x, yFirmas);
    pdf.doc.text(`${rol}${nombre ? `: ${pdfSeguro(nombre)}` : ''}`, x, yFirmas + 14, { width: 165 });
  });

  return pdf.finalizar(generadoPor);
}

const ESTADO: Record<string, string> = {
  en_curso: 'En curso',
  aprobado: 'Aprobado',
  reprobado: 'Reprobado',
};