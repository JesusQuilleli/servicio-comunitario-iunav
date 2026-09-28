import type { RegistroHoras } from "./types";

export const estadoRegistro: Record<
  RegistroHoras["estado"],
  { label: string; variant: "success" | "warning" | "danger" | "info" }
> = {
  aprobado: { label: "Aprobado", variant: "success" },
  pendiente: { label: "Pendiente", variant: "warning" },
  rechazado: { label: "Rechazado", variant: "danger" },
  corregir: { label: "Por corregir", variant: "info" },
};

export function formatearHoras(horas: number): string {
  return Number.isInteger(horas) ? `${horas}h` : `${horas}h`;
}

export function mostrarFecha(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${anio}`;
}