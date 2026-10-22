@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "PROYECTO=%RAIZ%\.."

echo ============================================================
echo    Servicio Comunitario IUNAV
echo    Inicio local
echo ============================================================
echo.

call :comprobar_node
if errorlevel 1 goto :error

echo [1/4] Levantando la base de datos local...
pushd "%RAIZ%"
node pg.mjs start
if errorlevel 1 ( popd & goto :error )
node pg.mjs ensure-db
if errorlevel 1 ( popd & goto :error )
popd
echo.

call :cargar_env
if errorlevel 1 goto :error

echo [2/4] Actualizando el esquema y los datos de ejemplo...
echo        (es seguro repetirlo: no borra lo que ya hayas creado)
pushd "%PROYECTO%\server"
call npm run db:schema
if errorlevel 1 ( popd & goto :error )
call npm run db:seed -- --confirm-seed
if errorlevel 1 ( popd & goto :error )
popd
echo.

echo [3/4] Iniciando la API y la web...
echo        La primera vez puede tardar un minuto: la web compila.
node "%RAIZ%\app.mjs" start
if errorlevel 1 goto :error
echo.

echo [4/4] Abriendo el navegador...
start "" "http://localhost:3000"
echo.

echo ============================================================
echo    Sistema en marcha
echo.
echo      Web:  http://localhost:3000
echo      API:  http://localhost:4000/api/health
echo.
echo    Cuentas de prueba:
echo      Administrador  cmendoza@iunav.edu.ve   admin123
echo      Coordinador    mlopez@iunav.edu.ve     coord123
echo      Tutor          jperez@iunav.edu.ve     tutor123
echo      Estudiante     gmartinez@iunav.edu.ve  est123
echo.
echo    Para cerrarlo todo: doble clic en detener.cmd
echo    Si algo falla, los registros estan en local\logs\
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

:cargar_env
if not exist "%RAIZ%\.env.local" (
  echo [ERROR] Falta el archivo local\.env.local.
  echo         Ejecuta primero instalar.cmd (solo hace falta la primera vez).
  exit /b 1
)
set "PG_PASSWORD="
set "JWT_SECRET="
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

set "DATABASE_URL=postgresql://postgres:%PG_PASSWORD%@127.0.0.1:55432/app_iunav"
set "TEST_DATABASE_URL=postgresql://postgres:%PG_PASSWORD%@127.0.0.1:55432/app_iunav_test"
set "DB_SSL=false"
set "JWT_EXPIRES_IN=8h"
set "PORT=4000"
set "API_HOST=127.0.0.1"
set "FRONTEND_URL=http://localhost:3000"
set "UPLOAD_DIR=uploads"
set "NODE_ENV=development"
set "NEXT_PUBLIC_API_URL=http://localhost:4000"
exit /b 0

:error
echo.
echo ============================================================
echo    El sistema no pudo arrancar.
echo    Revisa el mensaje de arriba y vuelve a intentarlo.
echo    Registros: local\logs\
echo ============================================================
echo.
pause
exit /b 1
