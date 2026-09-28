export type UserRole = "admin" | "coordinador" | "tutor" | "estudiante";

export interface Usuario {
  idUsuario: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  rol: UserRole;
  firmaUrl: string | null;
  selloUrl: string | null;
  activo: boolean;
  creadoEn: string;
}

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export interface EntradaPendiente {
  id: string;
  tipo: "comunitario" | "social" | "ambiental";
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  estado: string;
}

export interface EntradaAprobada {
  id: string;
  tipo: "comunitario" | "social" | "ambiental";
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidencia: boolean;
}

export interface IntegranteConIniciales {
  id: string;
  nombre: string;
  iniciales: string;
}

export interface MiProyecto {
  nombreProyecto: string;
  periodo: string;
  tutorNombre: string | null;
  estado: string;
  proyectoEscrito: boolean;
  diapositivas: boolean;
  integrantes: IntegranteConIniciales[];
}

export interface DashEstudiante {
  rol: "estudiante";
  horasDirectas: number;
  horasImpacto: number;
  totalHoras: number;
  metas: { directas: number; impacto: number };
  pctDirecto: number;
  pctImpacto: number;
  pendientesCount: number;
  proyecto: MiProyecto | null;
  pendientes: EntradaPendiente[];
  aprobadasRecientes: EntradaAprobada[];
}

export interface DashTutor {
  rol: "tutor";
  resumen: { pendientes: number; aprobadas: number; rechazadas: number; estudiantes: number; proyectos: number };
  proyectos: { id: string; nombre: string; periodo: string; estado: string; integrantes: IntegranteConIniciales[] }[];
  pendientes: (EntradaPendiente & { estudianteNombre: string })[];
}

export interface DashGestion {
  rol: "coordinador" | "admin";
  resumen: { estudiantes: number; tutores: number; proyectosEnCurso: number; horasValidadas: number; pendientes: number };
  horas: { directas: number; impacto: number; totalRegistradas: number; metaDirectas: number; metaImpacto: number };
  proyectosPendientes: { idGrupo: string; nombre: string; tutorNombre: string | null; materialCompleto: boolean }[];
  tutores: { id: string; nombre: string; cedula: string; firma: boolean; sello: boolean }[];
  actividad: { id: string; descripcion: string; fecha: string; tipo: string; usuario: string }[];
}

export type DashboardPayload = DashEstudiante | DashTutor | DashGestion;

export type TipoRegistro = "comunitario" | "social" | "ambiental";

export interface RegistroHoras {
  id: string;
  tipo: TipoRegistro;
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidencia: boolean;
  estado: "pendiente" | "aprobado" | "rechazado" | "corregir";
  comentarioTutor: string | null;
  proyecto: string | null;
  creadoEn: string;
}

export interface GrupoEstudiante {
  idGrupo: string;
  nombreProyecto: string;
  estado: string;
}

export interface PendienteTutor {
  id: string;
  idEstudiante: string;
  estudianteNombre: string;
  idGrupo: string | null;
  proyectoNombre: string | null;
  tipo: TipoRegistro;
  semana: number | null;
  fecha: string;
  descripcion: string;
  horas: number;
  evidenciaUrl: string | null;
  estado: string;
}

export const roleLabels: Record<UserRole, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  tutor: "Tutor",
  estudiante: "Estudiante",
};

export type EstadoGrupo = "en_curso" | "pendiente_aprobacion" | "finalizado" | "suspendido";

export type EstadoFinal = "en_curso" | "aprobado" | "reprobado";

export interface Integrante {
  idUsuario: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  activo: boolean;
  estadoFinal: EstadoFinal | null;
  horasAprobadas: number;
  horasPendientes: number;
}

export interface Grupo {
  idGrupo: string;
  nombreProyecto: string;
  estado: EstadoGrupo;
  periodoId: number | null;
  periodo: string | null;
  tutorId: string | null;
  tutorNombre: string | null;
  coordinadorId: string | null;
  coordinadorNombre: string | null;
  proyectoEscritoUrl: string | null;
  diapositivasUrl: string | null;
  integrantes: number;
  horasAprobadas: number;
  horasPendientes: number;
  creadoEn: string;
}

export type DetalleGrupo = Grupo & { listaIntegrantes: Integrante[] };

export interface PeriodoAcademico {
  idPeriodo: number;
  nombrePeriodo: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

export const estadoGrupoLabels: Record<EstadoGrupo, string> = {
  en_curso: "En curso",
  pendiente_aprobacion: "Pendiente de aprobación",
  finalizado: "Finalizado",
  suspendido: "Suspendido",
};

export const estadoFinalLabels: Record<EstadoFinal, string> = {
  en_curso: "En curso",
  aprobado: "Aprobado",
  reprobado: "Reprobado",
};

export const ESTADOS_GRUPO: EstadoGrupo[] = [
  "en_curso",
  "pendiente_aprobacion",
  "finalizado",
  "suspendido",
];

export const ESTADOS_FINAL: EstadoFinal[] = ["en_curso", "aprobado", "reprobado"];