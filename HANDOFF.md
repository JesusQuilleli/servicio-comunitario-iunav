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
| Commit `086b53c` | Módulo **Configuraciones y Plantillas** |
| Commit `452ef12` | Este `HANDOFF.md` |
| Commit `fff9d5b` | Vitest + Supertest: 191 pruebas de auth y permisos |

**Módulos del menú (8):** los 8 están conectados a la API real. Ninguno queda pendiente de backend.

> La navegación es un `switch` sobre `useState` en `web/src/components/Shell.tsx:37`. **No hay una URL por módulo**: no se puede enlazar a "la vista de Grupos" ni usar el botón atrás del navegador para cambiar de sección. Migrar a rutas de App Router es una decisión pendiente.

**Estructura:**

```
web/     Next.js 16.3.5, React 19, Tailwind 4, axios, zustand
server/  Express 4, TypeScript ESM (NodeNext), Zod, pg, jsonwebtoken, bcryptjs
server/sql/schema.sql   8 tablas — se aplica con npm run db:schema desde server/
server/tests/           pruebas Vitest + Supertest (fuera de src/ a propósito)
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

**Cómo se verificó:** `typecheck` y `build` de ambos proyectos, ESLint y `tsc` de Next limpios, **191 pruebas automatizadas en verde** (`cd server; npm test`) y 23 pruebas manuales contra la API en vivo (roles → `403`, duplicados → `409`, validaciones → `400` con mensaje por campo, IDs inexistentes → `404`).

> Ese trabajo manual ya no depende solo del historial del chat: la sección 5 está ejecutada y la matriz de permisos de la sección 4 está **codificada como dato** en `server/tests/permisos.test.ts`, no reescrita a mano.

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

**6. ~~Cero pruebas automatizadas~~ → RESUELTO.** Vitest + Supertest sobre `app_iunav_test`, 191 pruebas: humo, auth (16) y matriz de 28 endpoints × 4 roles + ausencia de token. Ver sección 5.

**6b. Lo que las pruebas aún no cubren** (siguiente tanda):

- Reglas de negocio de bitácoras y grupos más allá del código `403`: límite diario, metas 90/30, veredicto del tutor sobre un registro de otro grupo.
- Suites de `grupos`, `bitacoras`, `configuracion` y `periodos` (hoy solo se cubre la matriz de permisos, no el comportamiento).
- Consistencia entre OpenAPI y la matriz.
- Carga con 200+ estudiantes (ver 5.5).

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

## 5. Pruebas automatizadas — ✅ IMPLEMENTADAS

```powershell
cd server
npm test              # 191 pruebas, ~19 s
npm run test:watch    # durante el desarrollo
npm run typecheck:tests
npm run db:test       # recrea app_iunav_test desde cero (aborta si el nombre no termina en _test)
```

### Decisiones ya tomadas (no volver a abrir)

- Las pruebas corren en una **base aparte**, `app_iunav_test`, nunca en `app_iunav`.
  Se descartó usar la base de desarrollo: `bitacora.model.ts` toma su propia conexión y hace `BEGIN`, lo que hace incompatible envolver cada test en una transacción de rollback.
- La **primera tanda cubre auth y permisos**, antes de agregar funcionalidad nueva.

### 5.1 Infraestructura — lista

| Archivo | Responsabilidad |
|---|---|
| `tests/setup.ts` | Fija `DATABASE_URL` apuntando a `app_iunav_test` y un `JWT_SECRET` **antes** de importar el pool. `src/db/pool.ts:4` lee `env` al importarse, así que el orden importa. |
| `tests/helpers/db.ts` | Crea `app_iunav_test` si falta, aplica `sql/schema.sql` y corre un seed de los 4 roles + 3 estudiantes de apoyo. |
| `tests/helpers/app.ts` | `request(createApp())` — `createApp()` ya está exportada separada del `listen` (`src/app.ts:8` vs `src/index.ts:12`), así que no hace falta abrir un puerto. Incluye `tokenDe(rol)`. |
| `scripts/reset-test-db.ts` | `npm run db:test`. **Se niega a tocar cualquier base que no termine en `_test`.** |
| `vitest.config.ts` | Aísla `tests/setup.ts`; `maxWorkers: 1` y `fileParallelism: false` porque la base es única. |
| `tsconfig.test.json` | `typecheck:tests`: typea `src` + `tests` juntos. `npm run typecheck` sigue viendo solo `src`. |

> **El riesgo de resolución `.js` → `.ts` quedó descartado.** Vitest lo resuelve solo; no hizo falta alias ni `node:test`. Un test de humo (`tests/humo.test.ts`) lo verifica en cada corrida, así que si una actualización lo rompe, se nota de inmediato.

### 5.2 Tests de auth — 16 casos, todos en verde

Login correcto (y sin filtrar el hash), contraseña incorrecta, correo inexistente con el **mismo mensaje**, email malformado, cuenta desactivada, insensibilidad a mayúsculas, `/auth/me` con token válido / ausente / con firma manipulada / con rol alterado, y `/auth/register` (alta, duplicado, contraseña corta, rol inválido, sin token).

### 5.3 Matriz de permisos — 112 + 56 casos

La matriz de la sección 4 está declarada como dato en `server/tests/permisos.test.ts` (constante `CASOS`) y los casos se generan con bucles, no escritos a mano: 28 endpoints × 4 roles, más los 56 casos de token ausente e inválido. Cambiar un permiso es editar una fila, no 28 pruebas.

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

## 5-bis. Lo que las pruebas descubcieron

Tres cosas que costaron una corrección y conviene no volver a pisar:

1. **El login normaliza el correo con `toLowerCase()`.** Cualquier usuario guardado con mayúsculas (`tutorA@…`) queda permanentemente inalcanzable. El seed de pruebas usa solo minúsculas por eso. El seed real también, así que no hay bug activo, pero `findUsuarioPorEmail` depende de esa convención: si algún día se insertan correos a mano, se romperá en silencio.
2. **`DELETE` de un integrante y `PATCH /grupos/:id` devuelven `409`** si el estudiante ya tiene horas registradas. Es la regla de negocio correcta, no un fallo. La matriz lo respeta, y el seed incluye un integrante sin horas (`sinhoras@test.local`) solo para poder probar el `DELETE`.
3. **`PATCH /grupos/:id` reemplaza la lista de integrantes completa.** Enviar `integrantesIds: []` no vacía el grupo: intenta quitar a todos y salta el `409` de quien tenga horas.

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

1. ~~Pruebas automatizadas~~ — hecho. Siguiente tanda: 6b.
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
- **Las pruebas nunca tocan `app_iunav`.** `tests/setup.ts` reemplaza la base antes de que se importe el pool, y `npm run db:test` se niega a dropear cualquier nombre que no termine en `_test`. Verificado tras 191 pruebas: `app_iunav` seguía en 8 usuarios / 4 grupos / 12 bitácoras / 5 plantillas.
- Para cambiar la matriz de permisos, edita la constante `CASOS` en `server/tests/permisos.test.ts` y la tabla de la sección 4. Los dos deben seguir diciendo lo mismo.
