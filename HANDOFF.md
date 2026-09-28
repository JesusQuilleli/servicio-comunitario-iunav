# Estado del proyecto y plan de cierre — Servicio Comunitario IUNAV

**Última actualización:** 27/09/2026
**Rama:** `main` · **Base de datos:** PostgreSQL 17 local (`app_iunav`)

> Este documento es el punto de entrada para retomar el proyecto. Está pensado para leerse en 5 minutos y saber exactamente qué falta.

---

## 1. Dónde estamos

| | Estado |
|---|---|
| Commit `849b7cf` | Prototipo Vite original (solo maquetación, sin backend) |
| Commit `216b2e1` | Monorepo `web/` (Next.js 16.3.5) + `server/` (Express 4) |
| Commit posterior | Módulo **Configuraciones y Plantillas** |

**Módulos del menú (8):** los 8 están conectados a la API real. Ninguno queda pendiente de backend.

> La navegación es un `switch` sobre `useState` en `web/src/components/Shell.tsx:37`. **No hay una URL por módulo**: no se puede enlazar a "la vista de Grupos" ni usar el botón atrás del navegador para cambiar de sección. Migrar a rutas de App Router es una decisión pendiente.

**Estructura:**

```
web/     Next.js 16.3.5, React 19, Tailwind 4, axios, zustand
server/  Express 4, TypeScript ESM (NodeNext), Zod, pg, jsonwebtoken, bcryptjs
sql/     schema.sql (8 tablas) — se aplica con npm run db:schema
```

---

## 2. Lo que ya funciona y está verificado

- Auth JWT con 4 roles (`admin`, `coordinador`, `tutor`, `estudiante`) y `requireRole` por endpoint.
- Esquema PostgreSQL con 8 tablas y seed de 8 usuarios / 4 grupos / 8 integrantes / 12 bitácoras / 10 servicios.
- **Grupos y Proyectos:** 8 endpoints, con reglas de negocio: solo estudiantes activos, rechazo de duplicados, y no se puede remover a un integrante que ya tiene horas registradas.
- **Configuraciones:** metas 90/30, límite diario, período vigente, CRUD de períodos académicos y de plantillas documentales.
- **Bitácoras y Validación:** registro de horas, veredicto del tutor, y **límite diario aplicado en el servidor** dentro de una transacción (`server/src/models/bitacora.model.ts:116`).
- **Dashboards** por rol, con datos reales.
- Las 4 vistas que usaban datos falsos ya no quedan: `web/src/data/mockData.ts` no tiene importadores. **Es código muerto y se puede borrar.**

**Cómo se verificó:** `typecheck` y `build` de ambos proyectos, ESLint y `tsc` de Next limpios, y 23 pruebas manuales contra la API en vivo (roles → `403`, duplicados → `409`, validaciones → `400` con mensaje por campo, IDs inexistentes → `404`).

> Ese trabajo manual **solo existe en el historial del chat**. Por eso el paso 1 de la sección 5 es escribir pruebas automatizadas: es lo que va a proteger todo lo demás.

---

## 3. Qué falta para darlo por terminado

### 🔴 Bloque 1 — Funcional (impide entregar)

**1. Carga de archivos. Es el hueco más grave.**
`evidencia_foto_url`, `proyecto_escrito_url`, `diapositivas_url`, `firma_url` y `sello_url` son columnas de texto que solo escribe el seed. **Ningún endpoint acepta archivos ni escribe esas columnas**, y el esquema de creación de bitácora (`server/src/controllers/bitacora.controller.ts:7`) ni siquiera tiene un campo `evidenciaUrl`. Es decir: **el estudiante no puede adjuntar evidencia**, que es el corazón de la bitácora.
Requiere decidir almacenamiento (local con `multer`, S3, o Supabase Storage) y subir el límite de `express.json()`.

**2. El estudiante no puede corregir una bitácora.**
El tutor puede dejar el estado `corregir` (`server/src/routes/bitacora.routes.ts:23`), pero no existe `PATCH` ni `DELETE` de un registro propio: el estudiante solo puede crear uno nuevo. Falta permitir editar mientras esté `pendiente` o `corregir`.

**3. No hay reportes ni exportaciones.**
Nada genera el consolidado de horas por estudiante, el acta de culminación ni el certificado. Si el plan del proyecto los exige, hay que definirlos (PDF y/o Excel).

**4. No hay recuperación de contraseña.** Si un usuario olvida su clave, el sistema no tiene salida.

**5. Las metas 90/30 no se hacen cumplir.** El límite diario sí se bloquea; las metas solo se muestran como porcentaje. Hay que decidir si se avisa, se bloquea o se deja como referencia.

### 🟡 Bloque 2 — Pruebas

**6. Cero pruebas automatizadas.** No existe ni un archivo de test ni script `test` en ningún `package.json`. El plan acordado está en la sección 5.

### 🟠 Bloque 3 — Seguridad

**7. Sin `helmet` ni rate limiting**, en especial sobre `/auth/login` (`server/src/app.ts:11`).
**8. `server/.env.example` está desactualizado:** apunta a Supabase (proyecto ya muerto) y tiene texto corrupto por codificación. No existe `web/.env.example`.
**9. El JWT vive en `localStorage`** (`web/src/lib/api.ts:12`), expuesto ante XSS. Considerar cookie `httpOnly`.
**10. Contraseñas del seed en texto plano en el código** (`server/src/db/seed.ts:14`). Aceptable en desarrollo, nunca en producción.
**11. `supabase_config.txt`** ya está en `.gitignore`, pero **el archivo sigue en el disco**. Si esa clave se usó de verdad, rotarla.

### 🟡 Bloque 4 — Entrega y limpieza

**12. No hay README en la raíz.** Este `HANDOFF.md` cubre parte, pero falta una guía de instalación para alguien que clone el repositorio.
**13. Restos del prototipo Vite muerto en la raíz:** `src/`, `index.html`, `vite.config.ts`, `tailwind.config.js`, `tsconfig.app.json`, `tsconfig.node.json` y el `package.json` raíz (`vite-react-typescript-starter`). Confunden la estructura real.
**14. Sin script de arranque conjunto.** Hay que levantar `server` y `web` en dos terminales; falta un `npm run dev` en la raíz o `concurrently`.
**15. Sin paginación** en listados de usuarios, grupos ni bitácoras. Aguanta hoy; no cuando haya datos reales de una institución.
**16. Sin despliegue definido.** No hay Docker ni CI, y no está decidido dónde vivirá (Vercel + Postgres gestionado, Render, o servidor de la institución).
**17. `?schema=public` sobra** en el `DATABASE_URL` local: `pg` lo ignora.
**18. Sin rutas por módulo** (ver sección 1).

---

## 4. Matriz de permisos actual

Extraída de los 7 archivos de rutas de `server/src/routes/`. Se usa como base para las pruebas automatizadas.

| Endpoint | admin | coordinador | tutor | estudiante |
|---|:-:|:-:|:-:|:-:|
| `POST /auth/login` | público | público | público | público |
| `GET /auth/me` | ✅ | ✅ | ✅ | ✅ |
| `POST /auth/register` | ✅ | ❌ | ❌ | ❌ |
| `GET /dashboard` | ✅ | ✅ | ✅ | ✅ |
| `GET /usuarios` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /usuarios/:id/activo` | ✅ | ❌ | ❌ | ❌ |
| `GET /bitacoras/mias` | ❌ | ❌ | ❌ | ✅ |
| `GET /bitacoras/grupos` | ❌ | ❌ | ❌ | ✅ |
| `POST /bitacoras` | ❌ | ❌ | ❌ | ✅ |
| `GET /bitacoras/pendientes` | ❌ | ❌ | ✅ | ❌ |
| `PATCH /bitacoras/:id/estado` | ❌ | ❌ | ✅ | ❌ |
| `GET /grupos` | ✅ | ✅ | ✅ | ❌ |
| `GET /grupos/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST` / `PATCH /grupos` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /grupos/:id/estado` | ✅ | ✅ | ❌ | ❌ |
| `POST /grupos/:id/integrantes` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /grupos/:id/integrantes/:idEstudiante` | ✅ | ✅ | ❌ | ❌ |
| `DELETE /grupos/:id/integrantes/:idEstudiante` | ✅ | ✅ | ❌ | ❌ |
| `GET /periodos` | ✅ | ✅ | ✅ | ✅ |
| `POST` / `PATCH /periodos` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /periodos/:id/activo` | ✅ | ✅ | ❌ | ❌ |
| `GET /configuracion` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /configuracion` | ✅ | ❌ | ❌ | ❌ |
| `GET /configuracion/plantillas` | ✅ | ✅ | ❌ | ❌ |
| `POST` / `PATCH /configuracion/plantillas` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /configuracion/plantillas/:id/activo` | ✅ | ✅ | ❌ | ❌ |

`GET /auth/me`, `GET /dashboard` y `GET /periodos` solo exigen autenticación: los tres hacen falta para los tres perfiles que no gestionan.

---

## 5. Plan para hacer pruebas reales

### Decisiones ya tomadas (no volver a abrir)

- Las pruebas corren en una **base aparte**, `app_iunav_test`, nunca en `app_iunav`.
  Se descartó usar la base de desarrollo: `bitacora.model.ts` toma su propia conexión y hace `BEGIN`, lo que hace incompatible envolver cada test en una transacción de rollback.
- La **primera tanda cubre auth y permisos**, antes de agregar funcionalidad nueva.

### 5.1 Infraestructura

Los tests van en `server/tests/`, **fuera de `src/`**. Es deliberado: `server/tsconfig.json` tiene `rootDir: "src"` e `include: ["src"]`, así que `npm run build` sigue compilando solo producción sin tocar nada.

| Archivo | Responsabilidad |
|---|---|
| `tests/setup.ts` | Fija `DATABASE_URL` y `JWT_SECRET` **antes** de importar el pool. `src/db/pool.ts:4` lee `env` al importarse, así que el orden importa. |
| `tests/helpers/db.ts` | Crea `app_iunav_test` desde cero, aplica `sql/schema.sql` y corre un seed mínimo de los 4 roles. |
| `tests/helpers/app.ts` | `request(createApp())` — `createApp()` ya está exportada separada del `listen` (`src/app.ts:8` vs `src/index.ts:12`), así que no hace falta abrir un puerto. Incluye `loginComo(rol)`. |
| `vitest.config.ts` | Aísla `tests/setup.ts` y cierra el pool al terminar. |

Scripts a añadir en `server/package.json`: `test`, `test:watch`, `db:test`.
Devdeps: `vitest`, `supertest`, `@types/supertest`.

> ⚠️ **Riesgo conocido:** el código importa con extensión `.js` (`'../db/pool.js'`) por `module: NodeNext`. Vite puede no resolver `.js` → `.ts` de forma nativa. Verificar con un test de humo antes de escribir toda la batería. Plan B: alias en `vitest.config.ts`. Plan C: `node:test` + `tsx`, que ya es dependencia del proyecto y no requiere framework nuevo.

### 5.2 Tests de auth

- Login correcto → `200` con token y usuario.
- Contraseña incorrecta → `401`.
- Correo inexistente → `401` con el mismo mensaje (sin revelar cuál falló).
- Email malformado → `400` señalando el campo.
- Cuenta desactivada → `403`.
- `/auth/me`: con token válido, sin token (`401`), con token falso (`401`).
- `/auth/register`: exige admin, rechaza duplicados (`409`) y contraseña corta (`400`).

### 5.3 Matriz de permisos

Declarar la matriz de la sección 4 como dato y generar los casos con `it.each`, en vez de escribirlos a mano. Resultado: 4 roles × 26 endpoints, más la comprobación de que **ningún endpoint acepta un token ausente o inválido**.

### 5.4 Pruebas manuales con los 4 roles

Recorrer los 8 módulos con admin, coordinador, tutor y estudiante. Casos que conviene forzar a mano:

- Estudiante sin grupo intentando registrar bitácora comunitaria → debe fallar con mensaje claro.
- Tutor validando un registro que no es de su grupo → debe ser rechazado.
- El estudiante **no** debe ver el menú de Configuraciones ni el de Validación.
- Recargar a mitad de un formulario largo: no debe perderse nada.
- Navegar con teclado y en móvil.

### 5.5 Con datos realistas

El seed tiene 8 usuarios. Probar con **200+ estudiantes, 40+ grupos y miles de registros** para medir tiempos de respuesta. Puntos críticos a medir: el listado de pendientes del tutor y el consolidado de horas.

### 5.6 Seguridad (mínima)

Intento masivo de login, manipulación del `idGrupo` en la URL para ver datos ajenos, y acceso directo a un endpoint sin token.

---

## 6. Cómo levantar el proyecto

```powershell
# 1) API (puerto 4000)
cd server
npm install
npm run db:schema     # aplica sql/schema.sql
npm run db:seed       # datos de demostración
npm run dev

# 2) Web (puerto 3000) — en otra terminal
cd web
npm install
npm run dev
```

`web/.env.local` ya apunta a `http://localhost:4000`.

Comprobación rápida de la API: <http://localhost:4000/api/health>

**Cuentas de prueba** (solo desarrollo):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `cmendoza@iunav.edu.ve` | `admin123` |
| Coordinador | `mlopez@iunav.edu.ve` | `coord123` |
| Tutor | `jperez@iunav.edu.ve` | `tutor123` |
| Estudiante | `gmartinez@iunav.edu.ve` | `est123` |

---

## 7. Orden sugerido de trabajo

1. **Pruebas automatizadas** (sección 5) — antes de agregar funcionalidad, no después.
2. Carga de archivos: evidencias → proyecto escrito y diapositivas → firma y sello.
3. Editar/corregir bitácora propia.
4. Seguridad: `helmet`, rate limit, JWT en cookie, `.env.example`.
5. Reportes y certificados.
6. Rutas por módulo en App Router (dejar de usar el `switch`).
7. README, limpieza del Vite muerto, script de arranque conjunto.
8. Datos de carga y despliegue.

---

## 8. Notas para quien retome esto

- **No hay memoria entre sesiones.** Este archivo y `git log` son el contexto.
- `web/AGENTS.md` exige leer la guía relevante en `web/node_modules/next/dist/docs/` antes de escribir código Next.js. Ese bloque lo regenera `next dev`; no lo borres del diff, commitéalo con el trabajo.
- El proyecto Supabase `xsprlbjqrelqpbfyzhff` ya no resuelve sus hostnames. **La base local es la fuente de verdad.**
- `server/.env` tiene un `?schema=public` al final de la URL que `pg` ignora; se puede limpiar sin riesgo.
- Si se toca el esquema, siempre `npm run db:schema` (usa `create table if not exists`, es idempotente) y luego `npm run db:seed`.
