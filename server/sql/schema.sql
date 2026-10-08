-- ============================================================
-- Sistema de Gestión de Servicio Comunitario IUNAV
-- Esquema de base de datos (PostgreSQL 15 o superior)
-- Ejecutar con: psql -d app_iunav -f sql/schema.sql
-- ============================================================

-- Extensión para generación de UUIDs
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- usuarios
-- ------------------------------------------------------------
create table if not exists usuarios (
  id_usuario uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  cedula text not null unique,
  email text not null unique,
  password_hash text not null,
  -- El admin puede restablecer la clave y dejar una temporal: mientras siga en
  -- true, el usuario solo puede cambiar su contraseña (ver `middleware/auth.ts`).
  password_temporal boolean not null default false,
  password_cambiado_en timestamptz,
  rol text not null check (rol in ('admin', 'coordinador', 'tutor', 'estudiante')),
  firma_url text,
  sello_url text,
  activo boolean not null default true,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- periodos_academicos
-- ------------------------------------------------------------
create table if not exists periodos_academicos (
  id_periodo serial primary key,
  nombre_periodo text not null,
  fecha_inicio date not null,
  fecha_fin date not null,
  activo boolean not null default true
);

-- ------------------------------------------------------------
-- grupos_proyectos
-- ------------------------------------------------------------
create table if not exists grupos_proyectos (
  id_grupo uuid primary key default gen_random_uuid(),
  nombre_proyecto text not null,
  id_periodo int references periodos_academicos(id_periodo),
  id_tutor uuid references usuarios(id_usuario),
  id_coordinador uuid references usuarios(id_usuario),
  proyecto_escrito_url text,
  diapositivas_url text,
  estado text not null default 'en_curso'
    check (estado in ('en_curso', 'pendiente_aprobacion', 'finalizado', 'suspendido')),
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- integrantes_grupo (tabla pivote estudiante <-> grupo)
-- ------------------------------------------------------------
create table if not exists integrantes_grupo (
  id_grupo uuid references grupos_proyectos(id_grupo) on delete cascade,
  id_estudiante uuid references usuarios(id_usuario),
  estado_final text check (estado_final in ('en_curso', 'aprobado', 'reprobado')),
  primary key (id_grupo, id_estudiante)
);

-- ------------------------------------------------------------
-- bitacoras_comunitario (trabajo directo -> meta 90h)
-- ------------------------------------------------------------
create table if not exists bitacoras_comunitario (
  id_bitacora uuid primary key default gen_random_uuid(),
  id_estudiante uuid not null references usuarios(id_usuario),
  id_grupo uuid references grupos_proyectos(id_grupo),
  numero_semana int not null check (numero_semana >= 1),
  fecha_actividad date not null,
  descripcion text not null,
  horas_invertidas numeric(4, 1) not null check (horas_invertidas > 0),
  evidencia_foto_url text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'corregir')),
  comentario_tutor text,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- control_servicios_institucionales (impacto social/ambiental -> meta 30h)
-- ------------------------------------------------------------
create table if not exists control_servicios_institucionales (
  id_registro uuid primary key default gen_random_uuid(),
  id_estudiante uuid not null references usuarios(id_usuario),
  tipo text not null check (tipo in ('social', 'ambiental')),
  fecha_actividad date not null,
  descripcion text not null,
  horas_invertidas numeric(4, 1) not null check (horas_invertidas > 0),
  evidencia_foto_url text,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobado', 'rechazado', 'corregir')),
  comentario_tutor text,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- configuracion_sistema (reglas del programa)
-- ------------------------------------------------------------
create table if not exists configuracion_sistema (
  id_config serial primary key,
  horas_directas int not null default 90,
  horas_impacto int not null default 30,
  limite_horas_diarias int not null default 8,
  periodo_activo int references periodos_academicos(id_periodo),
  actualizado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- plantillas_documento (formatos base del programa)
-- ------------------------------------------------------------
create table if not exists plantillas_documento (
  id_plantilla serial primary key,
  nombre text not null unique,
  descripcion text,
  tipo text not null default 'bitacora'
    check (tipo in ('bitacora', 'acta', 'informe', 'certificado')),
  url_documento text,
  activo boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- solicitudes_cambio (cambios de datos de cuenta bajo autorizacion)
-- ------------------------------------------------------------
-- El estudiante no edita su cuenta: propone y el coordinador (o el admin)
-- aprueba. Cada fila es un campo pedido; al aprobarse se aplica al usuario.
create table if not exists solicitudes_cambio (
  id_solicitud uuid primary key default gen_random_uuid(),
  id_usuario uuid not null references usuarios(id_usuario) on delete cascade,
  campo text not null check (campo in ('nombre_completo', 'email')),
  valor_anterior text,
  valor_nuevo text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  comentario text,
  id_resolvio uuid references usuarios(id_usuario),
  creado_en timestamptz not null default now(),
  resuelto_en timestamptz
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create unique index if not exists idx_configuracion_unica on configuracion_sistema ((true));
create index if not exists idx_plantillas_tipo on plantillas_documento(tipo);
create index if not exists idx_usuarios_rol on usuarios(rol);
create index if not exists idx_bitacoras_estudiante on bitacoras_comunitario(id_estudiante);
create index if not exists idx_control_estudiante on control_servicios_institucionales(id_estudiante);
create index if not exists idx_grupos_tutor on grupos_proyectos(id_tutor);
create index if not exists idx_integrantes_estudiante on integrantes_grupo(id_estudiante);
create index if not exists idx_solicitudes_estado on solicitudes_cambio(estado);
create index if not exists idx_solicitudes_usuario on solicitudes_cambio(id_usuario);

-- ------------------------------------------------------------
-- Ajustes sobre bases ya creadas
-- ------------------------------------------------------------
-- `create table if not exists` no toca las tablas que ya existen, asi que las
-- columnas anadidas despues de la primera version se anaden aqui. Es
-- idempotente: se puede volver a ejecutar el esquema cuantas veces se quiera.
alter table usuarios add column if not exists password_temporal boolean not null default false;
alter table usuarios add column if not exists password_cambiado_en timestamptz;