"use client";

import { Clock, Leaf, TriangleAlert } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Metas } from "@/lib/types";

/**
 * Avance de las metas del estudiante.
 *
 * Solo cuentan las horas **aprobadas**: es la misma regla que aplica el servidor
 * al bloquear un registro, así que el número que ve aquí es el que manda.
 */
export function MetasPanel({
  horasDirectas,
  horasImpacto,
  metas,
}: {
  horasDirectas: number;
  horasImpacto: number;
  metas: Metas;
}) {
  const directo = Math.min(100, Math.round((horasDirectas / metas.horasDirectas) * 100));
  const impacto = Math.min(100, Math.round((horasImpacto / metas.horasImpacto) * 100));

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Metrica
        icono={<Clock className="h-4 w-4 text-iunav-blue" />}
        titulo="Trabajo directo"
        horas={horasDirectas}
        meta={metas.horasDirectas}
        porcentaje={directo}
      />
      <Metrica
        icono={<Leaf className="h-4 w-4 text-emerald-600" />}
        titulo="Impacto social y ambiental"
        horas={horasImpacto}
        meta={metas.horasImpacto}
        porcentaje={impacto}
      />
      <p className="sm:col-span-2 flex items-start gap-2 text-xs text-muted-foreground">
        <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        Solo cuentan las horas aprobadas por tu tutor/a. El máximo es de {metas.limiteDiario} horas
        por día; al pasar la meta el servidor rechaza el registro.
      </p>
    </div>
  );
}

function Metrica({
  icono,
  titulo,
  horas,
  meta,
  porcentaje,
}: {
  icono: React.ReactNode;
  titulo: string;
  horas: number;
  meta: number;
  porcentaje: number;
}) {
  const faltan = Math.max(0, meta - horas);
  const completa = faltan === 0;

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        {icono}
        {titulo}
      </div>
      <p className="mt-2 text-2xl font-bold text-foreground">
        {horas}
        <span className="text-base font-normal text-muted-foreground"> / {meta} h</span>
      </p>
      <Progress value={porcentaje} className="mt-3 h-1.5" />
      <p className="mt-2 text-xs text-muted-foreground">
        {completa ? "Meta completada." : `Te faltan ${faltan} h.`}
      </p>
    </div>
  );
}