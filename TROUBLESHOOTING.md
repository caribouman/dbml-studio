# Dépannage - Build Windows

## 🔍 Diagnostic rapide

### Étape 1 : Tester votre environnement

Lancez le script de test :
```cmd
test-setup.bat
```

Ce script vérifie :
- ✅ Node.js est installé
- ✅ npm est installé
- ✅ Le dossier `app` existe
- ✅ Le fichier `package.json` existe

### Étape 2 : Essayer le build simple

Si tous les tests passent, lancez :
```cmd
build-simple.bat
```

Ce script évite `electron-rebuild` qui peut causer des problèmes.

## ❌ Erreurs courantes

### Erreur : "node: command not found" ou "node n'est pas reconnu"

**Cause** : Node.js n'est pas installé ou pas dans le PATH

**Solution** :
1. Téléchargez Node.js : https://nodejs.org/
2. Installez avec les options par défaut
3. **Important** : Redémarrez l'invite de commande
4. Vérifiez : `node --version`

---

### Erreur : "Cannot find module"

**Cause** : Dépendances npm manquantes

**Solution** :
```cmd
cd app
rmdir /s /q node_modules
del package-lock.json
npm install
```

---

### Erreur : "EPERM: operation not permitted"

**Cause** : Permissions insuffisantes

**Solution** :
1. Fermez tous les programmes (VS Code, explorateur de fichiers)
2. Lancez l'invite de commande en tant qu'administrateur
3. Réessayez

---

### Erreur : "electron-rebuild failed"

**Cause** : Problème avec les modules natifs

**Solution** : Utilisez `build-simple.bat` qui évite `electron-rebuild`

Ou installez les outils de build Windows :
```cmd
npm install --global windows-build-tools
```

---

### Erreur : "Out of memory" ou "JavaScript heap out of memory"

**Cause** : Pas assez de mémoire pour le build

**Solution** :
```cmd
cd app
set NODE_OPTIONS=--max-old-space-size=4096
npm run build
npx electron-builder --win
```

---

### Erreur : Build réussit mais pas d'installateur dans `release/`

**Cause** : electron-builder n'a pas créé le fichier

**Solution** :
1. Vérifiez les logs pour les erreurs
2. Essayez de build manuellement :
```cmd
cd app
npm run build
npx electron-builder --win --x64 --dir
```

Cela crée une version non-packagée dans `release/win-unpacked/`

---

### Erreur : "gyp ERR! find Python"

**Cause** : Python manquant (requis pour certains modules natifs)

**Solution** :
```cmd
npm install --global windows-build-tools
```

Ou installez Python 3.x : https://www.python.org/

---

### Erreur : "Cannot read property 'version' of undefined"

**Cause** : package.json corrompu

**Solution** :
```cmd
cd app
git checkout package.json
npm install
```

---

## 🛠️ Build manuel pas à pas

Si les scripts automatiques échouent, essayez manuellement :

### 1. Installer les dépendances
```cmd
cd D:\SRC\dbml-studio\app
npm install
```
⏱️ Durée : 2-5 minutes

### 2. Build le frontend
```cmd
npm run build
```
⏱️ Durée : 30-60 secondes

### 3. Vérifier que dist/ existe
```cmd
dir dist
```
Vous devriez voir `index.html` et le dossier `assets/`

### 4. Build l'application Electron (sans installateur)
```cmd
npx electron-builder --win --dir
```
⏱️ Durée : 2-3 minutes

Résultat : `release/win-unpacked/DBML Studio.exe` (version portable)

### 5. Build l'installateur complet
```cmd
npx electron-builder --win
```
⏱️ Durée : 5-10 minutes

Résultat : `release/DBML Studio Setup 1.0.0.exe`

---

## 🧹 Nettoyage complet

Si rien ne fonctionne, nettoyage complet :

```cmd
cd D:\SRC\dbml-studio\app

REM Supprimer les fichiers générés
rmdir /s /q node_modules
rmdir /s /q dist
rmdir /s /q release
rmdir /s /q build-output
del package-lock.json

REM Réinstaller
npm install

REM Rebuild
npm run build

REM Build Electron
npx electron-builder --win
```

---

## 📊 Vérifier les versions

```cmd
node --version
# Devrait afficher v18.x.x ou supérieur

npm --version
# Devrait afficher 9.x.x ou supérieur

npx electron --version
# Devrait afficher v39.x.x
```

---

## 🚀 Build de test rapide (sans installateur)

Pour tester l'app sans créer l'installateur :

```cmd
cd app
npm install
npm run build
npm run electron
```

L'application démarre directement sans installation.

---

## 📝 Logs détaillés

Pour voir les logs détaillés pendant le build :

```cmd
set DEBUG=electron-builder
npm run electron:build:win
```

Ou pour encore plus de détails :
```cmd
npx electron-builder --win --x64 --publish never -c.compression=store -c.win.certificateSubjectName=null
```

---

## 💡 Astuces

### Build plus rapide (sans compression)
```cmd
npx electron-builder --win --x64 -c.compression=store
```

### Build seulement la version portable (pas d'installateur)
```cmd
npx electron-builder --win --x64 --dir
```

### Voir ce qui est packagé
```cmd
npx electron-builder --win --x64 --prepackaged release/win-unpacked
```

---

## 🆘 Toujours bloqué ?

1. **Vérifiez les logs** : Cherchez la première erreur (pas la dernière)

2. **Testez npm** :
   ```cmd
   npm doctor
   ```

3. **Réinstallez Node.js** : Parfois la solution la plus simple

4. **Essayez sur une autre machine** : Pour vérifier si c'est un problème d'environnement

5. **Ouvrez une issue GitHub** avec :
   - Version de Node.js (`node --version`)
   - Version de npm (`npm --version`)
   - Version de Windows
   - Log complet de l'erreur
   - Étapes déjà essayées

---

## ✅ Checklist finale

Avant de demander de l'aide, vérifiez que :

- [ ] Node.js 18+ est installé
- [ ] npm fonctionne (`npm --version`)
- [ ] Vous êtes dans le bon dossier (`D:\SRC\dbml-studio`)
- [ ] Le dossier `app` existe
- [ ] `app/package.json` existe
- [ ] Vous avez essayé `build-simple.bat`
- [ ] Vous avez essayé le nettoyage complet
- [ ] Vous avez redémarré l'invite de commande
- [ ] Vous avez essayé en tant qu'administrateur

---

**Bon courage ! 💪**
