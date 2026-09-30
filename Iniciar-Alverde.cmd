@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Hace falta Node.js 22 o superior para desarrollar localmente.
  echo Para usar el sistema como usuario, abre el sitio publicado en Edge o Chrome; no necesitas clonar el repo, Node ni Docker.
  echo Descarga Node.js LTS desde https://nodejs.org/
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo No se encontro npm. Reinstala Node.js LTS y habilita la opcion que agrega Node al PATH.
  pause
  exit /b 1
)
npm run local
if errorlevel 1 pause
