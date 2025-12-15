const initSqlJs = require('sql.js');
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

// Use DATA_DIR from environment if set (Electron), otherwise use default
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'dbml-studio.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

console.log('Database path:', DB_PATH);

// Global database instance
let db = null;
let SQL = null;

// Initialize sql.js and database
async function initDatabase() {
  if (!SQL) {
    SQL = await initSqlJs();
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    console.log('Loading existing database');
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    console.log('Creating new database');
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      provider TEXT DEFAULT 'local',
      provider_id TEXT,
      avatar_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS diagrams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      dbml_code TEXT NOT NULL,
      positions JSON,
      is_public BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS databricks_connections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      workspace_url TEXT NOT NULL,
      access_token TEXT NOT NULL,
      http_path TEXT NOT NULL,
      default_catalog TEXT,
      default_schema TEXT,
      connection_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_provider ON users(provider, provider_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_diagrams_user_id ON diagrams(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_diagrams_public ON diagrams(is_public)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_databricks_user_id ON databricks_connections(user_id)`);

  // Save initial database
  saveDatabase();

  console.log('Database initialized successfully');
}

// Save database to disk
function saveDatabase() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(DB_PATH, data);
  }
}

// Helper to execute query and return first result
function getOne(sql, params = []) {
  const results = db.exec(sql, params);
  if (results.length === 0 || results[0].values.length === 0) {
    return null;
  }
  const row = results[0].values[0];
  const columns = results[0].columns;
  const obj = {};
  columns.forEach((col, idx) => {
    obj[col] = row[idx];
  });
  return obj;
}

// Helper to execute query and return all results
function getAll(sql, params = []) {
  const results = db.exec(sql, params);
  if (results.length === 0) {
    return [];
  }
  const columns = results[0].columns;
  return results[0].values.map(row => {
    const obj = {};
    columns.forEach((col, idx) => {
      obj[col] = row[idx];
    });
    return obj;
  });
}

// Helper to execute INSERT and return last insert ID
function runInsert(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  const result = getOne('SELECT last_insert_rowid() as id');
  return result.id;
}

// Helper to execute UPDATE/DELETE and return changes
function runUpdate(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  const result = getOne('SELECT changes() as changes');
  return result.changes;
}

// User queries
const userQueries = {
  findByEmail: (email) => getOne('SELECT * FROM users WHERE email = ?', [email]),
  findById: (id) => getOne('SELECT * FROM users WHERE id = ?', [id]),
  findByProvider: (provider, providerId) => getOne('SELECT * FROM users WHERE provider = ? AND provider_id = ?', [provider, providerId]),
  create: (email, username, passwordHash, provider, providerId, avatarUrl) => {
    return runInsert(
      'INSERT INTO users (email, username, password_hash, provider, provider_id, avatar_url) VALUES (?, ?, ?, ?, ?, ?)',
      [email, username, passwordHash, provider, providerId, avatarUrl]
    );
  },
  updatePassword: (passwordHash, id) => {
    return runUpdate('UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [passwordHash, id]);
  },
  updateProfile: (username, avatarUrl, id) => {
    return runUpdate('UPDATE users SET username = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [username, avatarUrl, id]);
  }
};

// Diagram queries
const diagramQueries = {
  findById: (id) => getOne('SELECT * FROM diagrams WHERE id = ?', [id]),
  findByUserId: (userId) => getAll('SELECT id, title, description, is_public, created_at, updated_at FROM diagrams WHERE user_id = ? ORDER BY updated_at DESC', [userId]),
  findPublic: (limit) => getAll('SELECT id, title, description, created_at, updated_at FROM diagrams WHERE is_public = 1 ORDER BY updated_at DESC LIMIT ?', [limit]),
  create: (userId, title, description, dbmlCode, positions, isPublic) => {
    return runInsert(
      'INSERT INTO diagrams (user_id, title, description, dbml_code, positions, is_public) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, title, description, dbmlCode, positions, isPublic ? 1 : 0]
    );
  },
  update: (title, description, dbmlCode, positions, isPublic, id, userId) => {
    return runUpdate(
      'UPDATE diagrams SET title = ?, description = ?, dbml_code = ?, positions = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [title, description, dbmlCode, positions, isPublic ? 1 : 0, id, userId]
    );
  },
  delete: (id, userId) => {
    return runUpdate('DELETE FROM diagrams WHERE id = ? AND user_id = ?', [id, userId]);
  }
};

// Databricks connection queries
const databricksQueries = {
  findByUserId: (userId) => getOne('SELECT * FROM databricks_connections WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1', [userId]),
  findById: (id) => getOne('SELECT * FROM databricks_connections WHERE id = ?', [id]),
  create: (userId, workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName) => {
    return runInsert(
      'INSERT INTO databricks_connections (user_id, workspace_url, access_token, http_path, default_catalog, default_schema, connection_name) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userId, workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName]
    );
  },
  update: (workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName, id, userId) => {
    return runUpdate(
      'UPDATE databricks_connections SET workspace_url = ?, access_token = ?, http_path = ?, default_catalog = ?, default_schema = ?, connection_name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?',
      [workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName, id, userId]
    );
  },
  updateOrCreate: (userId, workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName) => {
    const existing = databricksQueries.findByUserId(userId);
    if (existing) {
      const changes = databricksQueries.update(workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName, existing.id, userId);
      return { id: existing.id, updated: changes > 0 };
    } else {
      const id = databricksQueries.create(userId, workspaceUrl, accessToken, httpPath, defaultCatalog, defaultSchema, connectionName);
      return { id, updated: false };
    }
  },
  delete: (id, userId) => {
    return runUpdate('DELETE FROM databricks_connections WHERE id = ? AND user_id = ?', [id, userId]);
  }
};

// Helper functions
async function createUser(email, username, password, provider = 'local', providerId = null, avatarUrl = null) {
  let passwordHash = null;
  if (password) {
    passwordHash = await bcrypt.hash(password, 10);
  }

  return userQueries.create(email, username, passwordHash, provider, providerId, avatarUrl);
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

function createDiagram(userId, title, description, dbmlCode, positions, isPublic = false) {
  const positionsJson = JSON.stringify(positions || {});
  return diagramQueries.create(userId, title, description, dbmlCode, positionsJson, isPublic);
}

function updateDiagram(diagramId, userId, title, description, dbmlCode, positions, isPublic = false) {
  const positionsJson = JSON.stringify(positions || {});
  const changes = diagramQueries.update(title, description, dbmlCode, positionsJson, isPublic, diagramId, userId);
  return changes > 0;
}

function updateDiagramElectron(diagramId, title, description, dbmlCode, positions, isPublic = false) {
  console.log('=== updateDiagramElectron DEBUG ===');
  console.log('Diagram ID:', diagramId);
  console.log('Title:', title);
  console.log('isPublic:', isPublic);

  const positionsJson = JSON.stringify(positions || {});
  // Update without user ownership check for Electron (single-user mode)
  const changes = runUpdate(
    'UPDATE diagrams SET title = ?, description = ?, dbml_code = ?, positions = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, description, dbmlCode, positionsJson, isPublic ? 1 : 0, diagramId]
  );

  console.log('Changes made:', changes);
  return changes > 0;
}

function getDiagram(diagramId) {
  const diagram = diagramQueries.findById(diagramId);
  if (diagram && diagram.positions) {
    try {
      diagram.positions = JSON.parse(diagram.positions);
    } catch (e) {
      diagram.positions = {};
    }
  }
  return diagram;
}

function getUserDiagrams(userId) {
  return diagramQueries.findByUserId(userId);
}

function getPublicDiagrams(limit = 50) {
  return diagramQueries.findPublic(limit);
}

function deleteDiagram(diagramId, userId) {
  const changes = diagramQueries.delete(diagramId, userId);
  return changes > 0;
}

function deleteDiagramElectron(diagramId) {
  // Delete without user ownership check for Electron (single-user mode)
  const changes = runUpdate('DELETE FROM diagrams WHERE id = ?', [diagramId]);
  return changes > 0;
}

function getDatabricksConnection(userId) {
  return databricksQueries.findByUserId(userId);
}

module.exports = {
  initDatabase,
  userQueries,
  diagramQueries,
  databricksQueries,
  createUser,
  verifyPassword,
  createDiagram,
  updateDiagram,
  updateDiagramElectron,
  getDiagram,
  getUserDiagrams,
  getPublicDiagrams,
  deleteDiagram,
  deleteDiagramElectron,
  getDatabricksConnection,
};
