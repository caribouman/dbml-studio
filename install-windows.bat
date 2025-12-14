@echo off
REM ====================================================================
REM DBML Studio - Windows Installation Script
REM ====================================================================
REM This script builds the Windows installer for DBML Studio
REM
REM Requirements:
REM   - Node.js 18+ (https://nodejs.org/)
REM   - npm (comes with Node.js)
REM
REM Output:
REM   - DBML Studio Setup.exe in app/release/
REM ====================================================================

echo.
echo ================================================
echo   DBML Studio - Windows Installer Builder
echo ================================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not installed!
    echo.
    echo Please install Node.js from https://nodejs.org/
    echo Recommended version: 18.x or higher
    echo.
    pause
    exit /b 1
)

REM Check Node version
echo [INFO] Checking Node.js version...
node --version
echo.

REM Navigate to app directory
cd /d "%~dp0app"
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Could not navigate to app directory!
    pause
    exit /b 1
)

echo [STEP 1/4] Installing dependencies...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo [STEP 2/4] Building frontend...
echo.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed!
    pause
    exit /b 1
)

echo.
echo [STEP 3/4] Rebuilding native modules for Electron...
echo.
call npx electron-rebuild
if %ERRORLEVEL% NEQ 0 (
    echo [WARNING] electron-rebuild failed, continuing anyway...
)

echo.
echo [STEP 4/4] Building Windows installer...
echo.
call npx electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Installer build failed!
    pause
    exit /b 1
)

echo.
echo ================================================
echo   BUILD SUCCESSFUL!
echo ================================================
echo.
echo The Windows installer has been created in:
echo   %~dp0app\release\
echo.
echo Look for:
echo   - DBML Studio Setup X.X.X.exe
echo.
echo You can now distribute this installer to Windows users.
echo.
pause
