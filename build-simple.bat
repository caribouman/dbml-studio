@echo off
REM Script de build simple - sans electron-rebuild qui peut causer des problemes

echo.
echo ================================================
echo   DBML Studio - Build Windows (Simple)
echo ================================================
echo.

REM Verifier Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Node.js n'est pas installe!
    echo Telechargez-le depuis https://nodejs.org/
    pause
    exit /b 1
)

echo [INFO] Node.js version:
node --version
echo.

REM Aller dans le dossier app
echo [INFO] Navigation vers le dossier app...
cd /d "%~dp0app"
if not exist "package.json" (
    echo [ERREUR] Le fichier package.json n'existe pas!
    echo Verifiez que vous etes dans le bon dossier.
    pause
    exit /b 1
)

echo.
echo [ETAPE 1/3] Installation des dependances...
echo (Cela peut prendre plusieurs minutes la premiere fois)
echo.
npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] L'installation a echoue!
    echo.
    echo Solutions possibles:
    echo - Verifiez votre connexion internet
    echo - Supprimez le dossier node_modules et reessayez
    echo - Lancez en tant qu'administrateur
    echo.
    pause
    exit /b 1
)

echo.
echo [ETAPE 2/3] Build du frontend...
echo.
npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] Le build du frontend a echoue!
    pause
    exit /b 1
)

echo.
echo [ETAPE 3/3] Creation de l'installateur Windows...
echo (Cela peut prendre 5-10 minutes)
echo.
npx electron-builder --win --x64
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERREUR] La creation de l'installateur a echoue!
    echo.
    echo Consultez les logs ci-dessus pour plus de details.
    pause
    exit /b 1
)

echo.
echo ================================================
echo   BUILD REUSSI !
echo ================================================
echo.
echo L'installateur se trouve dans:
cd
echo release\DBML Studio Setup 1.0.0.exe
echo.
echo Vous pouvez maintenant distribuer ce fichier.
echo.
pause
