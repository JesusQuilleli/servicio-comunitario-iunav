export type UserRole = 'admin' | 'coordinador' | 'tutor' | 'estudiante';

/**
 * Subtipo del rol `tutor`. No es un rol aparte: los dos entran igual al sistema
 * y los dos validan horas. Es `null` para cualquier otro rol.
 */
export type TipoTutorUsuario = 'academico' | 'comunitario' | null;

export interface UsuarioPublico {
  idUsuario: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  rol: UserRole;
  /** Solo para el rol `tutor`: academico o comunitario. `null` en el resto. */
  tipoTutor: TipoTutorUsuario;
  firmaUrl: string | null;
  selloUrl: string | null;
  activo: boolean;
  creadoEn: Date;
  /** La clave es una temporal entregada por el admin: hay que cambiarla. */
  passwordTemporal: boolean;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface RegisterBody {
  nombreCompleto: string;
  cedula: string;
  email: string;
  password: string;
  rol: UserRole;
}