@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "PROYECTO=%RAIZ%\.."
set "DIR_LOGS=%RAIZ%logs"

echo ============================================================
echo    Servicio Comunitario IUNAV
echo    Inicio local
echo ============================================================
echo.

rem ---------------------------------------------------------------
rem 1) Node.js
rem ---------------------------------------------------------------
call :comprobar_node
if errorlevel 1 goto :error

if not exist "%DIR_LOGS%" mkdir "%DIR_LOGS%" >nul 2>nul

rem ---------------------------------------------------------------
rem 2) Dependencias (solo si faltan o si el lock cambio)
rem ---------------------------------------------------------------
echo [1/5] Revisando las dependencias del proyecto...
call :dependencias "%RAIZ%"
if errorlevel 1 goto :error
call :dependencias "%PROYECTO%\server"
if errorlevel 1 goto :error
call :dependencias "%PROYECTO%\web"
if errorlevel 1 goto :error
echo.

rem ---------------------------------------------------------------
rem 3) Puertos libres
rem ---------------------------------------------------------------
call :puerto_libre 4000 "la API" "%DIR_LOGS%\api.pid"
set "RESULTADO_API=!ERRORLEVEL!"
if "!RESULTADO_API!"=="1" goto :error
set "ARRANCAR_API=1"
if "!RESULTADO_API!"=="2" set "ARRANCAR_API=0"

call :puerto_libre 3000 "la web" "%DIR_LOGS%\web.pid"
set "RESULTADO_WEB=!ERRORLEVEL!"
if "!RESULTADO_WEB!"=="1" goto :error
set "ARRANCAR_WEB=1"
if "!RESULTADO_WEB!"=="2" set "ARRANCAR_WEB=0"
echo.

rem ---------------------------------------------------------------
rem 4) Base de datos local
rem ---------------------------------------------------------------
echo [2/5] Levantando la base de datos local...
pushd "%RAIZ%" && node pg.mjs start && popd
if errorlevel 1 goto :error
pushd "%RAIZ%" && node pg.mjs ensure-db && popd
if errorlevel 1 goto :error

call :cargar_env
if errorlevel 1 goto :error

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

if not exist "%PROYECTO%\web\.env.local" (
  echo NEXT_PUBLIC_API_URL=http://localhost:4000>"%PROYECTO%\web\.env.local"
  echo Se creo web\.env.local para que la web hable con la API local.
)
echo.

rem ---------------------------------------------------------------
rem 5) Esquema y datos de ejemplo (idempotentes)
rem ---------------------------------------------------------------
echo [3/5] Actualizando las tablas y los datos de ejemplo...
pushd "%PROYECTO%\server"
call npm run db:schema
set "CODIGO_NPM=!ERRORLEVEL!"
if not "!CODIGO_NPM!"=="0" (
  popd
  echo [ERROR] No se pudo actualizar el esquema de la base de datos.
  goto :error
)
call npm run db:seed -- --confirm-seed
set "CODIGO_NPM=!ERRORLEVEL!"
popd
if not "!CODIGO_NPM!"=="0" (
  echo [ERROR] No se pudieron cargar los datos de ejemplo.
  goto :error
)
echo.

rem ---------------------------------------------------------------
rem 6) Ventanas de la API y de la web
rem ---------------------------------------------------------------
echo [4/5] Abriendo la API y la web...
if "!ARRANCAR_API!"=="1" (
  call :levantar_ventana
set "TITULO=%~1"
set "CARPETA=%~2"
set "ARCHIVO_PID=%~3"
start "%TITULO%" cmd /k "cd /d %CARPETA% && set DATABASE_URL=%DATABASE_URL% && set TEST_DATABASE_URL=%TEST_DATABASE_URL% && set DB_SSL=%DB_SSL% && set JWT_SECRET=%JWT_SECRET% && set JWT_EXPIRES_IN=%JWT_EXPIRES_IN% && set PORT=%PORT% && set API_HOST=%API_HOST% && set FRONTEND_URL=%FRONTEND_URL% && set UPLOAD_DIR=%UPLOAD_DIR% && set NODE_ENV=%NODE_ENV% && set NEXT_PUBLIC_API_URL=http://localhost:4000 && npm run dev"
echo     - Ventana %TITULO% abierta.
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

:puerto_libre
set "PUERTO=%~1"
set "NOMBRE=%~2"
set "ARCHIVO_PID=%~3"
set "PID_ACTUAL="
if exist "%ARCHIVO_PID%" (
  for /f "usebackq delims=" %%p in ("%ARCHIVO_PID%") do set "PID_ACTUAL=%%p"
)
if defined PID_ACTUAL (
  powershell -NoProfile -Command "if (Get-Process -Id !PID_ACTUAL! -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
  if not errorlevel 1 (
    echo     - El puerto !PUERTO! de !NOMBRE! lo esta usando el sistema ya iniciado.
    exit /b 2
  )
)
powershell -NoProfile -Command "$c=New-Object System.Net.Sockets.TcpClient; try { $c.Connect('127.0.0.1',!PUERTO!); exit 1 } catch { exit 0 } finally { $c.Close() }"
if errorlevel 1 (
  echo [ERROR] El puerto !PUERTO! de !NOMBRE! ya esta ocupado por otro programa.
  echo Cierra ese programa y vuelve a intentarlo.
  exit /b 1
)
exit /b 0

:levantar_ventana
set "TITULO=%~1"
set "CARPETA=%~2"
set "ARCHIVO_PID=%~3"
start "%TITULO%" cmd /k "cd /d %CARPETA% && set DATABASE_URL=%DATABASE_URL% && set TEST_DATABASE_URL=%TEST_DATABASE_URL% && set DB_SSL=%DB_SSL% && set JWT_SECRET=%JWT_SECRET% && set JWT_EXPIRES_IN=%JWT_EXPIRES_IN% && set PORT=%PORT% && set API_HOST=%API_HOST% && set FRONTEND_URL=%FRONTEND_URL% && set UPLOAD_DIR=%UPLOAD_DIR% && set NODE_ENV=%NODE_ENV% && set NEXT_PUBLIC_API_URL=http://localhost:4000 && npm run dev"
echo     - Ventana %TITULO% abierta.
exit /b 0

:esperar_url
set "URL=%~1"
set "SEGUNDOS=%~2"
set "NOMBRE=%~3"
powershell -NoProfile -Command "$u='%URL%'; $n=%SEGUNDOS%; for($i=0;$i -lt $n;$i++){ try { $r=Invoke-WebRequest -UseBasicParsing -Uri $u -TimeoutSec 4; if($r.StatusCode -eq 200){ exit 0 } } catch {}; Start-Sleep -Milliseconds 700 }; exit 1"
if errorlevel 1 (
  echo [ERROR] !NOMBRE! no respondio a tiempo en %URL%.
  exit /b 1
)
echo     - !NOMBRE! responde correctamente.
exit /b 0

:cargar_env
set "PG_PASSWORD="
set "JWT_SECRET="
if not exist "%RAIZ%\.env.local" (
  echo [ERROR] No se encontro el archivo local\.env.local con la configuracion local.
  echo Ejecuta instalar.cmd primero.
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

:mostrar_log
set "ARCHIVO=%~1"
set "LINEAS=%~2"
if not exist "%ARCHIVO%" exit /b 0
echo ----- ultimas lineas de !ARCHIVO! -----
powershell -NoProfile -Command "Get-Content -Path '%ARCHIVO%' -Tail %LINEAS% -ErrorAction SilentlyContinue"
echo ------------------------------------------
exit /b 0

:error_servidor
echo.
echo [ERROR] El sistema no llego a levantarse. No se abrio el navegador.
echo.
call :mostrar_log "%DIR_LOGS%\postgres.log" 25
echo.
echo Revisa las ventanas de la API y de la web: ahi estan los detalles.
echo Si el problema sigue, ejecuta "detener.cmd" y vuelve a intentarlo.
echo.
pause
exit /b 1

:error
echo.
echo ============================================================
echo    No se pudo iniciar el sistema.
echo    Revisa el mensaje de arriba y vuelve a intentarlo.
echo ============================================================
echo.
pause
exit /b 1


