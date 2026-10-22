# Sistema de Servicio Comunitario — IUNAV

Aplicación web para gestionar el servicio comunitario del Instituto Universitario Adventista de Venezuela: estudiantes, grupos, tutores, bitácoras, servicios institucionales, validaciones y reportes.

El proyecto corre **completamente en local**. No necesita servidores externos, ni internet (salvo la primera instalación), ni una instalación aparte de PostgreSQL: trae su propia base de datos embebida.

## Inicio rápido (Windows)

Solo hay que hacer esto la primera vez:

1. Descargar el proyecto (con `git clone` o el ZIP desde GitHub).
2. Abrir la carpeta `local/` y hacer doble clic en **`instalar.cmd`**.
3. Esperar a que termine (entre 5 y 15 minutos la primera vez).
4. Doble clic en **`iniciar.cmd`**. Se abre el navegador en <http://localhost:3000>.
5. Para apagar todo: doble clic en **`detener.cmd`**.

El paso a paso completo, con capturas de lo que muestra cada ventana, solución de problemas y cómo desinstalar, está en **[`docs/Manual-Despliegue-Local.pdf`](docs/Manual-Despliegue-Local.pdf)**.

## Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administrador | `cmendoza@iunav.edu.ve` | `admin123` |
| Coordinador | `mlopez@iunav.edu.ve` | `coord123` |
| Tutor | `jperez@iunav.edu.ve` | `tutor123` |
| Estudiante | `gmartinez@iunav.edu.ve` | `est123` |

Hay más cuentas de ejemplo en la base de datos para probar grupos con varios integrantes (ver el manual, sección 8).

## Documentación

| Archivo | Contenido |
|---|---|
| [`docs/Manual-Despliegue-Local.pdf`](docs/Manual-Despliegue-Local.pdf) | Instalación local paso a paso (para el tutor evaluador). |
| [`docs/Guia-de-Usuario-IUNAV.pdf`](docs/Guia-de-Usuario-IUNAV.pdf) | Qué puede hacer cada rol. |
| [`docs/Flujo-de-Uso-IUNAV.pdf`](docs/Flujo-de-Uso-IUNAV.pdf) | El ciclo completo del programa, por etapas. |
| [`local/README.md`](local/README.md) | Detalles técnicos del kit local. |
| [`HANDOFF.md`](HANDOFF.md) | Ficha técnica del proyecto. |

Las fuentes HTML de los manuales están en `docs/` por si se quieren regenerar los PDF.

## Estructura

```
local/    Kit de instalación de un clic (PostgreSQL embebido + API + web)
server/   API REST: Node.js + Express 4 + TypeScript + Zod + PostgreSQL
web/      Interfaz: Next.js 16 (App Router) + React 19 + Tailwind 4
deploy/   Scripts para publicar en un servidor (no se usan en local)
docs/     Manuales y guías (HTML + PDF)
```

## Qué incluye

- **48 endpoints** con autenticación JWT y permisos por endpoint para 4 roles (administrador, coordinador, tutor, estudiante).
- **9 tablas** en PostgreSQL, creadas por `server/sql/schema.sql`.
- **449 pruebas automáticas** (Vitest + Supertest).
- Datos de ejemplo idempotentes: reiniciar el sistema no borra lo que se haya creado.
- Todo lo generado en local vive dentro de la carpeta del proyecto; desinstalar es borrar la carpeta.

## Puertos

| Servicio | Puerto |
|---|---|
| Web | 3000 |
| API | 4000 |
| PostgreSQL embebido | 55432 |

## Desarrollo

```bash
# API
cd server
npm install
npm run dev          # http://localhost:4000

# Web (en otra terminal)
cd web
npm install
npm run dev          # http://localhost:3000
```

Verificación:

```bash
cd server
npm test             # 449 pruebas
npm run typecheck
npm run typecheck:tests

cd ../web
npm run lint
npm run build
```

## Tecnologías

TypeScript · Node.js · Express 4 · PostgreSQL 17 · Zod · Next.js 16 · React 19 · Tailwind CSS 4 · Vitest
