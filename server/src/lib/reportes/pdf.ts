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

/** Nombre completo de la institucion: IUNAV. */
export const NOMBRE_INSTITUCION = 'Instituto Universitario Adventista de Venezuela';

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
    doc.font('Helvetica').fontSize(9).fillColor(GRIS);
    doc.text(NOMBRE_INSTITUCION, { align: 'center' });
    doc.font('Helvetica-Bold').fontSize(13).fillColor(AZUL);
    doc.text(pdfSeguro(m.titulo), { align: 'center' });
    doc.font('Helvetica').fontSize(10).fillColor(GRIS);
    doc.text(pdfSeguro(m.subtitulo), { align: 'center' });
    doc.moveDown(0.8);

    // Cada par etiqueta/valor es una linea: la llamada con `continued` deja el
    // cursor (y) donde estaba y la del valor lo baja. El cursor NO se retrocede
    // despues del bloque: hacerlo pintaba la linea y la tabla encima de estos
    // datos, que era justo el texto encimado de los reportes.
    if (m.datos?.length) {
      doc.fontSize(9);
      for (const d of m.datos) {
        doc
          .font('Helvetica-Bold')
          .fillColor(AZUL)
          .text(pdfSeguro(`${d.etiqueta}: `), { continued: true })
          .font('Helvetica')
          .fillColor(GRIS)
          .text(pdfSeguro(d.valor));
      }
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
   *
   * Las celdas NO se envuelven: cada fila mide `altoFila` fijo, y una celda
   * que pasara a segunda linea caeria encima de la fila siguiente (el motivo
   * por el que los reportes se leian encimados). `ellipsis` de PDFKit no sirve
   * aqui porque solo funciona con `height`, asi que el corte se hace a mano
   * midiendo el texto con la misma fuente con la que se va a pintar.
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
        doc.text(this.truncar(pdfSeguro(c.titulo), c.ancho - 8), x + 4, y + 4, {
          width: c.ancho - 8,
          align: c.alinear ?? 'left',
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
        doc.text(this.truncar(pdfSeguro(fila[i] ?? ''), c.ancho - 8), x + 4, y + 4, {
          width: c.ancho - 8,
          align: c.alinear ?? 'left',
        });
        x += c.ancho;
      });
      doc.y = y + altoFila;
      this.lineaFila(y + altoFila);
    }
    doc.moveDown(0.8);
  }

  /**
   * Corta el texto para que quepa en `ancho` puntos con la fuente activa,
   * terminando en `...` y, si hay donde cortar, en un limite de palabra.
   */
  private truncar(texto: string, ancho: number): string {
    const { doc } = this;
    if (ancho <= 0 || doc.widthOfString(texto) <= ancho) return texto;

    const sufijo = '...';
    let corte = texto;
    while (corte.length > 0 && doc.widthOfString(corte + sufijo) > ancho) {
      corte = corte.slice(0, -1);
    }

    const espacio = corte.lastIndexOf(' ');
    if (espacio > 0 && espacio >= corte.length - corte.length * 0.4) {
      corte = corte.slice(0, espacio);
    }

    const resultado = `${corte}${sufijo}`;
    return doc.widthOfString(resultado) <= ancho ? resultado : sufijo;
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
      .text(pdfSeguro(texto), { align: 'justify' });
    doc.moveDown(0.4);
  }

  tituloSeccion(texto: string): void {
    if (this.doc.y > this.doc.page.height - MARGEN - 90) {
      this.doc.addPage();
    }
    this.doc
      .moveDown(0.4)
      .fillColor(AZUL)
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(pdfSeguro(texto));
    this.linea();
    this.doc.moveDown(0.5);
  }

  /**
   * Cierra el documento y devuelve los bytes, con pie de página en todas las hojas.
   *
   * El pie se dibuja dentro del área útil (`page.maxY()`): PDFKit se niega a
   * componer texto por debajo de ese límite y en su lugar agregaba una página
   * nueva con el renglón suelto en la parte de arriba, dejando los reportes
   * con hojas de más y sin pie.
   */
  async finalizar(generadoPor: string): Promise<Buffer> {
    const { doc } = this;
    const rango = doc.bufferedPageRange();
    const emisor = pdfSeguro(generadoPor);

    for (let i = rango.start; i < rango.start + rango.count; i++) {
      doc.switchToPage(i);
      // 10pt sobre el limite inferior: alcanza para el renglon (≈9pt a 7,5pt)
      // sin que el salto de pagina de PDFKit entre en escena.
      const y = doc.page.maxY() - 10;
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(GRIS)
        .text(`Generado por ${emisor}`, MARGEN, y, {
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

/**
 * Normaliza texto a los caracteres que las fuentes estándar de PDFKit saben
 * dibujar (Helvetica = WinAnsi: ASCII + Latin-1). Todo lo que entra al
 * documento pasa por aqui, porque un carácter fuera de ese rango se pierde en
 * silencio y deja huecos en el reporte.
 */
export function pdfSeguro(texto: string): string {
  return texto
    .replace(/[\u2014\u2013]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2022\u00b7]/g, '-')
    .replace(/\t/g, ' ')
    .replace(/\r/g, '')
    .replace(/[^\x20-\x7e\u00a0-\u00ff\n]/g, '');
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