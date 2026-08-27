@echo off
chcp 65001 >nul
title QQ Weekend Adventure - Local Start
cd /d "%~dp0"

echo.
echo Starting local demo...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-local.ps1"
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo Start failed. Exit code: %EXIT_CODE%
  echo.
  echo Tip: open this folder in terminal and run:
  echo   npm install
  echo   npm run dev
  echo.
) else (
  echo Dev server stopped.
  echo.
)

pause
exit /b %EXIT_CODE%
