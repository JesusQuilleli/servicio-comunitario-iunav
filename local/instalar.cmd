@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "PROYECTO=%RAIZ%\.."
set "DIR_LOGS=%RAIZ%logs"

echo ============================================================
echo    Servicio Comunitario IUNAV
echo    Instalacion local (una sola vez)
echo ============================================================
echo.
echo Este instalador deja el sistema listo para usarse en este
echo equipo. No hace falta instalar PostgreSQL: la base de datos
echo viene dentro del propio kit.
echo.

rem ---------------------------------------------------------------
rem 1) Node.js
rem ---------------------------------------------------------------
call :comprobar_node
if errorlevel 1 goto :error

rem ---------------------------------------------------------------
rem 2) Dependencias de los tres proyectos
rem ---------------------------------------------------------------
echo [1/4] Revisando las dependencias del proyecto...
call :dependencias "%RAIZ%"
if errorlevel 1 goto :error
call :dependencias "%PROYECTO%\server"
if errorlevel 1 goto :error
call :dependencias "%PROYECTO%\web"
if errorlevel 1 goto :error
echo.

rem ---------------------------------------------------------------
rem 3) Base de datos local (PostgreSQL embebido)
rem ---------------------------------------------------------------
echo [2/4] Preparando la base de datos local...
if not exist "%DIR_LOGS%" mkdir "%DIR_LOGS%" >nul 2>nul
pushd "%RAIZ%" && node pg.mjs start && popd
if errorlevel 1 goto :error
pushd "%RAIZ%" && node pg.mjs ensure-db && popd
if errorlevel 1 goto :error
echo.

rem ---------------------------------------------------------------
rem 4) Variables de entorno
rem ---------------------------------------------------------------
call :cargar_env
if errorlevel 1 goto :error
if not exist "%PROYECTO%\web\.env.local" (
  echo NEXT_PUBLIC_API_URL=http://localhost:4000>"%PROYECTO%\web\.env.local"
  echo Se creo web\.env.local para que la web hable con la API local.
) else (
  echo web\.env.local ya existia: no se toco.
)
echo.

rem ---------------------------------------------------------------
rem 5) Esquema y datos de ejemplo
rem ---------------------------------------------------------------
echo [3/4] Creando las tablas y los datos de ejemplo...
call :aplicar_esquema
if errorlevel 1 goto :error
echo.

echo [4/4] Instalacion terminada.
echo.
echo ============================================================
echo    Listo. Para usar el sistema:
echo.
echo      1. Abre la carpeta "local" y haz doble clic en
echo         "iniciar.cmd".
echo      2. Se abrira el navegador con el sistema ya en marcha.
echo      3. Para cerrar todo, haz doble clic en "detener.cmd".
echo.
echo    Cuentas de prueba:
echo      Administrador  cmendoza@iunav.edu.ve   admin123
echo      Coordinador   mlopez@iunav.edu.ve      coord123
echo      Tutor          jperez@iunav.edu.ve      tutor123
echo      Estudiante     gmartinez@iunav.edu.ve   est123
echo ============================================================
echo.
pause
exit /b 0

rem ===============================================================
rem  Subrutinas
rem ===============================================================

:comprobar_node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] No se encontro Node.js en este equipo.
  echo.
  echo El sistema necesita Node.js 20.9 o superior ^(se recomienda la 22 LTS^).
  echo Instalalo con este comando y despues vuelve a abrir esta ventana:
  echo.
  echo     winget install OpenJS.NodeJS.LTS
  echo.
  echo Si no tienes winget, descarga Node.js desde https://nodejs.org/es/download
  exit /b 1
)
for /f "delims=" %%v in ('node -p "process.versions.node"') do set "VERSION_NODE=%%v"
node -e "const v=process.versions.node.split('.').map(Number);process.exit((v[0]>20||(v[0]===20&&v[1]>=9))?0:1)"
if errorlevel 1 (
  echo [ERROR] La version de Node.js instalada es la !VERSION_NODE! y hace falta la 20.9 o superior.
  echo.
  echo Actualizala con este comando y despues vuelve a abrir esta ventana:
  echo.
  echo     winget install OpenJS.NodeJS.LTS
  exit /b 1
)
echo Node.js !VERSION_NODE! detectado.
exit /b 0

:dependencias
set "CARPETA=%~1"
set "NOMBRE=%~nx1"
powershell -NoProfile -Command "$c='%CARPETA%'; $lock=Join-Path $c 'package-lock.json'; $inst=Join-Path $c 'node_modules\.package-lock.json'; if(-not (Test-Path $lock)){exit 2}; if(-not (Test-Path $inst)){exit 1}; if((Get-Item $inst).LastWriteTimeUtc -ge (Get-Item $lock).LastWriteTimeUtc){exit 0}else{exit 1}"
if errorlevel 2 (
  echo     - !NOMBRE!: sin package-lock.json, se omite.
  exit /b 0
)
if errorlevel 1 (
  echo     - !NOMBRE!: instalando dependencias. Puede tardar varios minutos...
  pushd "%CARPETA%"
  call npm ci
  set "CODIGO_NPM=!ERRORLEVEL!"
  popd
  if not "!CODIGO_NPM!"=="0" (
    echo [ERROR] La instalacion de dependencias de !NOMBRE! fallo.
    exit /b 1
  )
) else (
  echo     - !NOMBRE!: dependencias al dia.
)
exit /b 0

:cargar_env
set "PG_PASSWORD="
set "JWT_SECRET="
if not exist "%RAIZ%\.env.local" (
  echo [ERROR] No se encontro el archivo local\.env.local con la configuracion local.
  exit /b 1
)
for /f "usebackq tokens=1,* delims==" %%A in ("%RAIZ%\.env.local") do (
  if "%%A"=="PG_PASSWORD" set "PG_PASSWORD=%%B"
  if "%%A"=="JWT_SECRET" set "JWT_SECRET=%%B"
)
if not defined PG_PASSWORD (
  echo [ERROR] El archivo local\.env.local no tiene la linea PG_PASSWORD.
  exit /b 1
)
if not defined JWT_SECRET (
  echo [ERROR] El archivo local\.env.local no tiene la linea JWT_SECRET.
  exit /b 1
)
exit /b 0

:aplicar_esquema
set "DATABASE_URL=postgresql://postgres:!PG_PASSWORD!@127.0.0.1:55432/app_iunav"
set "TEST_DATABASE_URL=postgresql://postgres:!PG_PASSWORD!@127.0.0.1:55432/app_iunav_test"
set "DB_SSL=false"
set "JWT_SECRET=!JWT_SECRET!"
set "JWT_EXPIRES_IN=8h"
set "PORT=4000"
set "API_HOST=127.0.0.1"
set "FRONTEND_URL=http://localhost:3000"
set "UPLOAD_DIR=uploads"
set "NODE_ENV=development"
pushd "%PROYECTO%\server"
call npm run db:schema
set "CODIGO_NPM=!ERRORLEVEL!"
if not "!CODIGO_NPM!"=="0" (
  popd
  echo [ERROR] No se pudo crear el esquema de la base de datos.
  exit /b 1
)
call npm run db:seed -- --confirm-seed
set "CODIGO_NPM=!ERRORLEVEL!"
popd
if not "!CODIGO_NPM!"=="0" (
  echo [ERROR] No se pudieron cargar los datos de ejemplo.
  exit /b 1
)
exit /b 0

:error
echo.
echo ============================================================
echo    La instalacion no pudo terminar.
echo    Revisa el mensaje de arriba y vuelve a intentarlo.
echo ============================================================
echo.
pause
exit /b 1
