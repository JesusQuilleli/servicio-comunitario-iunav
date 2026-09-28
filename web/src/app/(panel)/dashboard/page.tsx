"use client";

import { GraduationCap } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { DashboardView } from "@/components/dashboards/DashboardView";
import { EstudianteDashboard } from "@/components/dashboards/EstudianteDashboard";
import { TutorDashboard } from "@/components/dashboards/TutorDashboard";
import { CoordinadorDashboard } from "@/components/dashboards/CoordinadorDashboard";

export default function DashboardPage() {
  const usuario = useAuthStore((s) => s.usuario);

  if (!usuario) {
    return (
      <div className="flex items-center justify-center h-full">
        <GraduationCap className="h-6 w-6 text-muted-foreground animate-pulse" />
      </div>
    );
  }

  switch (usuario.rol) {
    case "estudiante":
      return <EstudianteDashboard user={usuario} />;
    case "tutor":
      return <TutorDashboard user={usuario} />;
    case "coordinador":
      return <CoordinadorDashboard user={usuario} />;
    default:
      return <DashboardView user={usuario} />;
  }
}