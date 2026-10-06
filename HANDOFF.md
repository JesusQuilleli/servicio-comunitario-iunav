# Estado del proyecto y plan de cierre — Servicio Comunitario IUNAV

**Última actualización:** 05/10/2026
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
| Commit `fff9d5b` / `9a1ed13` | Vitest + Supertest: matriz de permisos codificada como dato |
| **Sin commitear** | Fases 1 a 7 completas: archivos, corrección de bitácoras, metas, contraseñas temporales, reportes, rutas por módulo y limpieza de Supabase. **Son 42 archivos modificados, 39 borrados y 40 nuevos sin rastrear: nada de eso está en un commit todavía.** |

**Módulos del menú (9), todos contra la API real:** Registro de Usuarios, Gestión de Usuarios, Grupos y Proyectos, Bitácora Comunitario, Servicio Social y Ambiental, Validación, Configuraciones, **Reportes** y **Mi contraseña** (este último es voluntario, no obligatorio).

> **Cada módulo tiene su URL.** La navegación ya no es un `switch` sobre `useState`: son rutas reales de App Router bajo `src/app/(panel)/`, el menú usa `Link` y el módulo activo se deduce de `usePathname()`. Se puede enlazar a "la vista de Reportes", usar el botón atrás y recargar sin perder el estado.

| Ruta | Módulo | Quién entra |
|---|---|---|
| `/dashboard` | Dashboard por rol | los 4 |
| `/registro-usuarios` | Alta de usuarios | admin |
| `/usuarios` | Gestión de usuarios | admin, coordinador |
| `/proyectos` | Grupos y proyectos | admin, coordinador, tutor |
| `/bitacora` | Bitácora comunitaria | los 4 |
| `/servicio` | Servicio social y ambiental | los 4 |
| `/validacion` | Validación de horas | admin, coordinador, tutor |
| `/configuracion` | Configuración y plantillas | admin, coordinador |
| `/reportes` | Reportes y certificados | admin, coordinador, tutor |
| `/password` | Mi contraseña | los 4 |

**Estructura** (la raíz solo tiene esto; el prototipo Vite se borró):

```
web/     Next.js 16.3.5, React 19, Tailwind 4, axios, zustand
server/  Express 4, TypeScript ESM (NodeNext), Zod, pg, jsonwebtoken, bcryptjs
server/sql/schema.sql   8 tablas — se aplica con npm run db:schema desde server/
server/tests/           pruebas Vitest + Supertest (fuera de src/ a propósito)
HANDOFF.md              este archivo
```

---

## 2. Lo que ya funciona y está verificado

- Auth JWT con 4 roles (`admin`, `coordinador`, `tutor`, `estudiante`) y `requireRole` por endpoint, más `helmet`, `cors` restringido al frontend y rate limit en `/auth/login`.
- Esquema PostgreSQL con 8 tablas y seed de 8 usuarios / 4 grupos / 8 integrantes / 12 bitácoras / 10 servicios / 5 plantillas.
- **Contraseñas temporales:** el admin genera una clave temporal, el usuario está obligado a cambiarla antes de tocar cualquier otra cosa, y el servidor responde `403` a todo lo demás con `requiereCambioDePassword` (excepto `/auth/me` y el propio cambio). El claim `tmp` va en el JWT.
- **Grupos y Proyectos:** con reglas de negocio: solo estudiantes activos, rechazo de duplicados, y no se puede remover a un integrante que ya tiene horas registradas.
- **Archivos:** evidencias, proyecto escrito, diapositivas, firma y sello se suben de verdad (`multipart/form-data`), se validan por tipo y tamaño, y **se sirven por endpoint autenticado**, no por URL pública. Hay prueba de subida parcial (`subida-parcial.test.ts`).
- **Bitácoras:** el estudiante puede **editar y borrar** su registro mientras esté `pendiente` o `corregir`. El límite diario y **las metas 90/30 se bloquean en el servidor**, dentro de una transacción (`server/src/models/bitacora.model.ts:153`), ya no solo se muestran.
- **Reportes:** consolidado de horas en **PDF y Excel**, acta de culminación y certificado por estudiante, generados en memoria y servidos con `Content-Disposition`. Solo cuentan las horas **aprobadas**; las pendientes van aparte y el certificado sale marcado "no acreditado" si el estudiante no llega a las metas.
- **Dashboards** por rol, con datos reales.

**Cómo se verificó:** `typecheck` y `build` de ambos proyectos, ESLint y `tsc` de Next limpios, **368 pruebas automatizadas en verde** (`cd server; npm test`) y las rutas del panel probadas contra el server de producción (307 correctos para sesión ausente y rol insuficiente).

> Ese trabajo ya no depende del historial del chat: la matriz de permisos de la sección 4 está **codificada como dato** en `server/tests/permisos.test.ts`, no reescrita a mano, y un test verifica que la matriz siga cubriendo los 41 endpoints.

---

## 3. Qué falta para darlo por terminado

### 🔴 Bloque 1 — Funcional

~~**1. Carga de archivos.**~~ → **RESUELTO.** Evidencias, proyecto escrito, diapositivas, firma y sello suben por `multipart/form-data` y se descargan por endpoint autenticado. Cubierto por `archivos.test.ts`, `documentos.test.ts` y `subida-parcial.test.ts`.

~~**2. El estudiante no puede corregir una bitácora.**~~ → **RESUELTO.** `PATCH /bitacoras/:id` y `DELETE /bitacoras/:id`, solo sobre registros propios y solo mientras estén `pendiente` o `corregir`.

~~**3. No hay reportes ni exportaciones.**~~ → **RESUELTO.** Cuatro endpoints bajo `/api/reportes` (consolidado PDF/Excel, acta, certificado) con alcance por tutor. Cubierto por `reportes.test.ts` (25 pruebas).

~~**4. No hay recuperación de contraseña.**~~ → **RESUELTO** en el sentido que importa para una institución: el admin genera una clave temporal y el usuario queda forzado a cambiarla. **Lo que sigue sin existir es el autoservicio**: que el usuario pueda recuperar la clave por correo sin intervención del admin.

~~**5. Las metas 90/30 no se hacen cumplir.**~~ → **RESUELTO.** `comprobarMeta` bloquea el registro en el servidor cuando sumar las horas nuevas pasa la meta.

### 🟡 Bloque 2 — Pruebas

**6. ~~Cero pruebas automatizadas~~ → RESUELTO.** 368 pruebas en 8 archivos: humo, auth, matriz de permisos, archivos, documentos, contraseñas y reportes. Ver sección 5.

**6b. Lo que las pruebas aún no cubren** (siguiente tanda):

- Casos de negocio más allá del código HTTP: qué pasa si un tutor valida un registro cuyo grupo se le acaba de reasignar.
- Consistencia entre OpenAPI y la matriz (**no hay OpenAPI todavía**: el contrato vive solo en el código y en las pruebas).
- Carga con 200+ estudiantes (ver 5.5).

### 🟠 Bloque 3 — Seguridad

~~**7. Sin `helmet` ni rate limiting.**~~ → **RESUELTO.** `helmet()`, `cors` con origen único y `rateLimit` sobre `/auth/login` (10 intentos por IP cada 15 min, configurable por `RATE_LIMIT_LOGIN`).

~~**8. `server/.env.example` desactualizado.**~~ → **RESUELTO.** Ya no menciona Supabase y documenta los límites del login, `DB_SSL`, `API_HOST`, `TEST_DATABASE_URL` y los topes de subida. **También se creó `web/.env.example`**, que era el hueco real: `web/.env.local` (sí en `.gitignore`) es lo que hacía que en otra máquina la web no encontrara la API sin avisar.

**9. El JWT vive en `localStorage`** (`web/src/stores/authStore.ts:13`), expuesto ante XSS. Hay una cookie espejo `iunav_token` que el `proxy` usa para cortar rutas antes de renderizar, **pero no es `httpOnly`**: sigue siendo un token legible por JavaScript. El cambio real a cookie `httpOnly` (con `POST` de refresh) sigue pendiente.

**10. Contraseñas del seed en texto plano en el código** (`server/src/db/seed.ts:14`). Mitigado: `npm run db:seed` ahora **se niega a correr** sin `--confirm-seed` (`confirmarSeed()`), para que un `db:seed` de buena fe en un servidor real no deje admins con contraseña de diccionario. Sigue siendo que la contraseña del admin hay que cambiarla en el primer ingreso.

~~**11. `supabase_config.txt` en el disco.**~~ → **RESUELTO:** el archivo se borró. **Pendiente fuera del código:** la contraseña de Supabase sigue viva en el panel de Supabase; si ese proyecto existió, hay que rotarla.

### 🟡 Bloque 4 — Entrega y limpieza

~~**12. No hay README en la raíz.**~~ → **MITIGADO.** No hay un README de proyecto, pero `deploy/README.md` tiene el guion completo de instalación en VPS (con checklist de una pantalla), y este `HANDOFF.md` cubre el resto. Para una instalación en local están la sección 6 y las plantillas `server/.env.example` y `web/.env.example`.

**12b. Documentos para el usuario final.** → **HECHO.** `docs/Guia-de-Usuario-IUNAV.pdf` (14 páginas) con qué resuelve el sistema, los cuatro roles paso a paso, glosario, tabla de permisos por rol y 10 problemas frecuentes. El fuente editable es `docs/Guia-de-Usuario.html`, regenerable con Edge o Chrome en modo headless: `msedge --headless=new --no-pdf-header-footer --print-to-pdf=salida.pdf file:///.../Guia-de-Usuario.html`.

~~**13. Restos del prototipo Vite muerto en la raíz.**~~ → **RESUELTO.** Se borraron `src/` (28 archivos), `index.html`, `vite.config.ts`, los `package.json`/`package-lock.json` de la raíz y los `tsconfig`/`tailwind`/`postcss`/`eslint` del prototipo: **37 archivos de la raíz, recuperables con git**. De paso desapareció el warning de lockfiles duplicados de Turbopack.

**14. Sin script de arranque conjunto.** Hay que levantar `server` y `web` en dos terminales; ahora que la raíz no tiene `package.json`, `npm run dev` en la raíz **no existe**. En la VPS esto ya no es problema: `deploy/arrancar.sh` compila, aplica el esquema y levanta los dos servicios con systemd.

**15. Sin paginación** en listados de usuarios, grupos ni bitácoras. Aguanta hoy; no cuando haya datos reales de una institución.

~~**16. Sin despliegue definido.**~~ → **RESUELTO para VPS propia.** Decidido: una VPS Ubuntu 22.04 con subdominio propio, Caddy al frente y systemd detrás. Todo en `deploy/`, con el guion paso a paso en **`deploy/README.md`** y una sección nueva en la 6-bis. Sigue sin haber Docker ni CI, y sigue sin decidirse el destino del despliegue real del IUNAV.

**17. `?schema=public` sobra** en el `DATABASE_URL` local: `pg` lo ignora.

~~**18. Sin rutas por módulo.**~~ → **RESUELTO.** Ver sección 1.

**19. La validación de horas es del tutor, pero la matriz dice que el coordinador también puede.** Inconsistencia real, encontrada al redactar la guía de usuario:

- `GET /api/bitacoras/pendientes` (la lista que hay que ver para poder validar) es **solo tutor**.
- `PATCH /api/bitacoras/:id/estado` sí está autorizada para **admin, coordinador y tutor** (`GESTION` en `CASOS`, y hay una prueba que lo exige).
- Pero `web/src/views/ValidacionView.tsx:37` corta la pantalla a `usuario.rol !== "tutor"` y muestra "Acceso exclusivo para tutores".

Efecto en la práctica: **solo el tutor valida**. La rama `admin`/`coordinador` de la prueba de `/estado` es inalcanzable desde la interfaz, y el coordinador y el administrador ven un enlace "Validación" en el menú que lleva a una pantalla restringida. Hay que decidir y ajustar las tres piezas a la misma respuesta. **No se cambió nada de esto**: tocar la matriz de permisos probada es una decisión de producto, no un arreglo silencioso.

---

## 4. Matriz de permisos actual

**41 endpoints**, extraída de `server/tests/permisos.test.ts` (constante `CASOS`), que es la misma fuente que ejecuta las pruebas.

| Endpoint | admin | coordinador | tutor | estudiante |
|---|:-:|:-:|:-:|:-:|
| `GET /api/auth/me` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/auth/register` | ✅ | ❌ | ❌ | ❌ |
| `PATCH /api/auth/password` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/usuarios/:id/password` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/dashboard` | ✅ | ✅ | ✅ | ✅ |
| `GET /api/reportes/consolidado-horas.pdf` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/reportes/consolidado-horas.xlsx` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/reportes/acta/:idGrupo.pdf` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/reportes/certificado/:idUsuario.pdf` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/usuarios` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/usuarios/:id/activo` | ✅ | ❌ | ❌ | ❌ |
| `POST /api/usuarios/:id/firma (ajena)` | ✅ | ❌ | ❌ | ❌ |
| `POST /api/usuarios/:id/sello` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/bitacoras/mias` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/bitacoras/grupos` | ❌ | ❌ | ❌ | ✅ |
| `POST /api/bitacoras` | ❌ | ❌ | ❌ | ✅ |
| `GET /api/bitacoras/pendientes` | ❌ | ❌ | ✅ | ❌ |
| `GET /api/bitacoras/metas` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /api/bitacoras/:id` | ❌ | ❌ | ❌ | ✅ |
| `DELETE /api/bitacoras/:id` | ❌ | ❌ | ❌ | ✅ |
| `PATCH /api/bitacoras/:id/estado` | ❌ | ❌ | ✅ | ❌ |
| `GET /api/grupos` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/grupos/:id` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/grupos` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/grupos/:id` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/grupos/:id/estado` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/grupos/:id/integrantes` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/grupos/:id/integrantes/:idEstudiante` | ✅ | ✅ | ❌ | ❌ |
| `DELETE /api/grupos/:id/integrantes/:idEstudiante` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/grupos/:id/documentos` | ✅ | ✅ | ✅ | ❌ |
| `GET /api/periodos` | ✅ | ✅ | ✅ | ✅ |
| `POST /api/periodos` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/periodos/:id` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/periodos/:id/activo` | ✅ | ✅ | ❌ | ❌ |
| `GET /api/configuracion` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/configuracion` | ✅ | ❌ | ❌ | ❌ |
| `GET /api/configuracion/plantillas` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/configuracion/plantillas` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/configuracion/plantillas/:id` | ✅ | ✅ | ❌ | ❌ |
| `PATCH /api/configuracion/plantillas/:id/activo` | ✅ | ✅ | ❌ | ❌ |
| `POST /api/configuracion/plantillas/:id/documento` | ✅ | ✅ | ❌ | ❌ |

Notas sobre las filas que no son obvias:

- `POST /api/auth/login` es público y por eso **no está en la matriz**: se prueba aparte en `auth.test.ts`.
- `GET /api/auth/me`, `GET /api/dashboard` y `GET /api/periodos` solo exigen autenticación: los tres hacen falta para el perfil del estudiante, que no gestiona nada.
- **Los reportes son `gestion` + tutor.** El estudiante no baja ninguno. Y `requireRole` no basta: el tutor además tiene que ser dueño del grupo o tener al estudiante, comprobado en `reporte.model.ts` (`esIntegranteDeTutor`), no solo en la ruta.
- `POST /api/usuarios/:id/firma (ajena)` aparece con ❌ para los no admin **aunque la ruta permita el caso legítimo**: firmar la propia firma lo hace cualquiera, y el `403` llega desde la lógica de negocio del controlador, no desde `requireRole`. Por eso la matriz prueba explícitamente el caso "ajena".
- Los cuatro endpoints de archivos (`POST /grupos/:id/documentos`, `POST /configuracion/plantillas/:id/documento`, firma y sello) suben `multipart/form-data`, y la prueba adjunta un PNG y un PDF reales.

---

## 5. Pruebas automatizadas — ✅ IMPLEMENTADAS

```powershell
cd server
npm test              # 368 pruebas en 8 archivos, ~40 s
npm run test:watch    # durante el desarrollo
npm run typecheck:tests
npm run db:test       # recrea app_iunav_test desde cero (aborta si el nombre no termina en _test)
```

| Archivo | Pruebas | Qué cubre |
|---|---:|---|
| `tests/humo.test.ts` | 3 | La app arranca, `/api/health` responde, la resolución `.js` → `.ts` funciona |
| `tests/auth.test.ts` | 16 | Login, `/auth/me`, `/auth/register` |
| `tests/permisos.test.ts` | 250 | Matriz de 41 endpoints × 4 roles, token ausente e inválido, y cobertura de la matriz |
| `tests/archivos.test.ts` | 31 | Subida y descarga autenticada, tipos y tamaños inválidos |
| `tests/documentos.test.ts` | 22 | Proyecto escrito, diapositivas, firma y sello |
| `tests/passwords.test.ts` | 19 | Cambio propio, reset del admin, claim `tmp`, bloqueo de rutas |
| `tests/reportes.test.ts` | 25 | Las 4 descargas, cifras, nombres de archivo y alcance del tutor |
| `tests/subida-parcial.test.ts` | 2 | Archivos que llegan a medias |

### Decisiones ya tomadas (no volver a abrir)

- Las pruebas corren en una **base aparte**, `app_iunav_test`, nunca en `app_iunav`.
  Se descartó usar la base de desarrollo: `bitacora.model.ts` toma su propia conexión y hace `BEGIN`, lo que hace incompatible envolver cada test en una transacción de rollback.
- **La matriz de permisos se declara como dato, no como 250 pruebas escritas a mano.** Cambiar un permiso es editar una fila de `CASOS`.

### 5.1 Infraestructura — lista

| Archivo | Responsabilidad |
|---|---|
| `tests/setup.ts` | Fija `DATABASE_URL` apuntando a `app_iunav_test` y un `JWT_SECRET` **antes** de importar el pool. `src/db/pool.ts` lee `env` al importarse, así que el orden importa. |
| `tests/helpers/db.ts` | Crea `app_iunav_test` si falta, aplica `sql/schema.sql` y corre un seed de los 4 roles + 3 estudiantes de apoyo. |
| `tests/helpers/app.ts` | `request(createApp())` — `createApp()` ya está exportada separada del `listen`, así que no hace falta abrir un puerto. Incluye `tokenDe(rol)`. |
| `scripts/reset-test-db.ts` | `npm run db:test`. **Se niega a tocar cualquier base que no termine en `_test`.** |
| `vitest.config.ts` | Aísla `tests/setup.ts`; `maxWorkers: 1` y `fileParallelism: false` porque la base es única. |
| `tsconfig.test.json` | `typecheck:tests`: typea `src` + `tests` juntos. `npm run typecheck` sigue viendo solo `src`. |

> **El riesgo de resolución `.js` → `.ts` quedó descartado.** Vitest lo resuelve solo; no hizo falta alias ni `node:test`. Un test de humo lo verifica en cada corrida, así que si una actualización lo rompe, se nota de inmediato.

### 5.2 Tests de auth — 16 casos

Login correcto (y sin filtrar el hash), contraseña incorrecta, correo inexistente con el **mismo mensaje**, email malformado, cuenta desactivada, insensibilidad a mayúsculas, `/auth/me` con token válido / ausente / con firma manipulada / con rol alterado, y `/auth/register` (alta, duplicado, contraseña corta, rol inválido, sin token).

### 5.3 Matriz de permisos — 250 casos

164 de la matriz (41 endpoints × 4 roles), 82 de token ausente e inválido (41 × 2), 2 de intento de falsear el rol dentro del token y 2 que vigilan la propia matriz: uno que **falla si aparece un endpoint nuevo sin declarar su permiso**, y otro que falla si un caso no autoriza a ningún rol.

### 5.4 Pruebas manuales con los 4 roles

Recorrer los 9 módulos con admin, coordinador, tutor y estudiante. Casos que conviene forzar a mano:

- Estudiante sin grupo intentando registrar bitácora comunitaria → debe fallar con mensaje claro.
- Tutor validando un registro que no es de su grupo → debe ser rechazado.
- Tutor pidiendo el acta de un grupo que no es suyo → debe ser rechazado aunque el rol sea correcto.
- El estudiante **no** debe ver el menú de Configuraciones ni el de Validación.
- Escribir a mano `/usuarios` en la barra de direcciones con sesión de estudiante → debe rebotar al dashboard, no mostrar la pantalla.
- Recargar a mitad de un formulario largo: no debe perderse nada.
- Navegar con teclado y en móvil.

### 5.5 Con datos realistas

El seed tiene 8 usuarios. Probar con **200+ estudiantes, 40+ grupos y miles de registros** para medir tiempos de respuesta. Puntos críticos a medir: el listado de pendientes del tutor y el consolidado de horas (que ahora se genera entero en memoria: con 200+ estudiantes el PDF se construye en cada request).

### 5.6 Seguridad (mínima)

Intento masivo de login (contra el rate limit), manipulación del `idGrupo` en la URL para ver datos ajenos, acceso directo a un endpoint sin token, y subir un archivo con extensión cambiada.

---

## 5-bis. Lo que las pruebas y el trabajo de estos días descubrieron

Cuatro cosas que costaron una corrección y conviene no volver a pisar:

1. **El login normaliza el correo con `toLowerCase()`.** Cualquier usuario guardado con mayúsculas (`tutorA@…`) queda permanentemente inalcanzable. El seed usa solo minúsculas por eso. `findUsuarioPorEmail` depende de esa convención: si algún día se insertan correos a mano, se romperá en silencio.
2. **`DELETE` de un integrante y `PATCH /grupos/:id` devuelven `409`** si el estudiante ya tiene horas registradas. Es la regla de negocio correcta, no un fallo. El seed incluye un integrante sin horas (`sinhoras@test.local`) solo para poder probar el `DELETE`.
3. **`PATCH /grupos/:id` reemplaza la lista de integrantes completa.** Enviar `integrantesIds: []` no vacía el grupo: intenta quitar a todos y salta el `409` de quien tenga horas.
4. **Un `redirect()` desde una página llega tarde.** Con el chequeo de rol en `app/(panel)/*/page.tsx` el navegador recibía **200** y un salto del cliente: el shell del layout ya se había enviado antes de que la página pidiera el redirect. Por eso el corte está en `src/proxy.ts`, que corre antes de renderizar y sí devuelve 307. Verificado contra el server de producción: estudiante en `/usuarios` → 307 a `/dashboard`; sin sesión en cualquier ruta del panel → 307 a `/login`.

---

## 6. Cómo levantar el proyecto

La raíz **ya no tiene `package.json`**, así que son dos terminales:

```powershell
# 1) API (puerto 4000)
cd server
npm install
npm run db:schema          # aplica sql/schema.sql
npm run db:seed -- --confirm-seed   # datos de demostración
npm run dev

# 2) Web (puerto 3000) — en otra terminal
cd web
npm install
npm run dev
```

`web/.env.local` ya apunta a `http://localhost:4000`. Si no existe, copiar la plantilla: `cp web/.env.example web/.env.local`.

Comprobación rápida de la API: <http://localhost:4000/api/health> — responde `{"ok":true,"baseDeDatos":true}`. El `baseDeDatos` es real: hace `select 1` con 2 s de tope y devuelve **503** si PostgreSQL no contesta.

**Cuentas de prueba** (solo desarrollo):

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `cmendoza@iunav.edu.ve` | `admin123` |
| Coordinador | `mlopez@iunav.edu.ve` | `coord123` |
| Tutor | `jperez@iunav.edu.ve` | `tutor123` |
| Estudiante | `gmartinez@iunav.edu.ve` | `est123` |

---

## 6-bis. Despliegue en VPS

Decidido: una **VPS Ubuntu 22.04**, 2 GB de RAM o más, subdominio propio, Caddy con TLS automático y systemd. El guion completo paso a paso está en **`deploy/README.md`**. Resumen de cómo queda:

```
Internet ──> Caddy (:443)  ┬─ /api/*  ──> 127.0.0.1:4000   Express
                            └─ /*       ──> 127.0.0.1:3000   Next.js
PostgreSQL 127.0.0.1:5432 (nunca expuesto)
```

| Archivo | Qué hace |
|---|---|
| `deploy/README.md` | El guion de 8 pasos: DNS, clonación, instalación, arranque, respaldos y tabla de fallos |
| `deploy/instalar.sh` | Node 22, PostgreSQL en localhost, usuario de sistema, las 2 bases, Caddy, systemd y `ufw` (solo 22/80/443). Genera `JWT_SECRET` y la contraseña de la base, e imprime ambos **una sola vez** |
| `deploy/arrancar.sh` | Compila API y web, aplica el esquema, siembra datos (`--con-datos`), levanta los servicios y **espera a que `/api/health` responda** |
| `deploy/actualizar.sh` | `git pull --ff-only` + `npm ci` + build + `db:schema` + reinicio + comprobación. Nunca resuelve conflictos en el servidor |
| `deploy/backup.sh` | `pg_dump -Fc` + tar de `uploads/`, podando a 14 días. Aviso si no se copia fuera del disco |
| `deploy/Caddyfile` | Un dominio para web y API: mismo origen, sin CORS y sin cookies cross-site. Health check activo contra `/api/health` y tope de 30 MB en el cuerpo |
| `deploy/systemd/iunav-*.service` | `Restart=always`, usuario `iunav`, `ProtectSystem=strict` |

Cuatro decisiones que conviene no rehacer:

1. **Un solo dominio, no dos subdominios.** Con web y API en el mismo origen, el navegador nunca hace peticiones cross-origin: CORS queda sin activarse y no hay cookie de sesión entre sitios distintos.
2. **`DB_SSL=false` es obligatorio** contra el PostgreSQL local. El default de `src/config/env.ts:29` es SSL **activado** (`process.env.DB_SSL !== 'false'`), así que sin esa línea la conexión falla.
3. **`NEXT_PUBLIC_API_URL` se incrusta en el bundle al compilar.** Cambiar el dominio obliga a reconstruir la web; reiniciar el servicio no basta. `actualizar.sh` lo carga desde `/etc/iunav/web.env` antes del build por eso.
4. **`API_HOST=127.0.0.1`** (nuevo, `src/config/env.ts:28`): antes el Express escuchaba en todas las interfaces. Ahora solo Caddy lo alcanza. Y `iunav-web.service` fija `Environment=HOSTNAME=127.0.0.1` porque Next usa `HOSTNAME` como interfaz de escucha y systemd pone ahí el nombre de la máquina, que no resuelve.

Lo que este despliegue **no** cubre, y sigue pendiente: migraciones versionadas (se reaplica `sql/schema.sql` entero), rate limit en memoria (por proceso), JWT en `localStorage` sin revocación, sin CSP, reportes generados en RAM, y sin métricas ni alertas.

---

## 7. Orden sugerido de trabajo

Lo que queda, en el orden en que más bloquea a un usuario real:

1. **Commitear las Fases 1 a 7.** Hoy son 42 modificados, 39 borrados y 40 archivos nuevos sin rastrear: el riesgo más grande ahora mismo no es de código, es de git.
2. **README en la raíz** (item 12): clonar, `db:schema`, `db:seed`, dos terminales, cuentas de prueba.
3. **Autoservicio de contraseña** (lo que quedó del item 4): correo de recuperación, no solo el reset del admin.
4. **JWT en cookie `httpOnly`** (item 9). El `web/.env.example` ya está (item 8).
5. **Contraseñas del seed fuera del código** (item 10, ya con guardia `--confirm-seed`) + rotar la de Supabase.
6. **Paginación** (item 15) antes de que entre la primera tanda de datos reales.
7. **Pruebas de carga** con 200+ estudiantes (5.5), mirando sobre todo el consolidado de horas. En 2 GB de RAM, el riesgo real es que ExcelJS construya varios libros a la vez.
8. **Probar el despliegue de verdad** siguiendo `deploy/README.md`. Los scripts están escritos y con la sintaxis validada, pero **nunca se han ejecutado** en una VPS: el primer `instalar.sh` es la prueba real.

---

## 8. Notas para quien retome esto

- **No hay memoria entre sesiones.** Este archivo y `git log` son el contexto.
- `web/AGENTS.md` exige leer la guía relevante en `web/node_modules/next/dist/docs/` antes de escribir código Next.js. En Next 16 `cookies()` es **async** (`await cookies()`) y el archivo que antes se llamaba `middleware.ts` ahora es **`proxy.ts`** (`export function proxy`, no `middleware`). Ese bloque lo regenera `next dev`; no lo borres del diff, commitéalo con el trabajo.
- En Next 16 el `matcher` de `proxy.ts` tiene que ser **literal**: Next lo analiza al compilar y un array calculado a partir de `RUTAS` hace fallar el build. Por eso la lista está escrita a mano y `RUTAS_CUBIERTAS` existe para que el typecheck la vigile.
- El JWT viaja en `localStorage` **y** en una cookie espejo que el `proxy` lee. Es deliberado: la cookie permite cortar rutas en el servidor sin esperar a que el cliente monte. Mientras esa cookie no sea `httpOnly` no aporta seguridad real (item 9).
- El proyecto Supabase ya no se usa: `server/sql/schema.sql` y `.env.example` apuntan a PostgreSQL local, y no queda ningún rastro en el código.
- `server/.env` tiene un `?schema=public` al final de la URL que `pg` ignora; se puede limpiar sin riesgo.
- Si se toca el esquema, siempre `npm run db:schema` (usa `create table if not exists`, es idempotente) y luego `npm run db:seed -- --confirm-seed`.
- **En una VPS, los secretos no están en el repo.** Viven en `/etc/iunav/server.env` (modo 640, grupo `iunav`), que genera `deploy/instalar.sh`. Ese archivo nunca se versiona.
- El remoto de git para desplegar tiene que ser **privado**: en el historial están los commits viejos con la contraseña de Supabase que se borró del árbol de trabajo. Antes de publicar en cualquier sitio, rotar esa contraseña.
- **Las pruebas nunca tocan `app_iunav`.** `tests/setup.ts` reemplaza la base antes de que se importe el pool, y `npm run db:test` se niega a dropear cualquier nombre que no termine en `_test`. Verificado tras 368 pruebas: `app_iunav` seguía en 8 usuarios / 4 grupos / 8 integrantes / 12 bitácoras / 10 servicios / 5 plantillas / 1 periodo.
- Para cambiar la matriz de permisos, edita la constante `CASOS` en `server/tests/permisos.test.ts` y la tabla de la sección 4. Los dos deben seguir diciendo lo mismo, y el test de cobertura falla si se te olvida uno de los dos.
- `Servicio-Comunitario-IUNAV-Estado.pdf` está en la raíz, sin rastrear por git. Es documentación, no código: no lo borres sin leerlo.