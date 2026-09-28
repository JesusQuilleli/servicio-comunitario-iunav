"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

export function useApiData<T>(url: string, enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [peticionResuelta, setPeticionResuelta] = useState<string | null>(null);

  const clave = enabled ? `${url}::${reloadKey}` : null;

  const reload = useCallback(() => {
    setError(null);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (clave === null) return;

    let activo = true;

    api
      .get<T>(url)
      .then((res) => {
        if (!activo) return;
        setData(res.data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!activo) return;
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
        setError(msg ?? "No se pudieron cargar los datos del servidor.");
      })
      .finally(() => {
        if (activo) setPeticionResuelta(clave);
      });

    return () => {
      activo = false;
    };
  }, [clave, url]);

  const loading = clave !== null && peticionResuelta !== clave;

  return { data, loading, error, reload };
}
