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
  -- Un tutor es Academico (el profesor que guia el proyecto) o Comunitario (el
  -- de la institucion donde se presta el servicio). No es un rol aparte: los dos
  -- entran al sistema igual y los dos validan horas de su grupo. Separarlo en
  -- dos roles obligaria a revisar cada `requireRole` y cada rama `rol === 'tutor'`
  -- del codigo, incluido el desplazamiento de parametros de `busqueda.model.ts`.
  tipo_tutor text,
  -- Ojo con la logica ternaria de SQL: un CHECK solo rechaza cuando la
  -- expresion da FALSE, y la deja pasar cuando da NULL. Escrito como
  -- `rol = 'tutor' and tipo_tutor in (...)`, un tutor con `tipo_tutor` nulo
  -- evalua a NULL y la fila entraba igual. El `is not null` explicito es lo que
  -- fuerza el FALSE.
  constraint usuarios_tipo_tutor_check check (
    case
      when rol = 'tutor' then tipo_tutor is not null
                              and tipo_tutor in ('academico', 'comunitario')
      else tipo_tutor is null
    end
  ),
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
  -- Dos tutores por proyecto. Ambos pueden validar las horas de sus
  -- estudiantes: la pertenencia se comprueba contra las dos columnas (ver
  -- `src/lib/tutores.ts`). Los dos son opcionales, igual que lo era `id_tutor`.
  id_tutor_academico uuid references usuarios(id_usuario),
  id_tutor_comunitario uuid references usuarios(id_usuario),
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
-- historial_acciones (auditoría de lo administrativo y de configuración)
-- ------------------------------------------------------------
-- Quién hizo qué, cuándo. Nació porque `configuracion_sistema` se sobreescribe
-- sin dejar rastro: cambiar `horas_directas`/`horas_impacto` reescribe de forma
-- retroactiva si un estudiante cumple las metas, y hasta ahora no había manera
-- de saber quién lo cambió ni desde qué valores.
--
-- El nombre y el rol del actor se copian en la fila a propósito: el historial
-- tiene que seguir siendo legible aunque la cuenta se renombre o se borre.
create table if not exists historial_acciones (
  id_evento uuid primary key default gen_random_uuid(),
  id_actor uuid references usuarios(id_usuario),
  actor_nombre text not null,
  actor_rol text not null,
  -- `<entidad>.<verbo>`, p. ej. 'configuracion.actualizar' o 'grupo.estado'.
  accion text not null,
  entidad text not null
    check (entidad in ('configuracion', 'usuario', 'grupo', 'periodo', 'plantilla', 'solicitud')),
  id_entidad text,
  -- Frase ya resuelta en español: el listado no tiene que recomponerla.
  descripcion text not null,
  -- { antes: {...}, despues: {...}, motivo: '...' }
  datos jsonb,
  creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------
-- notificaciones (bandeja de salida del correo)
-- ------------------------------------------------------------
-- No es un registro de lo enviado: es una COLA. Cada aviso se escribe aquí
-- dentro de la transacción que lo provoca y el envío ocurre después, fuera de
-- ella. Así, que el servidor de correo esté caído nunca deshace el alta de un
-- usuario ni la validación de unas horas; el aviso queda `pendiente` y se
-- reintenta.
create table if not exists notificaciones (
  id_notificacion uuid primary key default gen_random_uuid(),
  id_destinatario uuid references usuarios(id_usuario) on delete set null,
  -- Congelado al encolar: el aviso tiene que seguir siendo rastreable aunque la
  -- cuenta cambie de correo o se borre.
  destinatario_email text not null,
  destinatario_nombre text not null,
  tipo text not null
    check (tipo in ('bienvenida', 'horas_validadas', 'meta_alcanzada', 'proyecto_finalizado')),
  asunto text not null,
  cuerpo text not null,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'enviada', 'fallida')),
  intentos int not null default 0,
  error text,
  creado_en timestamptz not null default now(),
  enviado_en timestamptz
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------
create unique index if not exists idx_configuracion_unica on configuracion_sistema ((true));
create index if not exists idx_plantillas_tipo on plantillas_documento(tipo);
create index if not exists idx_usuarios_rol on usuarios(rol);
create index if not exists idx_bitacoras_estudiante on bitacoras_comunitario(id_estudiante);
create index if not exists idx_control_estudiante on control_servicios_institucionales(id_estudiante);
-- Los índices de los dos tutores se crean al final, después del ALTER que
-- añade las columnas en las bases que ya existían.
create index if not exists idx_integrantes_estudiante on integrantes_grupo(id_estudiante);
create index if not exists idx_solicitudes_estado on solicitudes_cambio(estado);
create index if not exists idx_solicitudes_usuario on solicitudes_cambio(id_usuario);
create index if not exists idx_historial_fecha on historial_acciones(creado_en desc);
create index if not exists idx_historial_entidad on historial_acciones(entidad, id_entidad);
create index if not exists idx_historial_actor on historial_acciones(id_actor);
create index if not exists idx_notificaciones_estado on notificaciones(estado, creado_en desc);
create index if not exists idx_notificaciones_destinatario on notificaciones(id_destinatario);

-- ------------------------------------------------------------
-- Ajustes sobre bases ya creadas
-- ------------------------------------------------------------
-- `create table if not exists` no toca las tablas que ya existen, asi que las
-- columnas anadidas despues de la primera version se anaden aqui. Es
-- idempotente: se puede volver a ejecutar el esquema cuantas veces se quiera.
alter table usuarios add column if not exists password_temporal boolean not null default false;
alter table usuarios add column if not exists password_cambiado_en timestamptz;

-- Tipos de tutor (Académico / Comunitario) y los dos tutores por proyecto.
-- El orden importa: primero las columnas, luego el relleno de los datos que ya
-- existían y solo al final la restricción, que de otro modo rechazaría las
-- filas viejas.
alter table usuarios add column if not exists tipo_tutor text;
alter table grupos_proyectos add column if not exists id_tutor_academico uuid references usuarios(id_usuario);
alter table grupos_proyectos add column if not exists id_tutor_comunitario uuid references usuarios(id_usuario);

do $$
begin
  -- El tutor único que había pasa a Académico: es quien tiene cuenta, firma y
  -- sello y quien figura en el acta. La coordinación reasigna después desde la
  -- pantalla de Proyectos.
  if exists (select 1 from information_schema.columns
              where table_name = 'grupos_proyectos' and column_name = 'id_tutor') then
    execute 'update grupos_proyectos set id_tutor_academico = id_tutor
              where id_tutor_academico is null and id_tutor is not null';
    execute 'alter table grupos_proyectos drop column id_tutor';
  end if;

  update usuarios set tipo_tutor = 'academico' where rol = 'tutor' and tipo_tutor is null;
  update usuarios set tipo_tutor = null where rol <> 'tutor' and tipo_tutor is not null;

  -- Se borra y se vuelve a crear en vez de usar `if not exists`: una base que
  -- ya tenga la version anterior de esta restriccion (la que dejaba pasar los
  -- tutores sin tipo) se quedaria con ella para siempre.
  alter table usuarios drop constraint if exists usuarios_tipo_tutor_check;
  alter table usuarios add constraint usuarios_tipo_tutor_check check (
    case
      when rol = 'tutor' then tipo_tutor is not null
                              and tipo_tutor in ('academico', 'comunitario')
      else tipo_tutor is null
    end
  );
end $$;

create index if not exists idx_grupos_tutor_academico on grupos_proyectos(id_tutor_academico);
create index if not exists idx_grupos_tutor_comunitario on grupos_proyectos(id_tutor_comunitario);