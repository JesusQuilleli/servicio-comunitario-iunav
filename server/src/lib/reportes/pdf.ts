import PDFDocument from 'pdfkit';

/**
 * Base comun de los PDF del sistema: membrete, pie con paginas y una tabla
 * pequena con salto de pagina automatico.
 *
 * Se usan las fuentes estandar de PDFKit (Helvetica): cubren el espanol con
 * tilde, y no obligan a registrar ningun archivo .ttf en el repositorio.
 */

export type Alineacion = 'left' | 'right' | 'center';

export interface Columna {
  titulo: string;
  /** Ancho en puntos. */
  ancho: number;
  alinear?: Alineacion;
}

export interface EstiloMembrete {
  titulo: string;
  subtitulo: string;
  /** Pares etiqueta/valor mostrados bajo el membrete. */
  datos?: { etiqueta: string; valor: string }[];
  /** Quien generó el documento; va al pie. */
  generadoPor: string;
}

const AZUL = '#1e3a5f';
const GRIS = '#6b7280';
const BORDE = '#d1d5db';

const MARGEN = 40;

export class DocumentoPdf {
  readonly doc: PDFKit.PDFDocument;
  private anchoUtil: number;

  constructor(membrete: EstiloMembrete) {
    this.doc = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      bufferPages: true,
      info: {
        Title: membrete.titulo,
        Author: 'Sistema de Gestion del Servicio Comunitario IUNAV',
        Creator: 'Comunidad IUNAV',
      },
    });
    this.anchoUtil = this.doc.page.width - MARGEN * 2;
    this.membrete(membrete);
  }

  private membrete(m: EstiloMembrete): void {
    const { doc } = this;
    doc.fillColor(AZUL).font('Helvetica-Bold').fontSize(16);
    doc.text('COMUNIDAD IUNAV', { align: 'center' });
    doc.fontSize(13).text(m.titulo, { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor(GRIS);
    doc.text(m.subtitulo, { align: 'center' });
    doc.moveDown(0.8);

    if (m.datos?.length) {
      const y = doc.y;
      doc.fontSize(9);
      for (const d of m.datos) {
        doc
          .font('Helvetica-Bold')
          .fillColor(AZUL)
          .text(`${d.etiqueta}: `, { continued: true })
          .font('Helvetica')
          .fillColor(GRIS)
          .text(d.valor);
      }
      doc.y = y;
      doc.moveDown(0.8);
    }

    this.linea();
    doc.moveDown(0.5);
  }

  linea(): void {
    this.doc
      .moveDown(0.2)
      .strokeColor(BORDE)
      .lineWidth(0.8)
      .moveTo(MARGEN, this.doc.y)
      .lineTo(MARGEN + this.anchoUtil, this.doc.y)
      .stroke();
  }

  /**
   * Dibuja una tabla. Si no cabe, empieza otra pagina y vuelve a pintar la
   * fila de cabeceras, para que ninguna hoja quede sin titulo.
   */
  tabla(columnas: Columna[], filas: string[][], opciones: { size?: number } = {}): void {
    const { doc } = this;
    const size = opciones.size ?? 8.5;
    const altoFila = 16;

    const cabecera = () => {
      const y = this.doc.y;
      doc.rect(MARGEN, y, this.anchoUtil, altoFila).fill('#f3f4f6');
      let x = MARGEN;
      doc.font('Helvetica-Bold').fontSize(size).fillColor(AZUL);
      for (const c of columnas) {
        doc.text(c.titulo, x + 4, y + 4, {
          width: c.ancho - 8,
          align: c.alinear ?? 'left',
          lineBreak: false,
        });
        x += c.ancho;
      }
      doc.y = y + altoFila;
    };

    if (doc.y + altoFila * 2 > doc.page.height - MARGEN - 30) {
      doc.addPage();
    }
    cabecera();

    for (const fila of filas) {
      if (doc.y + altoFila > doc.page.height - MARGEN - 30) {
        doc.addPage();
        cabecera();
      }
      const y = doc.y;
      let x = MARGEN;
      doc.font('Helvetica').fontSize(size).fillColor('#111827');
      columnas.forEach((c, i) => {
        doc.text(fila[i] ?? '', x + 4, y + 4, {
          width: c.ancho - 8,
          align: c.alinear ?? 'left',
          lineBreak: false,
          ellipsis: true,
        });
        x += c.ancho;
      });
      doc.y = y + altoFila;
      this.lineaFila(y + altoFila);
    }
    doc.moveDown(0.8);
  }

  private lineaFila(y: number): void {
    this.doc
      .strokeColor(BORDE)
      .lineWidth(0.4)
      .moveTo(MARGEN, y)
      .lineTo(MARGEN + this.anchoUtil, y)
      .stroke();
  }

  parrafo(texto: string, opciones: { size?: number; negrita?: boolean; color?: string } = {}): void {
    const { doc } = this;
    doc
      .font(opciones.negrita ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(opciones.size ?? 9.5)
      .fillColor(opciones.color ?? '#111827')
      .text(texto, { align: 'justify' });
    doc.moveDown(0.4);
  }

  tituloSeccion(texto: string): void {
    if (this.doc.y > this.doc.page.height - MARGEN - 90) {
      this.doc.addPage();
    }
    this.doc.moveDown(0.4).fillColor(AZUL).font('Helvetica-Bold').fontSize(11).text(texto);
    this.linea();
    this.doc.moveDown(0.5);
  }

  /** Cierra el documento y devuelve los bytes, con pie de página en todas las hojas. */
  async finalizar(generadoPor: string): Promise<Buffer> {
    const { doc } = this;
    const rango = doc.bufferedPageRange();

    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      const y = doc.page.height - 34;
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(GRIS)
        .text(`Generado por ${generadoPor}`, MARGEN, y, {
          width: this.anchoUtil / 2,
          align: 'left',
          lineBreak: false,
        })
        .text(`Página ${i + 1} de ${rango.count}`, MARGEN + this.anchoUtil / 2, y, {
          width: this.anchoUtil / 2,
          align: 'right',
          lineBreak: false,
        });
    }

    const partes: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      doc.on('data', (trozo: Buffer) => partes.push(trozo));
      doc.on('end', resolve);
      doc.on('error', reject);
      doc.end();
    });
    return Buffer.concat(partes);
  }

  /** Salto de pagina a proposito, para Firmas y anexos. */
  nuevaPagina(): void {
    this.doc.addPage();
    this.linea();
    this.doc.moveDown(0.5);
  }
}

/** Normaliza texto a los caracteres que las fuentes estándar de PDFKit saben dibujar. */
export function pdfSeguro(texto: string): string {
  return texto
    .replace(/\u2014/g, '-')
    .replace(/\u2013/g, '-')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/[^\x20-\x7E\u00A0-\u00FF\n]/g, '');
}

/** `12.5` -> `12,5`, con el separador decimal que se usa en Venezuela. */
export function horas(valor: number): string {
  return valor.toFixed(1).replace('.', ',');
}

/** `72.4%` acotado a un entero. */
export function porcentaje(parte: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.min(100, Math.round((parte / total) * 100))}%`;
}