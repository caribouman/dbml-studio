# ====================================================================
# DBML Studio - Windows Installation Script (PowerShell)
# ====================================================================
# This script builds the Windows installer for DBML Studio
#
# Requirements:
#   - Node.js 18+ (https://nodejs.org/)
#   - npm (comes with Node.js)
#
# Output:
#   - DBML Studio Setup.exe in app/release/
# ====================================================================

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  DBML Studio - Windows Installer Builder" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "[INFO] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js is not installed!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install Node.js from https://nodejs.org/" -ForegroundColor Yellow
    Write-Host "Recommended version: 18.x or higher" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

# Check npm version
try {
    $npmVersion = npm --version
    Write-Host "[INFO] npm version: $npmVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERROR] npm is not installed!" -ForegroundColor Red
    exit 1
}

# Navigate to app directory
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$appPath = Join-Path $scriptPath "app"

if (-Not (Test-Path $appPath)) {
    Write-Host "[ERROR] App directory not found: $appPath" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

Set-Location $appPath

# Step 1: Install dependencies
Write-Host "[STEP 1/4] Installing dependencies..." -ForegroundColor Yellow
Write-Host ""
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Failed to install dependencies!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 2: Build frontend
Write-Host ""
Write-Host "[STEP 2/4] Building frontend..." -ForegroundColor Yellow
Write-Host ""
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Frontend build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Step 3: Rebuild native modules
Write-Host ""
Write-Host "[STEP 3/4] Rebuilding native modules for Electron..." -ForegroundColor Yellow
Write-Host ""
npx electron-rebuild
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] electron-rebuild failed, continuing anyway..." -ForegroundColor Yellow
}

# Step 4: Build Windows installer
Write-Host ""
Write-Host "[STEP 4/4] Building Windows installer..." -ForegroundColor Yellow
Write-Host ""
npx electron-builder --win
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Installer build failed!" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Success
Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "  BUILD SUCCESSFUL!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "The Windows installer has been created in:" -ForegroundColor Green
Write-Host "  $appPath\release\" -ForegroundColor Cyan
Write-Host ""
Write-Host "Look for:" -ForegroundColor Green
Write-Host "  - DBML Studio Setup X.X.X.exe" -ForegroundColor Cyan
Write-Host ""
Write-Host "You can now distribute this installer to Windows users." -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
