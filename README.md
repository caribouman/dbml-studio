# DBML Studio

> Éditeur et visualiseur DBML interactif avec intégration Azure Databricks

DBML Studio est une application web/desktop qui permet de créer, visualiser et déployer des schémas de bases de données en utilisant le langage DBML (Database Markup Language).

![DBML Studio](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-18%2B-brightgreen)
![Electron](https://img.shields.io/badge/electron-39.x-blue)

## ✨ Fonctionnalités principales

### Éditeur DBML
- 📝 Éditeur avec coloration syntaxique (CodeMirror)
- 🔄 Parsing en temps réel
- 💾 Sauvegarde automatique en localStorage
- 📋 Exemples et templates intégrés

### Visualisation interactive
- 🎨 Diagrammes interactifs avec React Flow
- 🖱️ Tables et groupes déplaçables
- 🔗 Relations visuelles entre tables
- 📐 Auto-layout avec Dagre
- 💾 Positions persistées automatiquement

### Authentification
- 🔐 Authentification locale (email/password)
- 🌐 OAuth Google
- 🌐 OAuth GitHub
- 👤 Mode Electron auto-login (single-user)

### Gestion de diagrammes
- 📁 Bibliothèque de diagrammes personnels
- 🌍 Partage public de diagrammes
- 🏷️ Métadonnées (titre, description)
- 🔒 Contrôle de visibilité (public/privé)

### 🚀 **NOUVEAU : Intégration Azure Databricks**
- ⚡ Connexion directe à Databricks SQL Warehouse
- 🎯 Déploiement de tables DBML → Databricks
- 📊 Support Unity Catalog (catalogues + schémas)
- 🔄 Conversion automatique DBML → SQL DDL Databricks
- ✅ Vérification d'existence des tables
- 📈 Résultats détaillés du déploiement

## 🎯 Cas d'usage

### 1. Modélisation de base de données
Créez rapidement des schémas de bases de données avec DBML :
```dbml
Table users {
  id integer [pk, increment]
  username varchar [not null, unique]
  email varchar [not null, unique]
  created_at timestamp
}
```

### 2. Documentation technique
- Visualisez vos schémas existants
- Partagez avec votre équipe
- Exportez en images

### 3. Déploiement vers Databricks
- Convertissez automatiquement en SQL Databricks
- Déployez sur dev/staging/prod
- Gérez plusieurs environnements

## 📦 Deux modes de déploiement

### Mode Web (Docker)
Application web accessible via navigateur avec reverse proxy Traefik.

**Avantages** :
- Multi-utilisateurs
- Accessible depuis n'importe où
- OAuth complet (Google, GitHub)
- Base de données centralisée

**Démarrage** :
```bash
cd app
npm install
npm run build
cd ..
docker-compose up -d
```

### Mode Desktop (Electron - Windows)
Application native Windows standalone.

**Avantages** :
- Application locale (pas de serveur distant)
- Mode mono-utilisateur simplifié
- Données stockées localement
- Pas de firewall Windows (bind localhost uniquement)

**Installation** :
```bash
# Voir BUILD_WINDOWS.md pour les détails
.\install-windows.ps1
```

## 🚀 Installation rapide

### Prérequis
- Node.js 18+ ([Télécharger](https://nodejs.org/))
- Docker (mode web uniquement)

### Mode Développement local
```bash
cd app
npm install
npm run dev
```
Ouvre http://localhost:5173 (Vite HMR)

### Build Windows
```bash
.\install-windows.bat
```
Crée `app/release/DBML Studio Setup.exe`

### Mode Production (Docker)
```bash
cd app
npm install
npm run build
cd ..
docker-compose up -d
```

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [BUILD_WINDOWS.md](BUILD_WINDOWS.md) | Guide rapide pour créer l'installateur Windows |
| [INSTALL_WINDOWS.md](INSTALL_WINDOWS.md) | Documentation complète d'installation Windows |
| [README_DATABRICKS.md](README_DATABRICKS.md) | Guide d'utilisation de l'intégration Databricks |
| [app/CLAUDE.md](app/CLAUDE.md) | Documentation technique complète du projet |
| [WORKFLOW.md](WORKFLOW.md) | Workflow de développement Docker |

## 🏗️ Architecture

```
dbml-studio/
├── app/
│   ├── src/                      # Frontend React
│   │   ├── components/           # Composants React
│   │   │   ├── DBMLEditor.jsx           # Éditeur CodeMirror
│   │   │   ├── DBMLViewer.jsx           # Viewer React Flow
│   │   │   ├── DatabricksConnection.jsx # Config Databricks
│   │   │   ├── DatabricksDeployDialog.jsx # Déploiement
│   │   │   └── ...
│   │   ├── utils/                # Utilitaires
│   │   │   ├── dbmlParser.js     # Parser DBML
│   │   │   ├── api.js            # Client API
│   │   │   └── ...
│   │   └── stores/               # Zustand stores
│   │       └── authStore.js      # État authentification
│   │
│   ├── server.js                 # Serveur Express
│   ├── database.js               # SQLite avec sql.js
│   ├── auth.js                   # JWT + Passport
│   ├── databricksClient.js       # Client API Databricks
│   ├── dbmlToDatabricksSQL.js    # Convertisseur DBML→SQL
│   ├── electron.js               # Main process Electron
│   └── package.json
│
├── install-windows.bat           # Script d'installation Windows
├── install-windows.ps1           # Script PowerShell
├── docker-compose.yml            # Configuration Docker
└── README.md                     # Ce fichier
```

## 🛠️ Stack technique

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool & dev server
- **React Flow** - Diagrammes interactifs
- **CodeMirror 6** - Éditeur de code
- **Zustand** - State management
- **@dbml/core** - Parser DBML

### Backend
- **Node.js** - Runtime
- **Express** - Serveur web
- **sql.js** - SQLite en mémoire (SQL.js)
- **Passport.js** - Authentification (local, Google, GitHub)
- **JWT** - Tokens d'authentification
- **bcryptjs** - Hash de mots de passe

### Desktop
- **Electron 39** - Framework desktop
- **electron-builder** - Packaging Windows

### Databricks
- **Databricks SQL API** - Exécution SQL
- **REST API** - Communication

## 🔑 Configuration Databricks

### 1. Obtenir les credentials

Vous aurez besoin de :
- **Workspace URL** : `https://xxx.cloud.databricks.com`
- **Personal Access Token** : Généré dans User Settings → Access tokens
- **HTTP Path** : SQL Warehouse → Connection Details → HTTP path

### 2. Configurer dans l'application

1. Connectez-vous à DBML Studio
2. Cliquez sur "Databricks Settings"
3. Remplissez le formulaire
4. Testez la connexion
5. Sauvegardez

### 3. Déployer des tables

1. Écrivez ou chargez du DBML
2. Cliquez sur "Deploy to Databricks"
3. Sélectionnez catalog + schema
4. Cochez les tables à déployer
5. Cliquez sur "Deploy"

📖 **Guide complet** : [README_DATABRICKS.md](README_DATABRICKS.md)

## 📋 Exemple DBML

```dbml
// Définir un projet
Project DBML_Studio {
  database_type: 'Databricks'
  Note: 'E-commerce database schema'
}

// Table des utilisateurs
Table users {
  id integer [pk, increment]
  username varchar(50) [not null, unique]
  email varchar(100) [not null, unique]
  password_hash varchar(255) [not null]
  created_at timestamp [default: `now()`]

  Note: 'User accounts'
}

// Table des produits
Table products {
  id integer [pk, increment]
  name varchar(200) [not null]
  description text
  price decimal(10,2) [not null]
  stock integer [default: 0]
  created_at timestamp [default: `now()`]

  Indexes {
    (name) [name: 'idx_product_name']
  }
}

// Table des commandes
Table orders {
  id integer [pk, increment]
  user_id integer [not null, ref: > users.id]
  total decimal(10,2) [not null]
  status varchar(20) [not null, default: 'pending']
  created_at timestamp [default: `now()`]

  Note: 'Customer orders'
}

// Table des items de commande
Table order_items {
  id integer [pk, increment]
  order_id integer [not null, ref: > orders.id]
  product_id integer [not null, ref: > products.id]
  quantity integer [not null]
  unit_price decimal(10,2) [not null]
}

// Grouper les tables
TableGroup E-commerce {
  users
  orders
  order_items
  products
}
```

Ce DBML génère automatiquement :
- 4 tables avec leurs colonnes
- Clés primaires
- Contraintes NOT NULL
- Valeurs par défaut
- Relations (foreign keys)
- Index
- Commentaires

## 🔐 Sécurité

### Authentification
- Mots de passe hashés avec bcrypt (10 rounds)
- JWT avec expiration 7 jours
- Sessions Express avec secret
- OAuth sécurisé (HTTPS requis en production)

### Databricks
- Tokens stockés en base de données
- ⚠️ **Non chiffrés actuellement** (v1.0)
- Transmission via HTTPS uniquement
- Support des personal access tokens uniquement

### Recommandations
1. Utilisez HTTPS en production
2. Définissez `JWT_SECRET` et `SESSION_SECRET` forts
3. Limitez la durée de vie des tokens Databricks
4. Ne partagez pas votre base de données SQLite

## 🐛 Dépannage

### Build échoue
```bash
cd app
rm -rf node_modules dist
npm install
npm run build
```

### Databricks "Connection failed"
- Vérifiez que le SQL Warehouse est démarré
- Testez le token via `curl`
- Vérifiez les permissions Unity Catalog

### Electron "Module not found"
```bash
cd app
npx electron-rebuild
```

### Logs Electron
```
%APPDATA%\DBML Studio\electron-debug.log
```

## 🤝 Contribution

Les contributions sont les bienvenues !

1. Fork le projet
2. Créez une branche (`git checkout -b feature/AmazingFeature`)
3. Committez vos changes (`git commit -m 'Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrez une Pull Request

## 📝 Roadmap

### Version future (1.1)
- [ ] Chiffrement des tokens Databricks
- [ ] Support des contraintes FOREIGN KEY Databricks
- [ ] Mode "update" pour modifier les tables existantes
- [ ] Prévisualisation SQL dans l'UI
- [ ] Historique des déploiements
- [ ] Export de schémas en images (PNG, SVG)

### Version future (1.2)
- [ ] Support des vues Databricks
- [ ] Support des table properties (Delta, partitioning)
- [ ] Migration de schémas existants vers DBML
- [ ] Comparaison de schémas (diff)
- [ ] Génération de documentation automatique

## 📜 Licence

MIT License - Voir [LICENSE](LICENSE) pour plus de détails.

## 👥 Auteurs

DBML Studio Team

## 🙏 Remerciements

- [DBML](https://www.dbml.org/) - Database Markup Language
- [React Flow](https://reactflow.dev/) - Diagrammes interactifs
- [CodeMirror](https://codemirror.net/) - Éditeur de code
- [Electron](https://www.electronjs.org/) - Framework desktop
- [Databricks](https://www.databricks.com/) - Lakehouse platform

---

**Développé avec ❤️ pour simplifier la modélisation de bases de données**

Pour toute question : [Ouvrir une issue](https://github.com/yourusername/dbml-studio/issues)
