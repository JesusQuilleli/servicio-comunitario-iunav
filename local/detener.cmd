@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"
set "DIR_LOGS=%RAIZ%logs"

echo ============================================================
echo    Servicio Comunitario IUNAV
echo    Detener el sistema local
echo ============================================================
echo.

rem ---------------------------------------------------------------
rem Se cierra por PID (lo que guarda la carpeta logs), no por el
rem titulo de la ventana: asi funciona aunque el usuario haya
rem renombrado o movido las ventanas.
rem ---------------------------------------------------------------
echo [1/3] Cerrando la API...
call :terminar "%DIR_LOGS%\api.pid" "la API"

echo [2/3] Cerrando la web...
call :terminar "%DIR_LOGS%\web.pid" "la web"

echo [3/3] Cerrando la base de datos local...
if exist "%RAIZ%pg.mjs" (
  node "%RAIZ%pg.mjs" stop
) else (
  echo     - No se encontro el archivo pg.mjs: se omite.
)

echo.
echo ============================================================
echo    Todo cerrado. Ya puedes apagar el equipo.
echo ============================================================
echo.
pause
exit /b 0

rem ===============================================================
rem  Subrutinas
rem ===============================================================

:terminar
set "ARCHIVO_PID=%~1"
set "NOMBRE=%~2"
if not exist "%ARCHIVO_PID%" (
  echo     - %NOMBRE% no estaba en marcha.
  exit /b 0
)
set "PID_ACTUAL="
for /f "usebackq delims=" %%p in ("%ARCHIVO_PID%") do set "PID_ACTUAL=%%p"
if not defined PID_ACTUAL (
  del /q "%ARCHIVO_PID%" >nul 2>nul
  echo     - %NOMBRE% no estaba en marcha.
  exit /b 0
)
powershell -NoProfile -Command "if (Get-Process -Id !PID_ACTUAL! -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  del /q "%ARCHIVO_PID%" >nul 2>nul
  echo     - %NOMBRE% ya estaba detenida.
  exit /b 0
)
echo     - Cerrando %NOMBRE% ^(pid !PID_ACTUAL!^)...
taskkill /PID !PID_ACTUAL! /T /F >nul 2>nul
del /q "%ARCHIVO_PID%" >nul 2>nul
exit /b 0
