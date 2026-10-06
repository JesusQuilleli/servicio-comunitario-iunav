export type UserRole = 'admin' | 'coordinador' | 'tutor' | 'estudiante';

export interface UsuarioPublico {
  idUsuario: string;
  nombreCompleto: string;
  cedula: string;
  email: string;
  rol: UserRole;
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