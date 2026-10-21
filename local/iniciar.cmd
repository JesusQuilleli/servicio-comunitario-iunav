@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set RAIZ=%~dp0
if "%RAIZ:~-1%"=="\" set RAIZ=%RAIZ:~0,-1%
set PROYECTO=%RAIZ%\..
set DIR_LOGS=%RAIZ%logs

echo ========================================
echo    Servicio Comunitario IUNAV
echo    Inicio local
echo ========================================
echo.

call :comprobar_node
if errorlevel 1 goto :error

if not exist "%DIR_LOGS%" mkdir "%DIR_LOGS%" >nul 2>nul

echo [1/5] Revisando dependencias...
call :dependencias "%RAIZ%"
call :dependencias "%PROYECTO%\server"
call :dependencias "%PROYECTO%\web"
echo.

echo [2/5] Levantando base de datos local...
pushd "%RAIZ%"
node pg.mjs start
if errorlevel 1 (
  popd
  goto :error
)
node pg.mjs ensure-db
if errorlevel 1 (
  popd
  goto :error
)
popd

call :cargar_env
if errorlevel 1 goto :error

set DATABASE_URL=postgresql://postgres:!PG_PASSWORD!@127.0.0.1:55432/app_iunav
set TEST_DATABASE_URL=postgresql://postgres:!PG_PASSWORD!@127.0.0.1:55432/app_iunav_test
set DB_SSL=false
set JWT_SECRET=!JWT_SECRET!
set JWT_EXPIRES_IN=8h
set PORT=4000
set API_HOST=127.0.0.1
set FRONTEND_URL=http://localhost:3000
set UPLOAD_DIR=uploads
set NODE_ENV=development
set NEXT_PUBLIC_API_URL=http://localhost:4000

if not exist "%PROYECTO%\web\.env.local" echo NEXT_PUBLIC_API_URL=http://localhost:4000>"%PROYECTO%\web\.env.local"
echo.

echo [3/5] Actualizando esquema y datos...
pushd "%PROYECTO%\server"
set DATABASE_URL=%DATABASE_URL%
set TEST_DATABASE_URL=%TEST_DATABASE_URL%
set DB_SSL=%DB_SSL%
set JWT_SECRET=%JWT_SECRET%
set JWT_EXPIRES_IN=%JWT_EXPIRES_IN%
set PORT=%PORT%
set API_HOST=%API_HOST%
set FRONTEND_URL=%FRONTEND_URL%
set UPLOAD_DIR=%UPLOAD_DIR%
set NODE_ENV=%NODE_ENV%
call npm run db:schema
if errorlevel 1 (
  popd
  goto :error
)
call npm run db:seed -- --confirm-seed
if errorlevel 1 (
  popd
  goto :error
)
popd
echo.

echo [4/5] Iniciando API y Web...
start "IUNAV-API" cmd /k "cd /d %PROYECTO%\server && set DATABASE_URL=%DATABASE_URL% && set TEST_DATABASE_URL=%TEST_DATABASE_URL% && set DB_SSL=%DB_SSL% && set JWT_SECRET=%JWT_SECRET% && set JWT_EXPIRES_IN=%JWT_EXPIRES_IN% && set PORT=%PORT% && set API_HOST=%API_HOST% && set FRONTEND_URL=%FRONTEND_URL% && set UPLOAD_DIR=%UPLOAD_DIR% && set NODE_ENV=%NODE_ENV% && npm run dev"
timeout /t 5 /nobreak >nul
start "IUNAV-WEB" cmd /k "cd /d %PROYECTO%\web && set NEXT_PUBLIC_API_URL=%NEXT_PUBLIC_API_URL% && npm run dev"
echo     - Listo
echo.

echo [5/5] Esperando 30 segundos...
timeout /t 30 /nobreak >nul
echo.
echo ========================================
echo    Sistema iniciado
echo    URL: http://localhost:3000
echo    API: http://localhost:4000
echo.
echo    Credenciales:
echo    admin: cmendoza@iunav.edu.ve / admin123
echo    coord: mlopez@iunav.edu.ve / coord123
echo    tutor: jperez@iunav.edu.ve / tutor123
echo    estud: gmartinez@iunav.edu.ve / est123
echo ========================================
echo.
start "" "http://localhost:3000"
pause
exit /b 0

:comprobar_node
where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js no encontrado
  exit /b 1
)
node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<20||(v[0]==20&&v[1]<9)){process.exit(1)}else{process.exit(0)}"
if errorlevel 1 (
  echo [ERROR] Node.js 20.9+ requerido
  exit /b 1
)
echo Node.js OK
exit /b 0

:dependencias
set CARPETA=%~1
set NOMBRE=%~nx1
if not exist "%CARPETA%\package-lock.json" exit /b 0
if not exist "%CARPETA%\node_modules\.package-lock.json" (
  echo     - Instalando %NOMBRE%...
  pushd "%CARPETA%" && call npm ci && popd
) else (
  echo     - %NOMBRE% OK
)
exit /b 0

:cargar_env
if not exist "%RAIZ%\.env.local" (
  echo [ERROR] Falta local\.env.local - ejecuta instalar.cmd
  exit /b 1
)
for /f "usebackq tokens=1,* delims==" %%A in ("%RAIZ%\.env.local") do (
  if "%%A"=="PG_PASSWORD" set PG_PASSWORD=%%B
  if "%%A"=="JWT_SECRET" set JWT_SECRET=%%B
)
if not defined PG_PASSWORD exit /b 1
exit /b 0

:error
echo [ERROR] Fallo al iniciar
pause
exit /b 1
