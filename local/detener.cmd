@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set "RAIZ=%~dp0"
if "%RAIZ:~-1%"=="\" set "RAIZ=%RAIZ:~0,-1%"

echo ============================================================
echo    Servicio Comunitario IUNAV
echo    Detener el sistema local
echo ============================================================
echo.

rem Se cierra por PID (lo guarda local\app.mjs en logs\api.pid y
rem logs\web.pid), no por el titulo de la ventana: asi funciona aunque
rem el usuario no vea ninguna ventana abierta.
echo [1/2] Cerrando la API y la web...
if exist "%RAIZ%\app.mjs" (
  node "%RAIZ%\app.mjs" stop
) else (
  echo     - No se encontro app.mjs: se omite.
)
echo.

echo [2/2] Cerrando la base de datos local...
if exist "%RAIZ%\pg.mjs" (
  node "%RAIZ%\pg.mjs" stop
) else (
  echo     - No se encontro pg.mjs: se omite.
)
echo.

echo ============================================================
echo    Todo cerrado. Ya puedes apagar el equipo.
echo ============================================================
echo.
pause
exit /b 0
