import type { DatosCertificado } from '../../models/reporte.model.js';
import { DocumentoPdf, horas, pdfSeguro } from './pdf.js';

/**
 * Certificado de culminacion del servicio comunitario.
 *
 * A diferencia del consolidado y el acta, este documento afirma que el
 * estudiante cumplio el programa. Si las horas no alcanzan las metas se emite
 * igual, pero marcados como "no acreeditado": el documento no inventa un
 * cumplimiento que el sistema todavia no registra.
 */
export async function generarCertificadoPdf(
  d: DatosCertificado,
  generadoPor: string
): Promise<Buffer> {
  const periodo = d.periodo?.nombre ?? 'todos los periodos';

  const pdf = new DocumentoPdf({
    titulo: 'Certificado de culminacion',
    subtitulo: 'Servicio comunitario',
    datos: [
      { etiqueta: 'Estudiante', valor: d.nombreCompleto },
      { etiqueta: 'Cedula', valor: d.cedula },
      { etiqueta: 'Periodo', valor: periodo },
      { etiqueta: 'Emitido', valor: new Date().toLocaleDateString('es-VE') },
    ],
    generadoPor,
  });

  const nombre = pdfSeguro(d.nombreCompleto);

  pdf.doc.moveDown(2).font('Helvetica').fontSize(11).fillColor('#111827');
  pdf.doc.text(
    `La Direccion de Servicio Comunitario del Instituto Universitario ` +
      `Naval Villegas Edmond, hace constar que el(a) ciudadano(a) ${nombre}, ` +
      `titular de la cedula ${d.cedula}, ha culminado satisfactoryamente el programa de ` +
      `servicio comunitario correspondiente al periodo ${periodo}, cumpliendo con las ` +
      `horas de trabajo directo y de impacto social y ambiental que exige el programa.`,
    { align: 'justify' }
  );

  pdf.tituloSeccion('Detalle de horas');
  pdf.tabla(
    [
      { titulo: 'Concepto', ancho: 260 },
      { titulo: 'Meta', ancho: 90, alinear: 'right' },
      { titulo: 'Cumplidas', ancho: 90, alinear: 'right' },
      { titulo: 'Condicion', ancho: 75, alinear: 'center' },
    ],
    [
      [
        'Trabajo directo (bitacora comunitaria)',
        horas(d.metas.directas),
        horas(d.horasDirectas),
        d.horasDirectas >= d.metas.directas ? 'Cumplida' : 'Pendiente',
      ],
      [
        'Trabajo de impacto social y ambiental',
        horas(d.metas.impacto),
        horas(d.horasImpacto),
        d.horasImpacto >= d.metas.impacto ? 'Cumplida' : 'Pendiente',
      ],
      ['Total aprobado', '-', horas(d.total), d.cumpleMetas ? 'Cumplido' : 'Incompleto'],
    ]
  );

  if (!d.cumpleMetas) {
    pdf.parrafo(
      'DOCUMENTO NO ACREDITADO. Las horas registradas no alcanzan las metas del programa, ' +
        `por lo que este certificado no constituye prueba de culminacion. Quedan ` +
        `${d.pendientes} registro(s) sin validar.`,
      { size: 9, color: '#9a3412', negrita: true }
    );
  }

  pdf.doc.moveDown(2);
  if (d.cumpleMetas) {
    pdf.doc.font('Helvetica').fontSize(10).fillColor('#111827');
    pdf.doc.text(
      'Se expide el presente certificado a solicitud de parte interesada para los fines ' +
        'académicos y legales que al caso correspondan.',
      { align: 'justify' }
    );
  } else {
    pdf.doc.font('Helvetica').fontSize(10).fillColor('#9a3412');
    pdf.doc.text(
      'Se emite solo como constancia del estado actual del expediente, sin valor de ' +
        'acreditación.',
      { align: 'justify' }
    );
  }

  pdf.doc.moveDown(3);
  const yFirma = pdf.doc.y;
  pdf.doc.font('Helvetica').fontSize(8.5).fillColor('#6b7280');
  pdf.doc.text('_______________________________', 200, yFirma, { width: 195, align: 'center' });
  pdf.doc.text('Coordinacion del Servicio Comunitario', 200, yFirma + 14, {
    width: 195,
    align: 'center',
  });

  return pdf.finalizar(generadoPor);
}