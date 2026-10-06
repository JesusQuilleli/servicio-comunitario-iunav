import { Shell } from "@/components/Shell";
import { exigeSesion } from "@/lib/guardia";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  // Lee la cookie de sesion en el servidor: sin token la ruta no llega a
  // renderizar nada, ni siquiera un marco vacio que despues se llenaria.
  await exigeSesion();

  return <Shell>{children}</Shell>;
}