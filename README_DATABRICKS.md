# Intégration Azure Databricks - Guide d'utilisation

Ce guide explique comment utiliser l'intégration Azure Databricks dans DBML Studio pour déployer vos schémas de base de données directement vers Databricks.

## Table des matières

- [Aperçu](#aperçu)
- [Configuration](#configuration)
- [Déploiement de tables](#déploiement-de-tables)
- [Types de données supportés](#types-de-données-supportés)
- [Exemples](#exemples)
- [Dépannage](#dépannage)

## Aperçu

L'intégration Databricks vous permet de :

✅ Convertir automatiquement vos diagrammes DBML en SQL DDL Databricks
✅ Déployer des tables vers Azure Databricks SQL Warehouse
✅ Gérer plusieurs catalogues et schémas Unity Catalog
✅ Vérifier l'existence des tables avant création
✅ Voir les résultats détaillés du déploiement

## Configuration

### 1. Obtenir les credentials Databricks

Vous aurez besoin de :

#### a) Workspace URL
- Format : `https://xxx.cloud.databricks.com`
- Trouvez-le dans l'URL de votre workspace Databricks

#### b) Personal Access Token
1. Dans Databricks, cliquez sur votre profil (en haut à droite)
2. **User Settings** → **Developer** → **Access tokens**
3. Cliquez sur **Generate new token**
4. Donnez un nom (ex: "DBML Studio")
5. Définissez une durée de vie (ou laissez vide pour illimité)
6. Cliquez sur **Generate**
7. **COPIEZ** le token immédiatement (il ne sera plus affiché)

#### c) HTTP Path du SQL Warehouse
1. Dans Databricks, allez dans **SQL Warehouses**
2. Sélectionnez votre warehouse (ou créez-en un)
3. Cliquez sur **Connection details**
4. Copiez le **HTTP path**
   - Format : `/sql/1.0/warehouses/xxxxxxxxxxxxx`

### 2. Configurer la connexion dans DBML Studio

#### Application Web
1. Connectez-vous à DBML Studio
2. Cliquez sur **"Databricks Settings"** dans le header
3. Remplissez le formulaire :
   - **Connection Name** : Nom descriptif (ex: "Prod Workspace")
   - **Workspace URL** : Votre URL Databricks
   - **Access Token** : Le token généré
   - **HTTP Path** : Le path du SQL Warehouse
   - **Default Catalog** (optionnel) : Catalogue par défaut
   - **Default Schema** (optionnel) : Schéma par défaut
4. Cliquez sur **"Test Connection"** pour vérifier
5. Cliquez sur **"Save Connection"**

#### Application Windows (Electron)
Même procédure que ci-dessus.

### 3. Tester la connexion

Si le test réussit, vous verrez :
```
✓ Connection successful!
```

Si le test échoue, vérifiez :
- L'URL du workspace est correcte (avec https://)
- Le token est valide et n'a pas expiré
- Le HTTP path est correct
- Le SQL Warehouse est démarré
- Vous avez les permissions nécessaires

## Déploiement de tables

### Étape 1 : Préparer votre DBML

Créez ou chargez votre schéma DBML. Exemple :

```dbml
Table users {
  id integer [pk, increment]
  username varchar(50) [not null, unique]
  email varchar(100) [not null, unique]
  created_at timestamp [default: `now()`]

  Note: 'Table des utilisateurs'
}

Table posts {
  id integer [pk, increment]
  user_id integer [not null, ref: > users.id]
  title varchar(200) [not null]
  content text
  published boolean [default: false]
  created_at timestamp [default: `now()`]

  Note: 'Articles de blog'
}
```

### Étape 2 : Ouvrir le dialog de déploiement

1. Assurez-vous d'avoir du code DBML dans l'éditeur
2. Cliquez sur **"Deploy to Databricks"** (bouton rouge)

### Étape 3 : Sélectionner la cible

1. **Catalog** : Sélectionnez le catalogue cible
   - Ex: `main`, `dev`, `prod`
2. **Schema** : Sélectionnez le schéma cible
   - Ex: `default`, `bronze`, `silver`, `gold`

### Étape 4 : Sélectionner les tables

1. Cochez les tables que vous voulez déployer
2. Utilisez **"Select All"** pour tout sélectionner
3. Décochez les tables que vous ne voulez pas créer

### Étape 5 : Déployer

1. Cliquez sur **"Deploy X Tables"**
2. Attendez la fin du déploiement
3. Consultez les résultats :
   - **Created** : Tables créées avec succès ✅
   - **Skipped** : Tables déjà existantes ⚠️
   - **Failed** : Erreurs lors de la création ❌

### Résultat du déploiement

Exemple de résultat :

```
Deployment Results

Total: 2
Created: 2
Skipped: 0
Failed: 0

✓ users: Table created successfully
✓ posts: Table created successfully
```

## Types de données supportés

Le convertisseur DBML → Databricks mappe automatiquement les types :

| DBML Type | Databricks Type |
|-----------|----------------|
| `int`, `integer` | `INT` |
| `smallint` | `SMALLINT` |
| `bigint` | `BIGINT` |
| `tinyint` | `TINYINT` |
| `decimal`, `numeric` | `DECIMAL` |
| `float`, `real` | `FLOAT` |
| `double` | `DOUBLE` |
| `varchar`, `char`, `text`, `string` | `STRING` |
| `date` | `DATE` |
| `datetime`, `timestamp` | `TIMESTAMP` |
| `boolean`, `bool` | `BOOLEAN` |
| `binary`, `blob` | `BINARY` |
| `json`, `jsonb` | `STRING` |
| `uuid` | `STRING` |

**Note** : Databricks ne supporte pas nativement le type `TIME`, il est converti en `STRING`.

## Exemples

### Exemple 1 : Table simple

**DBML :**
```dbml
Table products {
  id int [pk]
  name varchar(100) [not null]
  price decimal(10,2)

  Note: 'Product catalog'
}
```

**SQL généré :**
```sql
CREATE TABLE IF NOT EXISTS main.default.products (
  id INT NOT NULL,
  name STRING NOT NULL,
  price DECIMAL,
  PRIMARY KEY (id)
)
COMMENT 'Product catalog';
```

### Exemple 2 : Table avec commentaires sur colonnes

**DBML :**
```dbml
Table employees {
  employee_id bigint [pk, note: 'Unique employee identifier']
  first_name varchar(50) [not null, note: 'Employee first name']
  last_name varchar(50) [not null, note: 'Employee last name']
  hire_date date [note: 'Date of hire']
}
```

**SQL généré :**
```sql
CREATE TABLE IF NOT EXISTS main.default.employees (
  employee_id BIGINT NOT NULL COMMENT 'Unique employee identifier',
  first_name STRING NOT NULL COMMENT 'Employee first name',
  last_name STRING NOT NULL COMMENT 'Employee last name',
  hire_date DATE COMMENT 'Date of hire',
  PRIMARY KEY (employee_id)
);
```

### Exemple 3 : Déploiement vers différents environnements

**Développement :**
- Catalog : `dev`
- Schema : `bronze`
- Tables : Toutes

**Production :**
- Catalog : `prod`
- Schema : `gold`
- Tables : Sélection manuelle

## Fonctionnalités avancées

### Vérification d'existence

Le système vérifie automatiquement si une table existe avant de la créer :

- ✅ **Table n'existe pas** → Création
- ⚠️ **Table existe déjà** → Ignorée (pas de modification)

### Prévisualisation SQL

Pour voir le SQL généré sans déployer, utilisez l'API :

```javascript
POST /api/databricks/convert
{
  "dbml_code": "Table users { ... }"
}
```

Réponse :
```json
{
  "success": true,
  "tables": [
    {
      "tableName": "users",
      "ddl": "CREATE TABLE IF NOT EXISTS users (...)"
    }
  ]
}
```

## Dépannage

### Erreur : "No Databricks connection configured"

**Cause** : Aucune connexion Databricks n'est configurée.
**Solution** : Allez dans "Databricks Settings" et configurez votre connexion.

### Erreur : "Connection test failed"

**Causes possibles** :
1. Token invalide ou expiré
2. HTTP path incorrect
3. SQL Warehouse arrêté
4. Permissions insuffisantes

**Solution** :
1. Vérifiez que le token est valide
2. Redémarrez le SQL Warehouse dans Databricks
3. Vérifiez les permissions sur le workspace

### Erreur : "Failed to list catalogs"

**Cause** : Permissions insuffisantes sur Unity Catalog.
**Solution** : Assurez-vous d'avoir les permissions `USE CATALOG` sur les catalogues.

### Table marquée comme "Failed"

**Causes possibles** :
1. Permissions insuffisantes sur le schéma
2. Type de données non supporté
3. Nom de table réservé

**Solution** :
1. Vérifiez les permissions `CREATE TABLE` sur le schéma
2. Consultez les logs d'erreur détaillés
3. Renommez la table si nécessaire

### Les relations (foreign keys) ne sont pas créées

**Note** : Actuellement, seules les PRIMARY KEY sont créées.
Les FOREIGN KEY Databricks nécessitent des contraintes supplémentaires.
**Solution future** : Une prochaine version ajoutera le support des FK.

## Sécurité

### Stockage des credentials

Les credentials Databricks sont stockés dans la base de données SQLite locale :

- **Application Web** : Dans `app/data/dbml-studio.db`
- **Application Windows** : Dans `%APPDATA%\DBML Studio\data\`

**⚠️ Important** :
- Les tokens sont stockés en clair pour le moment
- Ne partagez pas votre base de données
- Utilisez des tokens avec durée de vie limitée
- Révoquezles tokens inutilisés

### Recommandations

1. **Utilisez des tokens dédiés** :
   - Créez un token spécifique pour DBML Studio
   - Donnez-lui un nom identifiable
   - Définissez une durée de vie (ex: 90 jours)

2. **Limitez les permissions** :
   - Utilisez un service principal si possible
   - Donnez uniquement les permissions nécessaires
   - `USE CATALOG`, `USE SCHEMA`, `CREATE TABLE`

3. **Rotation des tokens** :
   - Renouvelez les tokens régulièrement
   - Supprimez les anciens tokens de Databricks

## API Reference

Pour les développeurs qui veulent intégrer :

### Endpoints disponibles

```
POST   /api/databricks/connection       # Sauvegarder connexion
GET    /api/databricks/connection       # Récupérer connexion
DELETE /api/databricks/connection       # Supprimer connexion
POST   /api/databricks/test            # Tester connexion
GET    /api/databricks/catalogs        # Lister catalogues
GET    /api/databricks/schemas/:catalog # Lister schémas
POST   /api/databricks/deploy          # Déployer tables
POST   /api/databricks/convert         # Convertir DBML en SQL
```

Tous les endpoints nécessitent une authentification JWT.

## Améliorations futures

Fonctionnalités prévues :

- [ ] Chiffrement des tokens d'accès
- [ ] Support des contraintes FOREIGN KEY
- [ ] Mode "update" pour modifier les tables existantes
- [ ] Prévisualisation SQL dans l'UI
- [ ] Historique des déploiements
- [ ] Support des vues Databricks
- [ ] Support des table properties (Delta, partitioning)
- [ ] Export des logs de déploiement

## Support

Pour toute question ou bug :

1. Consultez la documentation Databricks : [docs.databricks.com](https://docs.databricks.com/)
2. Vérifiez les logs : Menu **File** → **View Logs** (Electron)
3. Ouvrez un ticket GitHub avec :
   - Description du problème
   - DBML utilisé (sans données sensibles)
   - Message d'erreur complet
   - Version de DBML Studio

---

**Bon déploiement ! 🚀**
