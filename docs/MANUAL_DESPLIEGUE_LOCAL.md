# MANUAL DE DESPLIEGUE LOCAL - Servicio Comunitario IUNAV

**Versión:** 1.0  
**Fecha:** 2026-10-21  
**Repositorio:** [https://github.com/JesusQuilleli/servicio-comunitario-iunav](https://github.com/JesusQuilleli/servicio-comunitario-iunav)  
**Rama:** master  

---

## Índice

- [1. Objetivo](#1-objetivo)
- [2. Requisitos Previos](#2-requisitos-previos)
- [3. Clonar el Repositorio](#3-clonar-el-repositorio)
- [4. Opción A: Kit Local (Windows - Más Rápido)](#4-opción-a-kit-local-windows---más-rápido)
- [5. Opción B: Despliegue Manual (Windows/Linux/Mac)](#5-opción-b-despliegue-manual-windowslinuxmac)
- [6. Verificación del Despliegue](#6-verificación-del-despliegue)
- [7. Credenciales de Prueba](#7-credenciales-de-prueba)
- [8. Comandos Útiles](#8-comandos-útiles)
- [9. Solución de Problemas](#9-solución-de-problemas)
- [10. Anexos](#10-anexos)

---

## 1. Objetivo

Este manual tiene como finalidad guiar al tutor o evaluador para instalar, configurar y levantar el proyecto **Servicio Comunitario IUNAV** en un entorno local de pruebas, permitiendo validar todas las funcionalidades del sistema.

---

## 2. Requisitos Previos

Antes de iniciar, asegúrese de tener instalado lo siguiente:

| Software | Versión Mínima | Recomendado | Notas |
|---|---|---|---|
| [Node.js](https://nodejs.org/) | 20.9.0 | **22 LTS** | Next.js 16.3.5 requiere >= 20.9.0 |
| [npm](https://www.npmjs.com/) | 10+ | 11+ | Viene incluido con Node.js |
| [Git](https://git-scm.com/) | 2.30+ | Última versión | Para clonar el repositorio |
| [PostgreSQL](https://www.postgresql.org/) | 14+ | 16+ | **Solo para Opción B**. La Opción A usa PostgreSQL embebido |

> **Nota:** Si utiliza Windows y prefiere evitar instalar PostgreSQL manualmente, use la **Opción A (Kit Local)**.

---

## 3. Clonar el Repositorio

Abra una terminal (PowerShell, CMD o Terminal) y ejecute:

`ash
git clone https://github.com/JesusQuilleli/servicio-comunitario-iunav.git
cd servicio-comunitario-iunav
`

Verifique que se clonó correctamente revisando la estructura:

`ash
dir
`

Debería ver carpetas como server/, web/, local/, deploy/, docs/, entre otras.

---

## 4. Opción A: Kit Local (Windows - Más Rápido)

Esta opción es ideal para Windows. Incluye PostgreSQL embebido, configuración automática y un inicio con un solo comando.

### 4.1 Instalación (solo la primera vez)

1. Abra una terminal en la raíz del proyecto clonado
2. Ejecute el instalador:

`cmd
local\instalar.cmd
`

Este script realizará automáticamente:
- Verificación de versión de Node.js (>=20.9)
- Instalación de dependencias en local/, server/ y web/
- Descarga y configuración de PostgreSQL embebido en puerto **55432**
- Creación de bases de datos pp_iunav y pp_iunav_test
- Generación de local/.env.local con credenciales seguras
- Creación de web/.env.local con NEXT_PUBLIC_API_URL=http://localhost:4000
- Aplicación del esquema (sql/schema.sql)
- Carga de datos de prueba con 
pm run db:seed -- --confirm-seed

> **Tiempo estimado:** 5-10 minutos dependiendo de su conexión a internet.

### 4.2 Levantar la aplicación

Para iniciar API y Frontend:

`cmd
local\iniciar.cmd
`

Este script:
- Verifica que los puertos 4000 y 3000 estén libres
- Inicia PostgreSQL embebido
- Aplica esquema y seed si es necesario
- Abre **dos ventanas CMD**: una para el backend (server) y otra para el frontend (web)
- Espera a que ambos servicios estén listos
- Abre automáticamente el navegador en http://localhost:3000

### 4.3 Detener la aplicación

`cmd
local\detener.cmd
`

### 4.4 Puertos utilizados (Opción A)

| Servicio | Puerto | URL |
|---|---|---|
| PostgreSQL (embebido) | 55432 | localhost:55432 |
| Backend API | 4000 | [http://localhost:4000](http://localhost:4000) |
| Frontend Web | 3000 | [http://localhost:3000](http://localhost:3000) |

---

## 5. Opción B: Despliegue Manual (Windows/Linux/Mac)

Use esta opción si prefiere instalar PostgreSQL nativo en su máquina.

### 5.1 Configurar PostgreSQL

1. Instale [PostgreSQL](https://www.postgresql.org/download/) y asegúrese que esté corriendo
2. Abra psql o pgAdmin
3. Cree las bases de datos y (opcional) usuario:

`sql
CREATE DATABASE app_iunav;
CREATE DATABASE app_iunav_test; -- Opcional, solo para pruebas
`

Si usa el usuario postgres por defecto, no necesita crear otro usuario. Si desea uno personalizado, asígnele permisos sobre ambas bases de datos.

### 5.2 Configurar y levantar el Backend (Servidor API)

Abra una terminal en la raíz del proyecto.

#### Paso 1: Instalar dependencias

`ash
cd server
npm ci
`

#### Paso 2: Configurar variables de entorno

Copie el archivo de ejemplo:

`ash
# Windows (CMD)
copy .env.example .env

# Windows (PowerShell) / Linux / Mac
cp .env.example .env
`

Edite el archivo server/.env con sus credenciales de PostgreSQL. Los valores mínimos necesarios son:

`env
NODE_ENV=development
PORT=4000
API_HOST=127.0.0.1
FRONTEND_URL=http://localhost:3000

# Conexión a base de datos
DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/app_iunav
TEST_DATABASE_URL=postgresql://postgres:TU_CONTRASEÑA@localhost:5432/app_iunav_test

# JWT
JWT_SECRET=un_secreto_muy_largo_y_aleatorio_cambielo_en_produccion
JWT_EXPIRES_IN=8h

# Archivos
UPLOAD_DIR=uploads
DB_SSL=false
`

> **Importante:** Reemplace TU_CONTRASEÑA con la contraseña de su usuario PostgreSQL.

#### Paso 3: Crear esquema y cargar datos de prueba

`ash
# Aplicar esquema de base de datos
npm run db:schema

# Cargar datos de demostración (OBLIGATORIO pasar --confirm-seed)
npm run db:seed -- --confirm-seed
`

#### Paso 4: Iniciar servidor en modo desarrollo

`ash
npm run dev
`

El backend quedará corriendo en [http://localhost:4000](http://localhost:4000)

### 5.3 Configurar y levantar el Frontend (Web)

Abra **otra terminal** en la raíz del proyecto.

#### Paso 1: Instalar dependencias

`ash
cd web
npm ci
`

#### Paso 2: Configurar variables de entorno

Cree el archivo web/.env.local:

`ash
# Windows (CMD)
echo NEXT_PUBLIC_API_URL=http://localhost:4000 > .env.local

# Windows (PowerShell)
"NEXT_PUBLIC_API_URL=http://localhost:4000" | Out-File -Encoding utf8 .env.local

# Linux / Mac
echo "NEXT_PUBLIC_API_URL=http://localhost:4000" > .env.local
`

> **Nota:** Si omite este archivo, el frontend usará por defecto http://localhost:4000 automáticamente.

#### Paso 3: Iniciar frontend en modo desarrollo

`ash
npm run dev
`

El frontend quedará corriendo en [http://localhost:3000](http://localhost:3000)

---

## 6. Verificación del Despliegue

Una vez levantados ambos servicios, verifique lo siguiente:

| Verificación | URL/Comando | Resultado Esperado |
|---|---|---|
| **Health Check del API** | [http://localhost:4000/api/health](http://localhost:4000/api/health) | {"ok": true, "baseDeatos": true, ...} |
| **Página de Login** | [http://localhost:3000/login](http://localhost:3000/login) | Debe mostrar el formulario de inicio de sesión con las cuentas de demostración |
| **Acceso al Sistema** | Usar credenciales de prueba | Debe redirigir al Dashboard correspondiente al rol |

---

## 7. Credenciales de Prueba

El seed crea usuarios con datos de demostración para validar cada rol:

| Rol | Correo Electrónico | Contraseña | Funcionalidades a probar |
|---|---|---|---|
| **Administrador** | cmendoza@iunav.edu.ve | dmin123 | Gestión completa: usuarios, configuración, periodos, reportes |
| **Coordinador** | mlopez@iunav.edu.ve | coord123 | Gestión de usuarios, proyectos, configuración, validaciones |
| **Tutor** | jperez@iunav.edu.ve | 	utor123 | Validación de bitácoras, seguimiento de grupos, reportes |
| **Estudiante** | gmartinez@iunav.edu.ve | est123 | Registro de bitácora, registro de servicio, seguimiento a sus horas |

> **Nota:** En la pantalla de login también aparecen estas cuentas como "Cuentas de demostración" para autocompletar el formulario.

---

## 8. Comandos Útiles

### Backend (server/)

| Comando | Descripción |
|---|---|
| 
pm run dev | Inicia servidor en modo desarrollo con hot-reload |
| 
pm run build | Compila TypeScript a JavaScript |
| 
pm start | Inicia servidor en modo producción (requiere build previo) |
| 
pm run db:schema | Aplica esquema SQL desde sql/schema.sql |
| 
pm run db:seed -- --confirm-seed | Carga datos de demostración |
| 
pm run db:wipe | Limpia datos (mantiene un admin, resetea a dmin123). **Usar con precaución** |
| 
pm test | Ejecuta pruebas con Vitest |
| 
pm run typecheck | Verificación de tipos TypeScript |

### Frontend (web/)

| Comando | Descripción |
|---|---|
| 
pm run dev | Inicia Next.js en modo desarrollo (puerto 3000) |
| 
pm run build | Genera build de producción |
| 
pm start | Inicia servidor en modo producción (requiere build previo) |
| 
pm run lint | Ejecuta ESLint |
| 
px tsc --noEmit | Verificación de tipos TypeScript (no existe script 	ypecheck) |

---

## 9. Solución de Problemas

| Problema | Causa | Solución |
|---|---|---|
| **"Puerto 4000/3000 ya en uso"** | Otro proceso usando el puerto | Cierre la aplicación o cambie el puerto. En Windows: 
etstat -ano \| findstr :4000 y 	askkill /PID <PID> /F |
| **Error de conexión a PostgreSQL** | PostgreSQL no corriendo o credenciales incorrectas | Verifique que PostgreSQL esté activo. Revise DATABASE_URL en server/.env. Para Opción A, use local/iniciar.cmd |
| **CORS / Error al hacer login** | FRONTEND_URL incorrecto o puertos diferentes | Asegúrese que server/.env tenga FRONTEND_URL=http://localhost:3000 y el frontend corra en ese puerto |
| **"Node version not supported"** | Node.js < 20.9 | Actualice Node.js a v22 LTS desde [nodejs.org](https://nodejs.org/) |
| **Cambios en NEXT_PUBLIC_API_URL no se reflejan** | Variable inyectada en build | Las variables NEXT_PUBLIC_* se incrustan al compilar. Reinicie 
pm run dev o reconstruya si es build de producción |
| **db:seed falla sin confirmación** | Falta flag de confirmación | Ejecute 
pm run db:seed -- --confirm-seed exactamente como se indica |
| **Errores al instalar dependencias** | Cache corrupto o lockfile desincronizado | Elimine 
ode_modules y package-lock.json (solo si es necesario) y ejecute 
pm ci nuevamente |
| **Pantalla blanca / errores de hidratación** | Caché de Next.js corrupto | Elimine .next/ en web/ y reinicie: m -rf .next && npm run dev (o mdir /s /q .next en Windows CMD) |

---

## 10. Anexos

### 10.1 Variables de Entorno - Backend (server/.env)

| Variable | Requerida | Valor por defecto | Descripción |
|---|---|---|---|
| NODE_ENV | Sí | development | Entorno de ejecución |
| PORT | Sí | 4000 | Puerto del servidor API |
| API_HOST | Sí | 127.0.0.1 | Host de escucha |
| FRONTEND_URL | Sí | http://localhost:3000 | URL del frontend para CORS |
| DATABASE_URL | Sí | - | Cadena de conexión PostgreSQL |
| TEST_DATABASE_URL | Sí (para tests) | - | Cadena de conexión para BD de pruebas |
| JWT_SECRET | Sí | - | Secreto para firmar tokens JWT |
| JWT_EXPIRES_IN | Sí | 8h | Tiempo de expiración del token |
| UPLOAD_DIR | Sí | uploads | Directorio para archivos subidos |
| DB_SSL | No | alse | Habilitar SSL para conexión DB (	rue en producción) |

### 10.2 Variables de Entorno - Frontend (web/.env.local)

| Variable | Requerida | Valor por defecto | Descripción |
|---|---|---|---|
| NEXT_PUBLIC_API_URL | No | http://localhost:4000 | URL base del backend API |

### 10.3 Mapa de Rutas por Rol

| Módulo | Admin | Coordinador | Tutor | Estudiante |
|---|---|---|---|---|
| Dashboard | ✓ | ✓ | ✓ | ✓ |
| Registro de Usuarios | ✓ | ✓ | ✗ | ✗ |
| Usuarios | ✓ | ✓ | ✗ | ✗ |
| Proyectos/Grupos | ✓ | ✓ | ✓ | ✗ |
| Bitácora Comunitaria | ✗ | ✗ | ✗ | ✓ |
| Servicio Social/Ambiental | ✗ | ✗ | ✗ | ✓ |
| Validación | ✗ | ✗ | ✓ | ✗ |
| Configuración | ✓ | ✓ | ✗ | ✗ |
| Reportes | ✓ | ✓ | ✓ | ✗ |
| Cambiar Contraseña | ✓ | ✓ | ✓ | ✓ |
| Perfil | ✓ | ✓ | ✓ | ✓ |

### 10.4 Información de Contacto del Repositorio

- **Repositorio GitHub:** [https://github.com/JesusQuilleli/servicio-comunitario-iunav](https://github.com/JesusQuilleli/servicio-comunitario-iunav)
- **Rama principal:** master
- **Documentación adicional:** Ver carpeta docs/ del repositorio

---

**Elaborado para:** Validación y pruebas por parte del Tutor  
**Sistema:** Servicio Comunitario IUNAV  
**Tecnologías:** Node.js, Express, Next.js, PostgreSQL, TypeScript
