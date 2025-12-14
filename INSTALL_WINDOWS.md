# Installation Windows - DBML Studio

Ce guide explique comment créer l'installateur Windows pour DBML Studio avec l'intégration Databricks.

## Prérequis

### Logiciels requis
- **Node.js 18+** : [Télécharger Node.js](https://nodejs.org/)
  - npm est inclus avec Node.js
  - Vérifier : `node --version` et `npm --version`

### Vérification des prérequis

Ouvrez PowerShell ou l'invite de commandes et exécutez :

```bash
node --version
# Devrait afficher v18.x.x ou supérieur

npm --version
# Devrait afficher 9.x.x ou supérieur
```

## Méthode 1 : Script automatique (Recommandé)

### Avec PowerShell (Recommandé)

1. Ouvrez PowerShell en tant qu'administrateur
2. Naviguez vers le dossier du projet :
   ```powershell
   cd D:\SRC\dbml-studio
   ```
3. Autorisez l'exécution de scripts (si nécessaire) :
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   ```
4. Lancez le script :
   ```powershell
   .\install-windows.ps1
   ```

### Avec Batch (.bat)

1. Double-cliquez sur `install-windows.bat`

   **OU**

2. Ouvrez l'invite de commandes et exécutez :
   ```cmd
   install-windows.bat
   ```

## Méthode 2 : Installation manuelle

Si vous préférez exécuter les commandes manuellement :

```bash
# 1. Naviguez vers le dossier app
cd app

# 2. Installez les dépendances
npm install

# 3. Construisez le frontend
npm run build

# 4. Reconstruisez les modules natifs pour Electron (optionnel)
npx electron-rebuild

# 5. Créez l'installateur Windows
npx electron-builder --win
```

## Résultat

Après un build réussi, vous trouverez l'installateur dans :

```
app/release/DBML Studio Setup X.X.X.exe
```

Où `X.X.X` est la version de l'application (définie dans `package.json`).

## Types de build disponibles

### Build Windows (par défaut)
```bash
npm run electron:build:win
```
Crée un installateur NSIS pour Windows x64.

### Build Linux
```bash
npm run electron:build:linux
```
Crée des packages AppImage et .deb pour Linux x64.

### Build tous les OS
```bash
npm run electron:build
```
Construit pour la plateforme actuelle uniquement.

## Structure de l'installateur

L'installateur Windows créé est un **NSIS Installer** avec les caractéristiques suivantes :

- ✅ Installation personnalisable (l'utilisateur peut choisir le répertoire)
- ✅ Raccourci sur le bureau
- ✅ Raccourci dans le menu Démarrer
- ✅ Désinstallateur automatique
- ✅ Base de données SQLite locale (stockée dans `%APPDATA%`)

## Fonctionnalités incluses

L'application Windows inclut toutes les fonctionnalités :

- ✅ Éditeur DBML avec coloration syntaxique
- ✅ Visualisation interactive des diagrammes
- ✅ Système d'authentification (local, Google, GitHub)
- ✅ Sauvegarde et partage de diagrammes
- ✅ **Intégration Azure Databricks** :
  - Configuration de connexion Databricks
  - Déploiement de tables DBML vers Databricks
  - Support des catalogues et schémas Unity Catalog
  - Conversion automatique DBML → SQL DDL Databricks

## Distribution de l'installateur

Une fois l'installateur créé, vous pouvez :

1. **Distribuer directement le fichier .exe**
   - Envoyez le fichier par email, cloud storage, etc.
   - Les utilisateurs doublent-cliquent pour installer

2. **Héberger sur un serveur**
   - Mettez le fichier sur un serveur web
   - Créez un lien de téléchargement

3. **Publier sur GitHub Releases**
   - Uploadez le fichier dans une GitHub Release
   - Les utilisateurs peuvent le télécharger depuis GitHub

## Taille approximative

- **Installateur** : ~200-250 MB
- **Application installée** : ~400-500 MB

La taille est importante car elle inclut :
- Electron runtime (Chrome + Node.js)
- Toutes les dépendances npm
- Le parser DBML (~11 MB)
- Les bibliothèques natives compilées

## Dépannage

### Erreur : "node: command not found"
**Solution** : Installez Node.js depuis https://nodejs.org/

### Erreur : "electron-rebuild failed"
**Solution** : Ce n'est généralement pas critique. Le build peut continuer.

### Erreur : "Module not found: better-sqlite3"
**Solution** :
```bash
cd app
npm install
npx electron-rebuild
```

### L'installateur ne se crée pas
**Solution** :
1. Vérifiez que le frontend a été construit (`app/dist/` existe)
2. Vérifiez les logs dans la console
3. Essayez de supprimer `app/node_modules` et réinstallez :
   ```bash
   cd app
   rm -rf node_modules
   npm install
   npm run electron:build:win
   ```

### Erreur Windows Firewall lors de l'exécution
**Réponse** : Normal ! Le serveur Express démarre en local.
- Cliquez sur "Autoriser l'accès" si demandé
- L'application se connecte uniquement à `localhost:3000`
- Aucune connexion réseau externe n'est nécessaire

## Mode développement

Pour tester l'application en mode développement (sans créer l'installateur) :

```bash
cd app

# Option 1 : Electron avec rebuild frontend
npm run electron:dev

# Option 2 : Electron simple (frontend déjà construit)
npm run electron

# Option 3 : Mode web avec HMR (hot reload)
npm run dev
# Puis ouvrez http://localhost:5173
```

## Configuration avancée

### Changer l'icône de l'application
1. Remplacez `app/icon.ico` (Windows)
2. Rebuild l'installateur

### Changer le nom de l'application
1. Modifiez `productName` dans `app/package.json`
2. Rebuild

### Changer la version
1. Modifiez `version` dans `app/package.json`
2. Rebuild

## Signature de code (Optionnel)

Pour une distribution professionnelle, vous pouvez signer l'application :

1. Obtenez un certificat de signature de code
2. Configurez electron-builder avec vos credentials :
   ```json
   "win": {
     "certificateFile": "path/to/cert.pfx",
     "certificatePassword": "password"
   }
   ```

## Support

Pour toute question ou problème :
1. Vérifiez les logs Electron : `%APPDATA%\DBML Studio\electron-debug.log`
2. Ouvrez un ticket sur GitHub
3. Consultez la documentation Electron : https://www.electronjs.org/

---

**Note** : L'application fonctionne entièrement en local sur votre machine Windows. Aucune connexion internet n'est requise sauf pour :
- L'authentification OAuth (Google/GitHub)
- Le déploiement vers Azure Databricks
