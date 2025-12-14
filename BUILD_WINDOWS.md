# Guide Rapide - Build Windows

## Installation en 3 étapes

### 1. Vérifier les prérequis

```bash
node --version
# Doit afficher v18.x ou supérieur
```

Si Node.js n'est pas installé : [Télécharger Node.js](https://nodejs.org/)

### 2. Lancer le script d'installation

**Méthode A - Double-clic (Plus simple)**
```
Double-cliquez sur : install-windows.bat
```

**Méthode B - PowerShell (Recommandé)**
```powershell
.\install-windows.ps1
```

**Méthode C - Ligne de commande**
```cmd
install-windows.bat
```

### 3. Récupérer l'installateur

Après le build (durée : 5-10 minutes), l'installateur se trouve dans :

```
app/release/DBML Studio Setup 1.0.0.exe
```

## Distribuer l'application

1. **Copiez le fichier** `DBML Studio Setup 1.0.0.exe`
2. **Distribuez-le** aux utilisateurs Windows
3. Les utilisateurs **double-cliquent** pour installer

## Taille du fichier

- Installateur : ~200-250 MB
- Application installée : ~400-500 MB

## Fonctionnalités incluses

✅ Éditeur DBML interactif
✅ Visualisation de schémas avec React Flow
✅ Authentification (local, Google, GitHub)
✅ Sauvegarde cloud de diagrammes
✅ **Intégration Azure Databricks** :
   - Connexion à Databricks SQL Warehouse
   - Déploiement de tables DBML → Databricks
   - Support Unity Catalog (catalogues + schémas)
   - Conversion automatique des types

## Dépannage express

### ❌ "node: command not found"
**Solution** : Installez Node.js

### ❌ "Build failed"
**Solution** :
```bash
cd app
rm -rf node_modules
npm install
npm run electron:build:win
```

### ❌ Windows Firewall bloque l'app
**Solution** : Cliquez "Autoriser" (normal, le serveur local démarre)

## Mode développement

Pour tester sans créer l'installateur :

```bash
cd app
npm install
npm run build
npm run electron
```

## Documentation complète

- **Installation détaillée** : [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md)
- **Guide Databricks** : [README_DATABRICKS.md](README_DATABRICKS.md)
- **Documentation projet** : [CLAUDE.md](app/CLAUDE.md)

## Support

Problème ? Consultez les logs :
```
%APPDATA%\DBML Studio\electron-debug.log
```

---

**C'est tout ! 🚀**

Le build prend ~10 minutes la première fois, puis ~2-3 minutes les fois suivantes.
