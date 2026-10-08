import ExcelJS from 'exceljs';
import { ApiError } from './errors.js';

export interface FilaImportacion {
  fila: number;
  nombreCompleto: string;
  cedula: string;
  email: string;
  grupo: string | null;
}

export interface ErrorImportacion {
  fila: number;
  campo: string | null;
  mensaje: string;
}

const HOJA_DATOS = 'Estudiantes';
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizar(celda: ExcelJS.Cell | undefined): string {
  if (!celda) return '';
  const valor = celda.value;
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    if ('richText' in valor) return valor.richText.map((t) => t.text).join('').trim();
    if ('result' in valor) return String(valor.result ?? '').trim();
    if ('text' in valor) return String(valor.text).trim();
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    if ('hyperlink' in valor) return String(valor.hyperlink ?? '').trim();
    return '';
  }
  return String(valor).trim();
}

function claveDeColumna(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export async function leerPlantilla(buffer: Buffer): Promise<FilaImportacion[]> {
  let libro: ExcelJS.Workbook;
  try {
    const bytes = new Uint8Array(buffer);
    const copia: ArrayBuffer = bytes.buffer.slice(
      bytes.byteOffset,
      bytes.byteOffset + bytes.byteLength
    ) as ArrayBuffer;
    libro = await new ExcelJS.Workbook().xlsx.load(copia);
  } catch {
    throw new ApiError(
      400,
      'El archivo no es un .xlsx válido. Descarga la plantilla y llena una copia.'
    );
  }

  const hoja = libro.getWorksheet(HOJA_DATOS) ?? libro.worksheets[0];
  if (!hoja) {
    throw new ApiError(400, 'El archivo no tiene ninguna hoja con datos.');
  }

  let filaCabecera = 0;
  let columnas: Partial<Record<'nombreCompleto' | 'cedula' | 'email' | 'grupo', number>> = {};
  for (let i = 1; i <= Math.min(hoja.rowCount, 10); i++) {
    const fila = hoja.getRow(i);
    const encontradas: typeof columnas = {};
    fila.eachCell((celda, numero) => {
      const clave = claveDeColumna(normalizar(celda));
      if (clave === 'nombrecompleto') encontradas.nombreCompleto = numero;
      else if (clave === 'cedula') encontradas.cedula = numero;
      else if (clave === 'email' || clave === 'correo') encontradas.email = numero;
      else if (clave === 'grupo') encontradas.grupo = numero;
    });
    if (encontradas.nombreCompleto && encontradas.email) {
      filaCabecera = i;
      columnas = encontradas;
      break;
    }
  }

  if (filaCabecera === 0 || !columnas.cedula) {
    throw new ApiError(
      400,
      'No se encontraron las columnas esperadas (nombreCompleto, cedula, email). Usa la plantilla oficial.'
    );
  }

  const filas: FilaImportacion[] = [];
  for (let i = filaCabecera + 1; i <= hoja.rowCount; i++) {
    const fila = hoja.getRow(i);
    const registro: FilaImportacion = {
      fila: i,
      nombreCompleto: normalizar(fila.getCell(columnas.nombreCompleto as number)),
      cedula: normalizar(fila.getCell(columnas.cedula as number)),
      email: normalizar(fila.getCell(columnas.email as number)).toLowerCase(),
      grupo: columnas.grupo ? normalizar(fila.getCell(columnas.grupo)) || null : null,
    };
    const vacia = !registro.nombreCompleto && !registro.cedula && !registro.email;
    if (!vacia) filas.push(registro);
  }

  if (filas.length === 0) {
    throw new ApiError(400, 'La plantilla no tiene filas de datos para cargar.');
  }

  return filas;
}

export function validarFila(fila: FilaImportacion): ErrorImportacion[] {
  const errores: ErrorImportacion[] = [];

  if (fila.nombreCompleto.length < 3) {
    errores.push({
      fila: fila.fila,
      campo: 'nombreCompleto',
      mensaje: 'El nombre completo es obligatorio (mínimo 3 caracteres)',
    });
  }
  if (fila.cedula.length < 5) {
    errores.push({
      fila: fila.fila,
      campo: 'cedula',
      mensaje: 'La cédula es obligatoria (mínimo 5 caracteres)',
    });
  }
  if (!CORREO.test(fila.email)) {
    errores.push({
      fila: fila.fila,
      campo: 'email',
      mensaje: 'Correo electrónico inválido',
    });
  }

  return errores;
}
