@echo off
chcp 65001 >nul
title HafsaRoastery Cashier Terminal Launcher (4GB RAM Optimized + Silent Thermal Print)

REM ============================================================================
REM HafsaRoastery Kiosk & Silent Thermal Receipt Printing Launcher
REM Tailored for Intel Core i3 (4GB RAM) + RONGTA Thermal Printer + RJ11 Drawer
REM ============================================================================
REM 1. Set your live Vercel URL (or local server URL) below:
if "%MIZAN_POS_URL%"=="" set "MIZAN_POS_URL=http://localhost:3000/pos"

set "BROWSER_EXE="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
  set "BROWSER_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
  set "BROWSER_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
) else if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
  set "BROWSER_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
) else if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
  set "BROWSER_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
)

if "%BROWSER_EXE%"=="" (
  echo [ERROR] Could not locate Google Chrome or Microsoft Edge.
  pause
  exit /b 1
)

set "POS_PROFILE_DIR=%LOCALAPPDATA%\HafsaRoastery_Cashier_Profile"

start "" "%BROWSER_EXE%" ^
  --app="%MIZAN_POS_URL%" ^
  --kiosk-printing ^
  --user-data-dir="%POS_PROFILE_DIR%" ^
  --disable-extensions ^
  --disable-background-networking ^
  --disable-sync ^
  --disable-translate ^
  --renderer-process-limit=2 ^
  --js-flags="--max-old-space-size=512"

exit /b 0

