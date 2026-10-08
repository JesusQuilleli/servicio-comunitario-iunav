"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, FolderKanban, Loader2, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { RUTAS } from "@/lib/rutas";
import { useAuthStore } from "@/stores/authStore";
import type { ResultadosBusqueda, UserRole } from "@/lib/types";

const rolLabels: Record<UserRole, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  tutor: "Tutor",
  estudiante: "Estudiante",
};

interface ItemBusqueda {
  clave: string;
  grupo: "Usuarios" | "Proyectos" | "Bitácoras";
  icono: React.ElementType;
  principal: string;
  secundario: string;
  href: string;
}

/**
 * Busqueda global del encabezado: usuarios, proyectos y bitacoras, acotados al
 * rol por el backend. Los resultados navegan a la seccion correspondiente con
 * el filtro ya precargado (?q=...).
 */
export function BuscadorGlobal() {
  const router = useRouter();
  const rol = useAuthStore((s) => s.usuario?.rol);

  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState<ResultadosBusqueda | null>(null);
  const [activo, setActivo] = useState(-1);

  const raiz = useRef<HTMLDivElement>(null);
  const peticion = useRef(0);

  // Debounce: solo se consulta el servidor cuando hay 2+ caracteres. La
  // limpieza de resultados cortos ocurre al teclear (evento), no aqui.
  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) return;
    const timer = setTimeout(async () => {
      const id = ++peticion.current;
      try {
        const { data } = await api.get<ResultadosBusqueda>("/busqueda", {
          params: { q: texto },
        });
        if (id === peticion.current) {
          setResultados(data);
          setActivo(-1);
        }
      } catch {
        if (id === peticion.current) setResultados(null);
      } finally {
        if (id === peticion.current) setCargando(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  // Cierre al pulsar fuera del buscador.
  useEffect(() => {
    function alPulsar(e: MouseEvent) {
      if (raiz.current && !raiz.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alPulsar);
    return () => document.removeEventListener("mousedown", alPulsar);
  }, []);

  const grupos = useMemo(() => {
    if (!resultados) return [];
    const lista: ItemBusqueda[] = [];

    for (const u of resultados.usuarios) {
      lista.push({
        clave: `u-${u.idUsuario}`,
        grupo: "Usuarios",
        icono: User,
        principal: u.nombre,
        secundario: `${u.email} · ${rolLabels[u.rol]}`,
        href: `${RUTAS.usuarios}?q=${encodeURIComponent(u.nombre)}`,
      });
    }
    for (const p of resultados.proyectos) {
      lista.push({
        clave: `p-${p.idGrupo}`,
        grupo: "Proyectos",
        icono: FolderKanban,
        principal: p.nombre,
        secundario: p.tutorNombre ? `Tutor: ${p.tutorNombre}` : (p.periodo ?? ""),
        href: `${RUTAS.proyectos}?q=${encodeURIComponent(p.nombre)}`,
      });
    }
    for (const b of resultados.bitacoras) {
      const href =
        rol === "estudiante"
          ? b.tipo === "comunitario"
            ? `${RUTAS.bitacora}?q=${encodeURIComponent(b.descripcion)}`
            : `${RUTAS.servicio}?q=${encodeURIComponent(b.descripcion)}`
          : rol === "tutor"
            ? RUTAS.validacion
            : RUTAS.reportes;
      lista.push({
        clave: `b-${b.id}`,
        grupo: "Bitácoras",
        icono: Clock,
        principal: b.descripcion,
        secundario: `${b.estudianteNombre} · ${b.fecha}`,
        href,
      });
    }

    const porGrupo: { titulo: string; items: { item: ItemBusqueda; indice: number }[] }[] = [];
    lista.forEach((item, indice) => {
      let seccion = porGrupo.find((g) => g.titulo === item.grupo);
      if (!seccion) {
        seccion = { titulo: item.grupo, items: [] };
        porGrupo.push(seccion);
      }
      seccion.items.push({ item, indice });
    });
    return porGrupo;
  }, [resultados, rol]);

  const planos = useMemo(() => grupos.flatMap((g) => g.items.map((x) => x.item)), [grupos]);
  const total = planos.length;

  function irA(item: ItemBusqueda) {
    setAbierto(false);
    setQ("");
    setResultados(null);
    router.push(item.href);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setActivo((a) => (total === 0 ? -1 : (a + 1) % total));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActivo((a) => (total === 0 ? -1 : (a - 1 + total) % total));
    } else if (e.key === "Enter") {
      if (activo >= 0 && activo < total) {
        e.preventDefault();
        irA(planos[activo]);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  const mostrarDropdown = abierto && (cargando || q.trim().length >= 2);
  const vacio =
    resultados !== null &&
    !cargando &&
    resultados.usuarios.length === 0 &&
    resultados.proyectos.length === 0 &&
    resultados.bitacoras.length === 0;

  return (
    <div ref={raiz} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        placeholder="Buscar..."
        className="pl-9 w-40 sm:w-64 h-8 text-sm"
        value={q}
        onChange={(e) => {
          const valor = e.target.value;
          setQ(valor);
          setAbierto(true);
          if (valor.trim().length < 2) {
            // Invalida cualquier petición en vuelo para que no pueble
            // resultados de un texto que ya no está en el input.
            peticion.current++;
            setResultados(null);
            setCargando(false);
            setActivo(-1);
          } else {
            setCargando(true);
          }
        }}
        onFocus={() => setAbierto(true)}
        onKeyDown={alTeclear}
        aria-label="Buscar usuarios, proyectos o bitácoras"
      />

      {mostrarDropdown && (
        <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto rounded-lg border bg-white shadow-lg z-50">
          {cargando ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando...
            </div>
          ) : vacio ? (
            <div className="px-4 py-3 text-sm text-muted-foreground">
              Sin resultados para &ldquo;{q.trim()}&rdquo;
            </div>
          ) : (
            grupos.map((g) => (
              <div key={g.titulo}>
                <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.titulo}
                </p>
                {g.items.map(({ item, indice }) => {
                  const Icono = item.icono;
                  return (
                    <button
                      key={item.clave}
                      type="button"
                      onMouseEnter={() => setActivo(indice)}
                      onClick={() => irA(item)}
                      className={`flex w-full items-start gap-3 px-4 py-2 text-left transition-colors ${
                        activo === indice ? "bg-muted" : "hover:bg-muted/60"
                      }`}
                    >
                      <Icono className="h-4 w-4 mt-0.5 shrink-0 text-iunav-blue" />
                      <span className="min-w-0">
                        <span className="block truncate text-sm text-foreground">
                          {item.principal}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.secundario}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
