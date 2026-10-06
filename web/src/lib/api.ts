import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  // Sin `Content-Type` fijo: axios lo deduce del cuerpo. Si se fijara aquí,
  // los `FormData` de las subidas de archivo saldrían declarados como JSON y el
  // servidor los ignoraría.
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? "";

    if (status === 401 && !url.includes("/auth/login") && !url.includes("/auth/me")) {
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = `${window.location.origin}/login`;
      }
    }
    return Promise.reject(error);
  }
);