import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Usuario } from "@/lib/types";
import { clearSessionCookies } from "@/lib/cookies";

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  setSession: (token: string, usuario: Usuario) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      setSession: (token, usuario) => set({ token, usuario }),
      logout: () => {
        clearSessionCookies();
        set({ token: null, usuario: null });
      },
    }),
    { name: "iunav-auth" }
  )
);