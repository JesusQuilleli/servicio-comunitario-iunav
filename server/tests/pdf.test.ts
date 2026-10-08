import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import { DocumentoPdf, horas, pdfSeguro, porcentaje } from '../src/lib/reportes/pdf.js';

/**
 * Maquetacion de los reportes.
 *
 * Los problemas que motivaron este archivo no se ven en el codigo: se ven al
 * abrir el PDF. Las pruebas de API comprueban que el archivo llega; aqui se
 * comprueba que el contenido quede en el orden en que se dibujo:
 *
 * 1. Si el cursor del membrete se retrocede, la tabla se pinta encima de los
 *    datos y las coordenadas Y dejan de ser crecientes hacia abajo.
 * 2. Si una celda se envuelve en dos lineas, aparece una coordenada Y que no
 *    deberia existir y se sale de la altura fija de la fila.
 */

function contenidoDe(pdf: Buffer): string {
  const cadena = pdf.toString('latin1');
  const fragmentos: string[] = [];
  const streams = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m: RegExpExecArray | null;
  while ((m = streams.exec(cadena)) !== null) {
    const bytes = Buffer.from(m[1], 'latin1');
    try {
      fragmentos.push(zlib.inflateSync(bytes).toString('latin1'));
    } catch {
      fragmentos.push(bytes.toString('latin1'));
    }
  }
  return fragmentos.join('\n');
}

/** Coordenadas Y (de arriba hacia abajo en pantalla) de cada texto dibujado. */
function coordenadasY(pdf: Buffer): number[] {
  const ys: number[] = [];
  const tm = /1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g;
  let m: RegExpExecArray | null;
  const contenido = contenidoDe(pdf);
  while ((m = tm.exec(contenido)) !== null) {
    ys.push(Number(m[2]));
  }
  return ys;
}

function sinCrecimientos(ys: number[]): boolean {
  // En coordenadas de PDF el arriba es grande: al bajar la pagina la Y baja.
  return ys.every((y, i) => i === 0 || y <= ys[i - 1] + 0.01);
}

function lineasDistintas(ys: number[]): number[] {
  const unicas: number[] = [];
  for (const y of ys) {
    if (unicas.length === 0 || Math.abs(unicas[unicas.length - 1] - y) > 0.01) {
      unicas.push(y);
    }
  }
  return unicas;
}

/** Texto dibujado en el documento, decodificando los `hex` de los operadores de muestra. */
function textoVisible(pdf: Buffer): string {
  const contenido = contenidoDe(pdf);
  const trozos: string[] = [];
  const hex = /<([0-9a-fA-F]+)>/g;
  let m: RegExpExecArray | null;
  while ((m = hex.exec(contenido)) !== null) {
    trozos.push(Buffer.from(m[1], 'hex').toString('latin1'));
  }
  return trozos.join('');
}

const COLUMNAS = [
  { titulo: 'Cédula', ancho: 65 },
  { titulo: 'Estudiante', ancho: 180 },
  { titulo: 'Directas', ancho: 60, alinear: 'right' as const },
  { titulo: 'Impacto', ancho: 55, alinear: 'right' as const },
  { titulo: 'Total', ancho: 55, alinear: 'right' as const },
];

async function muestra(): Promise<Buffer> {
  const pdf = new DocumentoPdf({
    titulo: 'Consolidado de prueba',
    subtitulo: 'Horas aprobadas por estudiante',
    datos: [
      { etiqueta: 'Periodo', valor: '2026-I' },
      { etiqueta: 'Alcance', valor: 'todos los estudiantes' },
      { etiqueta: 'Metas', valor: '90 h directas / 30 h de impacto' },
      { etiqueta: 'Emitido', valor: '1/1/2026' },
    ],
    generadoPor: 'Prueba (admin)',
  });

  pdf.tabla(COLUMNAS, [
    ['V-12345678', 'Ana Perez', '90,0', '30,0', '120,0'],
    // Nombre largo: si la celda se envuelve, la tabla se desborda.
    ['V-87654321', 'Maria Alejandra Rodriguez Gonzalez Hernandez de la Cruz', '45,0', '10,0', '55,0'],
    ['V-11223344', 'Luis González', '90,0', '30,0', '120,0'],
  ]);

  return pdf.finalizar('Prueba (admin)');
}

describe('maquetacion de los PDF', () => {
  it('el membrete no se pinta encima de la tabla (las Y bajan sin saltos)', async () => {
    const ys = coordenadasY(await muestra());

    expect(ys.length).toBeGreaterThan(20);
    expect(sinCrecimientos(ys)).toBe(true);
  });

  it('ninguna celda larga se envuelve: cada fila sigue siendo una sola linea', async () => {
    const ys = coordenadasY(await muestra());
    const lineas = lineasDistintas(ys);

    // 4 lineas de encabezado (nombre, institucion, titulo, subtitulo) +
    // 4 datos del membrete + cabecera de la tabla + 3 filas + pie de pagina.
    expect(lineas.length).toBe(13);
  });

  it('el documento cierra con %%EOF y pesa mas que un mensaje de error', async () => {
    const pdf = await muestra();
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1').includes('%%EOF')).toBe(true);
    expect(pdf.length).toBeGreaterThan(1000);
  });

  it('no agrega hojas de mas: una sola pagina con su pie dentro del area util', async () => {
    const pdf = await muestra();
    const visible = textoVisible(pdf);

    expect((pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length).toBe(1);
    expect(visible).toContain('Generado por');
    expect(visible).toContain('Página 1 de 1');
  });

  it('trunca la celda larga con puntos y la institucion sale con su nombre completo', async () => {
    const visible = textoVisible(await muestra());

    expect(visible).toContain('Instituto Universitario Adventista de Venezuela');
    expect(visible).toContain('...');

    const celda = 'Maria Alejandra Rodriguez Gonzalez Hernandez de la Cruz';
    expect(visible).not.toContain(celda);
    expect(visible.indexOf('...')).toBeGreaterThan(visible.indexOf(celda.slice(0, 20)));
  });
});

describe('texto seguro para Helvetica', () => {
  it('quita los caracteres que la fuente standard no sabe dibujar', () => {
    expect(pdfSeguro('Ana → Pérez 🙂')).toBe('Ana  Pérez ');
    expect(pdfSeguro('Línea uno\r\nLínea dos\tok')).toBe('Línea uno\nLínea dos ok');
    expect(pdfSeguro('tema • otro')).toBe('tema - otro');
  });

  it('conserva tildes, eñes y el rango Latin-1 completo', () => {
    expect(pdfSeguro('Organización ñandú Ç')).toBe('Organización ñandú Ç');
  });
});

describe('formato de cifras', () => {
  it('usa la coma decimal', () => {
    expect(horas(12.5)).toBe('12,5');
    expect(horas(90)).toBe('90,0');
  });

  it('acota el porcentaje a entero y no divide entre cero', () => {
    expect(porcentaje(45, 90)).toBe('50%');
    expect(porcentaje(1, 0)).toBe('0%');
    expect(porcentaje(200, 90)).toBe('100%');
  });
});
