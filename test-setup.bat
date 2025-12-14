@echo off
REM Script de test pour diagnostiquer les problemes

echo ================================================
echo   DBML Studio - Test de l'environnement
echo ================================================
echo.

echo [TEST 1] Verification de Node.js...
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ECHEC] Node.js n'est pas installe ou pas dans le PATH
    echo.
    echo Action requise:
    echo 1. Telechargez Node.js depuis https://nodejs.org/
    echo 2. Installez-le avec les options par defaut
    echo 3. Redemarrez l'invite de commande
    echo.
    goto :end
) else (
    echo [OK] Node.js trouve
    node --version
)

echo.
echo [TEST 2] Verification de npm...
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ECHEC] npm n'est pas trouve
    goto :end
) else (
    echo [OK] npm trouve
    npm --version
)

echo.
echo [TEST 3] Verification du dossier app...
cd /d "%~dp0"
if not exist "app" (
    echo [ECHEC] Le dossier app n'existe pas!
    echo Verifiez que vous etes dans le bon repertoire.
    goto :end
) else (
    echo [OK] Dossier app trouve
)

cd app
if not exist "package.json" (
    echo [ECHEC] Le fichier package.json n'existe pas dans app/
    goto :end
) else (
    echo [OK] package.json trouve
)

echo.
echo [TEST 4] Verification des dossiers...
if exist "node_modules" (
    echo [INFO] node_modules existe deja
) else (
    echo [INFO] node_modules n'existe pas (sera cree lors de npm install)
)

if exist "dist" (
    echo [INFO] dist existe deja (frontend deja build)
) else (
    echo [INFO] dist n'existe pas (sera cree lors du build)
)

echo.
echo ================================================
echo   TOUS LES TESTS SONT REUSSIS !
echo ================================================
echo.
echo Vous pouvez maintenant lancer:
echo   build-simple.bat
echo.
echo Ou si vous preferez:
echo   install-windows.bat
echo.

:end
pause
