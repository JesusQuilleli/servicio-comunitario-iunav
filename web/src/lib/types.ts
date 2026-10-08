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
  /** La clave es una temporal entregada por el admin: hay que cambiarla. */
  passwordTemporal: boolean;
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
  /** Ruta del archivo en el servidor, o `null` si el registro no lleva evidencia. */
  evidenciaUrl: string | null;
  estado: "pendiente" | "aprobado" | "rechazado" | "corregir";
  comentarioTutor: string | null;
  proyecto: string | null;
  creadoEn: string;
}

/** Metas y límite vigente, los mismos valores que aplica el servidor. */
export interface Metas {
  horasDirectas: number;
  horasImpacto: number;
  limiteDiario: number;
  periodoActivo: number | null;
}

/** Estados en los que el estudiante todavía puede editar su registro. */
export const ESTADOS_EDITABLES: RegistroHoras["estado"][] = ["pendiente", "corregir"];

export function esEditable(registro: { estado: RegistroHoras["estado"] }): boolean {
  return ESTADOS_EDITABLES.includes(registro.estado);
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

export interface ConfiguracionSistema {
  horasDirectas: number;
  horasImpacto: number;
  limiteHorasDiarias: number;
  periodoActivoId: number | null;
  periodoActivoNombre: string | null;
  actualizadoEn: string;
}

export type TipoPlantilla = "bitacora" | "acta" | "informe" | "certificado";

export interface PlantillaDocumento {
  idPlantilla: number;
  nombre: string;
  descripcion: string | null;
  tipo: TipoPlantilla;
  urlDocumento: string | null;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export const tipoPlantillaLabels: Record<TipoPlantilla, string> = {
  bitacora: "Bitácora",
  acta: "Acta",
  informe: "Informe",
  certificado: "Certificado",
};

export const TIPOS_PLANTILLA: TipoPlantilla[] = ["bitacora", "acta", "informe", "certificado"];

/** Error de una fila durante la carga masiva de estudiantes. */
export interface ErrorImportacion {
  /** Número de fila en la plantilla (la 1 es el encabezado). */
  fila: number;
  campo: string;
  mensaje: string;
}

/** Clave inicial que dejó el servidor a un estudiante importado. */
export interface ClaveImportacion {
  fila: number;
  email: string;
  claveInicial: string;
}

export interface ResultadoImportacion {
  creados: number;
  asignados: number;
  errores: ErrorImportacion[];
  claves: ClaveImportacion[];
}