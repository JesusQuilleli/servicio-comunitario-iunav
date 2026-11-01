import type { FilaSemanal, PeriodoInfo } from '../../models/reporte.model.js';
import { DocumentoPdf, horas, pdfSeguro } from './pdf.js';

/**
 * Reporte semanal de actividades.
 *
 * Es el unico reporte que baja al detalle: una fila por actividad, no una por
 * estudiante. Por eso lo puede pedir tambien el estudiante, acotado a lo suyo:
 * es su propio registro de lo que hizo y de que le validaron.
 *
 * A diferencia del consolidado y del certificado, aqui SI aparecen las horas
 * pendientes y las rechazadas. Un registro de actividades que solo mostrara lo
 * aprobado no serviria para revisar el trabajo de la semana, que es justo
 * cuando todavia no esta validado. El total aprobado se separa del resto para
 * que no se confundan.
 */

const ESTADO: Record<string, string> = {
  aprobado: 'Aprobado',
  pendiente: 'Pendiente',
  rechazado: 'Rechazado',
  corregir: 'Por corregir',
};

const TIPO: Record<string, string> = {
  comunitario: 'Comunitario',
  social: 'Social',
  ambiental: 'Ambiental',
};

export interface AlcanceSemanal {
  /** Como se describe el recorte en el membrete. */
  descripcion: string;
  /** `null` cuando el reporte abarca todas las semanas del periodo. */
  semana: number | null;
  /** Agrupar por estudiante o por semana. */
  agruparPor: 'estudiante' | 'semana';
}

export function generarReporteSemanalPdf(
  filas: FilaSemanal[],
  periodo: PeriodoInfo | null,
  alcance: AlcanceSemanal,
  generadoPor: string
): Promise<Buffer> {
  const pdf = new DocumentoPdf({
    titulo: alcance.semana === null ? 'Reporte de actividades' : `Reporte de la semana ${alcance.semana}`,
    subtitulo: pdfSeguro(alcance.descripcion),
    datos: [
      { etiqueta: 'Periodo', valor: periodo?.nombre ?? 'No asignado' },
      {
        etiqueta: 'Semana',
        valor: alcance.semana === null ? 'Todas las del periodo' : String(alcance.semana),
      },
      { etiqueta: 'Actividades', valor: String(filas.length) },
      { etiqueta: 'Emitido', valor: new Date().toLocaleDateString('es-VE') },
    ],
    generadoPor,
  });

  if (filas.length === 0) {
    pdf.parrafo(
      'No hay actividades registradas con los filtros seleccionados. Si el periodo ' +
        'acaba de empezar, es posible que todavia no se haya cargado ninguna.'
    );
    return pdf.finalizar(generadoPor);
  }

  pdf.parrafo(
    'Detalle de las actividades registradas en el periodo indicado. Solo las ' +
      'actividades en estado "Aprobado" cuentan para las metas del programa; las ' +
      'demas se incluyen para dejar constancia del trabajo cargado.'
  );

  const columnas = [
    { titulo: 'Sem.', ancho: 34, alinear: 'center' as const },
    { titulo: 'Fecha', ancho: 60 },
    { titulo: 'Tipo', ancho: 62 },
    { titulo: 'Estudiante', ancho: 110 },
    { titulo: 'Actividad', ancho: 150 },
    { titulo: 'Horas', ancho: 38, alinear: 'right' as const },
    { titulo: 'Estado', ancho: 61 },
  ];

  for (const [titulo, grupo] of agrupar(filas, alcance.agruparPor)) {
    pdf.tituloSeccion(titulo);
    pdf.tabla(
      columnas,
      grupo.map((f) => [
        String(f.semana),
        f.fecha,
        TIPO[f.tipo] ?? f.tipo,
        f.estudiante,
        f.descripcion,
        horas(f.horas),
        ESTADO[f.estado] ?? f.estado,
      ])
    );

    const aprobadas = sumar(grupo, (f) => f.estado === 'aprobado');
    const pendientes = sumar(grupo, (f) => f.estado === 'pendiente' || f.estado === 'corregir');
    pdf.parrafo(
      `Subtotal: ${horas(aprobadas)} aprobadas` +
        (pendientes > 0 ? ` y ${horas(pendientes)} pendientes de validar.` : '.'),
      { size: 9, negrita: true }
    );
  }

  // La semana declarada por el estudiante y la calculada desde el periodo
  // pueden no coincidir: se avisa en vez de taparlo, porque el numero que el
  // estudiante escribio a mano es el que el ve en su pantalla.
  const discrepan = filas.filter(
    (f) => f.semanaDeclarada !== null && f.semanaDeclarada !== f.semana
  );
  if (discrepan.length > 0) {
    pdf.tituloSeccion('Aviso');
    pdf.parrafo(
      `${discrepan.length} actividad(es) tienen una semana declarada distinta de la ` +
        'calculada a partir de la fecha y del inicio del periodo. En este reporte vale ' +
        'la calculada. Detalle: ' +
        discrepan
          .slice(0, 12)
          .map((f) => `${f.estudiante} ${f.fecha} (declarada ${f.semanaDeclarada}, real ${f.semana})`)
          .join('; ') +
        (discrepan.length > 12 ? '; ...' : '.'),
      { size: 8.5, color: '#b45309' }
    );
  }

  pdf.tituloSeccion('Totales');
  const aprobadas = sumar(filas, (f) => f.estado === 'aprobado');
  const pendientes = sumar(filas, (f) => f.estado === 'pendiente' || f.estado === 'corregir');
  const rechazadas = sumar(filas, (f) => f.estado === 'rechazado');
  pdf.tabla(
    [
      { titulo: 'Concepto', ancho: 300 },
      { titulo: 'Actividades', ancho: 110, alinear: 'right' as const },
      { titulo: 'Horas', ancho: 105, alinear: 'right' as const },
    ],
    [
      ['Aprobadas (cuentan para las metas)', String(contar(filas, 'aprobado')), horas(aprobadas)],
      ['Pendientes de validar', String(filas.filter((f) => f.estado === 'pendiente' || f.estado === 'corregir').length), horas(pendientes)],
      ['Rechazadas', String(contar(filas, 'rechazado')), horas(rechazadas)],
    ]
  );

  return pdf.finalizar(generadoPor);
}

function sumar(filas: FilaSemanal[], criterio: (f: FilaSemanal) => boolean): number {
  return filas.filter(criterio).reduce((total, f) => total + f.horas, 0);
}

function contar(filas: FilaSemanal[], estado: string): number {
  return filas.filter((f) => f.estado === estado).length;
}

/**
 * Agrupa manteniendo el orden en el que vienen las filas (que ya llega ordenado
 * por semana y por estudiante desde el SQL).
 */
function agrupar(
  filas: FilaSemanal[],
  por: 'estudiante' | 'semana'
): [string, FilaSemanal[]][] {
  const mapa = new Map<string, FilaSemanal[]>();
  for (const f of filas) {
    const clave =
      por === 'estudiante'
        ? `${f.estudiante} (${f.cedula})`
        : `Semana ${f.semana}`;
    const actual = mapa.get(clave) ?? [];
    actual.push(f);
    mapa.set(clave, actual);
  }
  return [...mapa.entries()];
}
