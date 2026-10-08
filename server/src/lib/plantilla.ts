import ExcelJS from 'exceljs';

export const COLUMNAS_PLANTILLA = ['nombreCompleto', 'cedula', 'email', 'grupo'] as const;

export type ColumnaPlantilla = (typeof COLUMNAS_PLANTILLA)[number];

const HOJA_DATOS = 'Estudiantes';
const HOJA_INSTRUCCIONES = 'Instrucciones';

const LINEAS_INSTRUCCIONES = [
  'Cómo llenar la plantilla de carga de estudiantes',
  '',
  '1. Trabaja sobre una copia de este archivo: no cambies los nombres de las columnas.',
  '2. Cada fila es un estudiante. Las columnas nombreCompleto, cedula y email son obligatorias.',
  '3. El grupo es opcional: si lo escribes, debe coincidir exactamente con el nombre de un',
  '   proyecto existente (por ejemplo: "Grupo de prueba"). En blanco, el estudiante queda',
  '   sin proyecto y luego se agrega desde Grupos y Proyectos.',
  '4. Cédula y correo no pueden repetirse ni coincidir con una cuenta ya registrada.',
  '5. Las filas de ejemplo se pueden borrar.',
  '',
  'Contraseña inicial: es la cédula del estudiante (por ejemplo V-12345678).',
  'Quien entra con esa clave queda obligado a cambiarla en el primer inicio de sesión.',
  'Si la cédula no cumple la política de contraseñas (8 caracteres, letra y número),',
  'el sistema genera una clave temporal y la muestra una sola vez al terminar la carga.',
];

export async function plantillaEstudiantes(): Promise<Buffer> {
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Comunidad IUNAV';
  libro.created = new Date();

  const hoja = libro.addWorksheet(HOJA_DATOS, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  hoja.columns = [
    { header: 'nombreCompleto', key: 'nombreCompleto', width: 34 },
    { header: 'cedula', key: 'cedula', width: 14 },
    { header: 'email', key: 'email', width: 30 },
    { header: 'grupo', key: 'grupo', width: 40 },
  ];

  hoja.addRow({
    nombreCompleto: 'Ana María Pérez González',
    cedula: 'V-12345678',
    email: 'ana.perez@iunav.edu.ve',
    grupo: 'Grupo de prueba',
  });
  hoja.addRow({
    nombreCompleto: 'Luis Enrique Rodríguez Mata',
    cedula: 'V-87654321',
    email: 'luis.rodriguez@iunav.edu.ve',
    grupo: '',
  });

  const encabezado = hoja.getRow(1);
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  encabezado.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  encabezado.height = 22;

  hoja.getColumn('cedula').alignment = { horizontal: 'left' };
  hoja.getColumn('email').alignment = { horizontal: 'left' };

  hoja.eachRow((fila, numero) => {
    fila.eachCell((celda) => {
      celda.border = { bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } } };
      if (numero > 1) celda.font = { color: { argb: 'FF111827' } };
    });
  });

  const instrucciones = libro.addWorksheet(HOJA_INSTRUCCIONES);
  instrucciones.columns = [{ width: 100 }];
  for (const linea of LINEAS_INSTRUCCIONES) {
    instrucciones.addRow([linea]);
  }
  instrucciones.getColumn(1).font = { size: 11 };
  instrucciones.getRow(1).font = { bold: true, size: 13 };

  return Buffer.from(await libro.xlsx.writeBuffer());
}
