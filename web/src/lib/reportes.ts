import { api } from "@/lib/api";

/**
 * Descarga de reportes (PDF y Excel).
 *
 * Los reportes exigen token, asi que no pueden bajarse con un `<a href>`: se
 * piden con axios como `blob` y se le entregan al navegador como descarga, con
 * el nombre que fijo el servidor.
 */

export const RUTA_CONSOLIDADO_PDF = "consolidado-horas.pdf";
export const RUTA_CONSOLIDADO_XLSX = "consolidado-horas.xlsx";

export interface FiltroReporte {
  periodoId?: number | null;
  grupoId?: string | null;
}

type Parametros = Record<string, number | string | null | undefined>;

/** Nombre de la cabecera `Content-Disposition`, o `null` si no lo trae. */
function nombreDe(disposicion: string | undefined): string | null {
  if (!disposicion) return null;
  const entrecomillado = /filename="([^"]+)"/.exec(disposicion);
  if (entrecomillado) return entrecomillado[1];
  const suelto = /filename=([^;]+)/.exec(disposicion);
  return suelto ? suelto[1].trim() : null;
}

function guardaComo(contenido: Blob, nombre: string): void {
  const url = URL.createObjectURL(contenido);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  // Sin esto el blob sigue retenido en memoria hasta que se recargue la pagina.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Pide el reporte y lo guarda. Devuelve el nombre con el que quedo en disco
 * para poder confirmarlo en la interfaz.
 */
export async function descargarReporte(
  ruta: string,
  filtros: FiltroReporte = {}
): Promise<string> {
  const res = await api.get(`/reportes/${ruta}`, {
    params: filtros as Parametros,
    responseType: "blob",
  });

  const nombre =
    nombreDe(res.headers["content-disposition"] as string | undefined) ??
    `reporte.${ruta.endsWith(".xlsx") ? "xlsx" : "pdf"}`;

  guardaComo(res.data as Blob, nombre);
  return nombre;
}

/** Acta de culminación de un grupo concreto. */
export function descargarActa(idGrupo: string): Promise<string> {
  return descargarReporte(`acta/${idGrupo}.pdf`);
}

/** Certificado de un estudiante. `periodoId` vacío significa todos los periodos. */
export function descargarCertificado(
  idUsuario: string,
  periodoId?: number | null
): Promise<string> {
  return descargarReporte(`certificado/${idUsuario}.pdf`, { periodoId });
}

/**
 * Extrae el mensaje de error de la API. Con `responseType: "blob"` el cuerpo
 * del error tambien llega como Blob, asi que hay que leerlo aparte.
 */
export async function mensajeDeError(
  error: unknown,
  porDefecto = "No se pudo generar el reporte."
): Promise<string> {
  const cuerpo = (error as { response?: { data?: unknown } })?.response?.data;

  if (cuerpo instanceof Blob) {
    try {
      const datos = JSON.parse(await cuerpo.text()) as { message?: string };
      return datos.message ?? porDefecto;
    } catch {
      return porDefecto;
    }
  }

  const mensaje = (cuerpo as { message?: string } | undefined)?.message;
  return mensaje ?? porDefecto;
}