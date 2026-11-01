import dotenv from 'dotenv';

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Falta la variable de entorno: ${name}. Copia server/.env.example a server/.env`);
  }
  return value;
}

function entero(name: string, porDefecto: number): number {
  const crudo = process.env[name];
  if (crudo === undefined || crudo.trim() === '') {
    return porDefecto;
  }
  const valor = Number(crudo);
  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(`${name} debe ser un numero positivo. Received: ${crudo}`);
  }
  return valor;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  /**
   * Interfaz donde escucha el API. Por defecto `127.0.0.1` y no `0.0.0.0`: en la
   * VPS hay un Caddy delante (deploy/Caddyfile) y el API nunca debe ser
   * alcanzable desde la red publica. Se sube a `0.0.0.0` solo si se corre en
   * un contenedor, donde el proxy vive en otra maquina.
   */
  apiHost: process.env.API_HOST ?? '127.0.0.1',
  databaseUrl: required('DATABASE_URL'),
  dbSsl: process.env.DB_SSL !== 'false',
  /**
   * Conexiones simultaneas a PostgreSQL.
   *
   * Es el techo real de concurrencia del sistema: cuando las peticiones en
   * vuelo superan este numero, las demas esperan, y si esperan mas de
   * `connectionTimeoutMillis` fallan con 500. Medido con 1000 estudiantes a la
   * vez (ver docs/Prueba-de-Carga.md), 10 se queda corto.
   *
   * No subirlo por encima de lo que admita el `max_connections` del servidor de
   * PostgreSQL (100 por defecto), contando que puede haber mas de un proceso.
   */
  dbPoolMax: entero('DB_POOL_MAX', 10),
  jwtSecret: required('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',

  // Almacenamiento de archivos. `uploadDir` es relativo a la raiz de `server/`.
  uploadDir: process.env.UPLOAD_DIR ?? 'uploads',
  // Las evidencias son fotos del celular: 10 MB es holgado. Los documentos del
  // proyecto (proyecto escrito, diapositivas) suelen ser PDF pesados.
  maxEvidenciaMb: entero('MAX_EVIDENCIA_MB', 10),
  maxDocumentoMb: entero('MAX_DOCUMENTO_MB', 25),

  // Rate limiting del login. En pruebas se desactiva: ver `src/app.ts`.
  rateLimitLogin: entero('RATE_LIMIT_LOGIN', 10),
  rateLimitLoginVentanaMs: entero('RATE_LIMIT_LOGIN_VENTANA_MS', 15 * 60 * 1000),

  /**
   * Correo saliente (modulo de notificaciones).
   *
   * Sin `SMTP_HOST` el modulo queda inerte: las notificaciones se siguen
   * encolando en la tabla `notificaciones` y se pueden reintentar cuando haya
   * un servidor configurado, pero no sale ningun correo. Es lo que ocurre en la
   * instalacion local, que esta pensada para funcionar sin internet.
   */
  smtpHost: process.env.SMTP_HOST ?? '',
  smtpPort: entero('SMTP_PORT', 587),
  // TLS directo (puerto 465). En 587 se negocia con STARTTLS y esto va en false.
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER ?? '',
  smtpPass: process.env.SMTP_PASS ?? '',
  /** Remitente. Si falta, se usa `SMTP_USER`. */
  smtpDesde: process.env.SMTP_DESDE ?? process.env.SMTP_USER ?? '',
};

/** `true` cuando hay un servidor de correo configurado. */
export function correoConfigurado(): boolean {
  return env.smtpHost.trim() !== '';
}