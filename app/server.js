require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const session = require('express-session');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');
const database = require('./database');
const { generateToken, authenticateJWT, optionalAuth, passport } = require('./auth');
const DatabricksClient = require('./databricksClient');
const { convertDBMLToDatabricksSQL, getTableDDL } = require('./dbmlToDatabricksSQL');

const app = express();
const PORT = process.env.PORT || 3000;
// Use DATA_DIR from environment if set (Electron), otherwise use default
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
// Check if running in development mode (set by npm run dev)
const isDevelopment = process.env.DEV_MODE === 'true';

console.log('Server starting with DATA_DIR:', DATA_DIR);

async function startServer() {
  // Initialize database
  await database.initDatabase();
  console.log('Database initialized, setting up server...');

// Middleware - compression MUST be first!
app.use(compression({
  filter: (req, res) => {
    // Compress everything except already compressed formats
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  threshold: 0 // Compress all responses
}));
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Request logging for debugging
app.use((req, res, next) => {
  if (req.path.startsWith('/api/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// In development, proxy to Vite dev server for static assets
// In production, serve from dist folder
if (isDevelopment) {
  console.log('Development mode: Proxying to Vite on port 5173');
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
}

// Ensure data directory exists
(async () => {
  try {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error('Error creating data directory:', err);
  }
})();

// ==================== Authentication Routes ====================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, username, password } = req.body;

    // Validation
    if (!email || !username || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = database.userQueries.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Create user
    const userId = await database.createUser(email, username, password);
    const user = database.userQueries.findById(userId);

    // Generate token
    const token = generateToken(user);

    // Set session
    req.session.userId = user.id;

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = database.userQueries.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Please use social login' });
    }

    const isValid = await database.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate token
    const token = generateToken(user);

    // Set session
    req.session.userId = user.id;

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Auto-login for Electron (creates/returns default local user)
app.post('/api/auth/electron-auto-login', async (req, res) => {
  try {
    const defaultEmail = 'local@dbml-studio.app';
    const defaultUsername = 'Local User';

    // Check if default user exists
    let user = database.userQueries.findByEmail(defaultEmail);

    if (!user) {
      // Create default user (no password needed)
      console.log('Creating default local user for Electron');
      const userId = await database.createUser(defaultEmail, defaultUsername, null, 'local', 'electron', null);
      user = database.userQueries.findById(userId);
    }

    // Generate token
    const token = generateToken(user);

    // Set session
    req.session.userId = user.id;

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword
    });
  } catch (error) {
    console.error('Electron auto-login error:', error);
    res.status(500).json({ error: 'Auto-login failed' });
  }
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ success: true });
  });
});

// Get current user
app.get('/api/auth/me', authenticateJWT, (req, res) => {
  const { password_hash, ...userWithoutPassword } = req.user;
  res.json({ user: userWithoutPassword });
});

// Test route to verify API is working
app.get('/api/test', (req, res) => {
  console.log('TEST ROUTE HIT!');
  res.json({ message: 'API is working!' });
});

// Google OAuth
app.get('/api/auth/google', (req, res, next) => {
  console.log('GOOGLE AUTH ROUTE HIT!');
  next();
}, passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/?auth=failed' }),
  (req, res) => {
    const token = generateToken(req.user);
    req.session.userId = req.user.id;
    res.redirect(`/?auth=success&token=${token}`);
  }
);

// GitHub OAuth
app.get('/api/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

app.get('/api/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/?auth=failed' }),
  (req, res) => {
    const token = generateToken(req.user);
    req.session.userId = req.user.id;
    res.redirect(`/?auth=success&token=${token}`);
  }
);

// ==================== Diagram Routes ====================

// Create new diagram
app.post('/api/diagrams', authenticateJWT, async (req, res) => {
  try {
    const { title, description, dbml_code, positions, is_public } = req.body;

    if (!title || !dbml_code) {
      return res.status(400).json({ error: 'Title and DBML code are required' });
    }

    const diagramId = database.createDiagram(
      req.user.id,
      title,
      description || '',
      dbml_code,
      positions,
      is_public || false
    );

    const diagram = database.getDiagram(diagramId);
    res.json({ success: true, diagram });
  } catch (error) {
    console.error('Error creating diagram:', error);
    res.status(500).json({ error: 'Failed to create diagram' });
  }
});

// Get user's diagrams
app.get('/api/diagrams', authenticateJWT, (req, res) => {
  try {
    const diagrams = database.getUserDiagrams(req.user.id);
    res.json({ diagrams });
  } catch (error) {
    console.error('Error fetching diagrams:', error);
    res.status(500).json({ error: 'Failed to fetch diagrams' });
  }
});

// Get single diagram
app.get('/api/diagrams/:id', optionalAuth, (req, res) => {
  try {
    const diagram = database.getDiagram(req.params.id);

    if (!diagram) {
      return res.status(404).json({ error: 'Diagram not found' });
    }

    // Check permissions
    if (!diagram.is_public && (!req.user || diagram.user_id !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ diagram });
  } catch (error) {
    console.error('Error fetching diagram:', error);
    res.status(500).json({ error: 'Failed to fetch diagram' });
  }
});

// Update diagram
app.put('/api/diagrams/:id', authenticateJWT, async (req, res) => {
  try {
    const { title, description, dbml_code, positions, is_public } = req.body;

    if (!title || !dbml_code) {
      return res.status(400).json({ error: 'Title and DBML code are required' });
    }

    // In Electron mode, allow updating any diagram (single-user local app)
    const isElectron = process.env.ELECTRON === 'true' || process.versions.electron;

    console.log('=== UPDATE DIAGRAM DEBUG ===');
    console.log('Diagram ID:', req.params.id);
    console.log('User ID:', req.user.id);
    console.log('process.env.ELECTRON:', process.env.ELECTRON);
    console.log('process.versions.electron:', process.versions.electron);
    console.log('isElectron:', isElectron);

    let success;
    if (isElectron) {
      console.log('Using Electron mode (no ownership check)');
      // Update without user ownership check
      success = database.updateDiagramElectron(
        req.params.id,
        title,
        description || '',
        dbml_code,
        positions,
        is_public || false
      );
    } else {
      console.log('Using web mode (with ownership check)');
      // Normal multi-user mode: check ownership
      success = database.updateDiagram(
        req.params.id,
        req.user.id,
        title,
        description || '',
        dbml_code,
        positions,
        is_public || false
      );
    }

    console.log('Update success:', success);

    if (!success) {
      console.error('Update failed - diagram not found or no changes made');
      return res.status(404).json({ error: 'Diagram not found or access denied' });
    }

    const diagram = database.getDiagram(req.params.id);
    res.json({ success: true, diagram });
  } catch (error) {
    console.error('Error updating diagram:', error);
    res.status(500).json({ error: 'Failed to update diagram' });
  }
});

// Delete diagram
app.delete('/api/diagrams/:id', authenticateJWT, (req, res) => {
  try {
    // In Electron mode, allow deleting any diagram (single-user local app)
    const isElectron = process.env.ELECTRON === 'true' || process.versions.electron;

    let success;
    if (isElectron) {
      // Delete without user ownership check
      success = database.deleteDiagramElectron(req.params.id);
    } else {
      // Normal multi-user mode: check ownership
      success = database.deleteDiagram(req.params.id, req.user.id);
    }

    if (!success) {
      return res.status(404).json({ error: 'Diagram not found or access denied' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting diagram:', error);
    res.status(500).json({ error: 'Failed to delete diagram' });
  }
});

// Get public diagrams
app.get('/api/public/diagrams', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const diagrams = database.getPublicDiagrams(limit);
    res.json({ diagrams });
  } catch (error) {
    console.error('Error fetching public diagrams:', error);
    res.status(500).json({ error: 'Failed to fetch public diagrams' });
  }
});

// ==================== Databricks Routes ====================

// Save Databricks connection
app.post('/api/databricks/connection', authenticateJWT, async (req, res) => {
  try {
    const { workspace_url, access_token, http_path, default_catalog, default_schema, connection_name } = req.body;

    // Validation
    if (!workspace_url || !access_token || !http_path) {
      return res.status(400).json({ error: 'Workspace URL, access token, and HTTP path are required' });
    }

    // Save or update connection
    const result = database.databricksQueries.updateOrCreate(
      req.user.id,
      workspace_url,
      access_token,
      http_path,
      default_catalog || null,
      default_schema || null,
      connection_name || 'Default Connection'
    );

    res.json({
      success: true,
      connection_id: result.id,
      updated: result.updated
    });
  } catch (error) {
    console.error('Error saving Databricks connection:', error);
    res.status(500).json({ error: 'Failed to save connection' });
  }
});

// Get Databricks connection
app.get('/api/databricks/connection', authenticateJWT, (req, res) => {
  try {
    const connection = database.databricksQueries.findByUserId(req.user.id);

    if (!connection) {
      return res.status(404).json({ error: 'No Databricks connection found' });
    }

    // Don't send the full access token to the client (security)
    const safeConnection = {
      id: connection.id,
      workspace_url: connection.workspace_url,
      http_path: connection.http_path,
      default_catalog: connection.default_catalog,
      default_schema: connection.default_schema,
      connection_name: connection.connection_name,
      access_token_preview: connection.access_token ? `${connection.access_token.substring(0, 10)}...` : null,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
    };

    res.json({ connection: safeConnection });
  } catch (error) {
    console.error('Error fetching Databricks connection:', error);
    res.status(500).json({ error: 'Failed to fetch connection' });
  }
});

// Delete Databricks connection
app.delete('/api/databricks/connection', authenticateJWT, (req, res) => {
  try {
    const connection = database.databricksQueries.findByUserId(req.user.id);

    if (!connection) {
      return res.status(404).json({ error: 'No connection found' });
    }

    const success = database.databricksQueries.delete(connection.id, req.user.id);

    if (!success) {
      return res.status(500).json({ error: 'Failed to delete connection' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting Databricks connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
});

// Test Databricks connection
app.post('/api/databricks/test', authenticateJWT, async (req, res) => {
  try {
    const { workspace_url, access_token, http_path } = req.body;

    if (!workspace_url || !access_token || !http_path) {
      return res.status(400).json({ error: 'Missing required connection parameters' });
    }

    const client = new DatabricksClient(workspace_url, access_token, http_path);
    const isConnected = await client.testConnection();

    res.json({
      success: true,
      connected: isConnected,
      message: 'Connection successful'
    });
  } catch (error) {
    console.error('Databricks connection test failed:', error);
    res.status(500).json({
      success: false,
      connected: false,
      error: error.message || 'Connection test failed'
    });
  }
});

// List catalogs
app.get('/api/databricks/catalogs', authenticateJWT, async (req, res) => {
  try {
    const connection = database.databricksQueries.findByUserId(req.user.id);

    if (!connection) {
      return res.status(404).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    const catalogs = await client.listCatalogs();

    res.json({
      success: true,
      catalogs
    });
  } catch (error) {
    console.error('Error listing catalogs:', error);
    res.status(500).json({ error: error.message || 'Failed to list catalogs' });
  }
});

// List schemas in a catalog
app.get('/api/databricks/schemas/:catalog', authenticateJWT, async (req, res) => {
  try {
    const { catalog } = req.params;
    const connection = database.databricksQueries.findByUserId(req.user.id);

    if (!connection) {
      return res.status(404).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    const schemas = await client.listSchemas(catalog);

    res.json({
      success: true,
      schemas
    });
  } catch (error) {
    console.error('Error listing schemas:', error);
    res.status(500).json({ error: error.message || 'Failed to list schemas' });
  }
});

// List tables in a schema
app.get('/api/databricks/tables/:catalog/:schema', authenticateJWT, async (req, res) => {
  try {
    const { catalog, schema } = req.params;
    console.log(`Listing tables for ${catalog}.${schema}`);

    const connection = database.databricksQueries.findByUserId(req.user.id);

    if (!connection) {
      return res.status(404).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    const tables = await client.listTables(catalog, schema);
    console.log(`Found ${tables.length} tables:`, tables);

    res.json({
      success: true,
      tables
    });
  } catch (error) {
    console.error('Error listing tables:', error);
    res.status(500).json({ error: error.message || 'Failed to list tables' });
  }
});

// Deploy tables to Databricks
app.post('/api/databricks/deploy', authenticateJWT, async (req, res) => {
  try {
    const { dbml_code, tables, table_mappings, catalog, schema } = req.body;

    // Support both old format (tables array) and new format (table_mappings object)
    let mappings = {};
    if (table_mappings && typeof table_mappings === 'object') {
      // New format: { "source": "destination" }
      mappings = table_mappings;
    } else if (tables && Array.isArray(tables)) {
      // Old format: ["table1", "table2"] - convert to mapping
      tables.forEach(tableName => {
        mappings[tableName] = tableName;
      });
    }

    // Validation
    if (!dbml_code || Object.keys(mappings).length === 0) {
      return res.status(400).json({ error: 'DBML code and table list/mappings are required' });
    }

    if (!catalog || !schema) {
      return res.status(400).json({ error: 'Catalog and schema are required' });
    }

    const connection = database.databricksQueries.findByUserId(req.user.id);

    if (!connection) {
      return res.status(404).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    // Generate DDL for selected tables
    const results = [];
    const errors = [];

    for (const [sourceTableName, destTableName] of Object.entries(mappings)) {
      try {
        // Generate DDL from source table name
        const ddl = getTableDDL(dbml_code, sourceTableName, { includeIfNotExists: true, includeComments: true });

        if (!ddl) {
          errors.push({
            table: sourceTableName,
            error: 'Table not found in DBML'
          });
          continue;
        }

        // Check if destination table already exists
        const exists = await client.tableExists(catalog, schema, destTableName);

        if (exists) {
          results.push({
            table: sourceTableName === destTableName ? destTableName : `${sourceTableName} → ${destTableName}`,
            status: 'skipped',
            message: 'Table already exists'
          });
          continue;
        }

        // Replace table name in DDL with destination name if they differ
        let finalDDL = ddl;
        if (sourceTableName !== destTableName) {
          finalDDL = ddl.replace(
            new RegExp(`CREATE TABLE IF NOT EXISTS ${sourceTableName}\\b`, 'gi'),
            `CREATE TABLE IF NOT EXISTS ${destTableName}`
          );
        }

        // Create table with destination name
        await client.createTable(catalog, schema, destTableName, finalDDL);

        results.push({
          table: sourceTableName === destTableName ? destTableName : `${sourceTableName} → ${destTableName}`,
          status: 'created',
          message: 'Table created successfully'
        });
      } catch (error) {
        console.error(`Error deploying table ${sourceTableName}:`, error);
        errors.push({
          table: sourceTableName,
          error: error.message || 'Failed to create table'
        });
      }
    }

    res.json({
      success: errors.length === 0,
      results,
      errors,
      summary: {
        total: Object.keys(mappings).length,
        created: results.filter(r => r.status === 'created').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Error deploying to Databricks:', error);
    res.status(500).json({ error: error.message || 'Deployment failed' });
  }
});

// Convert DBML to SQL (preview)
app.post('/api/databricks/convert', authenticateJWT, async (req, res) => {
  try {
    const { dbml_code } = req.body;

    if (!dbml_code) {
      return res.status(400).json({ error: 'DBML code is required' });
    }

    const result = convertDBMLToDatabricksSQL(dbml_code, {
      includeIfNotExists: true,
      includeComments: true
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.json(result);
  } catch (error) {
    console.error('Error converting DBML:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
});

// List workspace directory contents
app.get('/api/databricks/workspace/list', authenticateJWT, async (req, res) => {
  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const connection = database.getDatabricksConnection(req.user.id);
    if (!connection) {
      return res.status(400).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    const objects = await client.listWorkspace(path);
    res.json({ objects });
  } catch (error) {
    console.error('Error listing workspace:', error);
    res.status(500).json({ error: error.message || 'Failed to list workspace' });
  }
});

// Upload DBML file to workspace
app.post('/api/databricks/workspace/upload', authenticateJWT, async (req, res) => {
  try {
    const { path, content, overwrite } = req.body;

    if (!path || !content) {
      return res.status(400).json({ error: 'Path and content are required' });
    }

    const connection = database.getDatabricksConnection(req.user.id);
    if (!connection) {
      return res.status(400).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    const result = await client.uploadToWorkspace(path, content, overwrite !== false);
    res.json(result);
  } catch (error) {
    console.error('Error uploading to workspace:', error);
    res.status(500).json({ error: error.message || 'Failed to upload file' });
  }
});

// Download DBML file from workspace
app.get('/api/databricks/workspace/download', authenticateJWT, async (req, res) => {
  try {
    const { path } = req.query;

    if (!path) {
      return res.status(400).json({ error: 'Path is required' });
    }

    const connection = database.getDatabricksConnection(req.user.id);
    if (!connection) {
      return res.status(400).json({ error: 'No Databricks connection configured' });
    }

    const client = new DatabricksClient(
      connection.workspace_url,
      connection.access_token,
      connection.http_path
    );

    const content = await client.downloadFromWorkspace(path);
    res.json({ content, path });
  } catch (error) {
    console.error('Error downloading from workspace:', error);
    res.status(500).json({ error: error.message || 'Failed to download file' });
  }
});

// ==================== Legacy Routes (for backward compatibility) ====================

// Save table positions (legacy)
app.post('/api/positions/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const positions = req.body;

    const filePath = path.join(DATA_DIR, `${projectId}-positions.json`);
    await fsPromises.writeFile(filePath, JSON.stringify(positions, null, 2));

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving positions:', error);
    res.status(500).json({ error: 'Failed to save positions' });
  }
});

// Load table positions (legacy)
app.get('/api/positions/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const filePath = path.join(DATA_DIR, `${projectId}-positions.json`);

    try {
      const data = await fsPromises.readFile(filePath, 'utf8');
      res.json(JSON.parse(data));
    } catch (err) {
      // File doesn't exist yet, return empty object
      res.json({});
    }
  } catch (error) {
    console.error('Error loading positions:', error);
    res.status(500).json({ error: 'Failed to load positions' });
  }
});

// Serve React app for all other routes
if (isDevelopment) {
  // Create proxy instance once (not on every request!)
  const viteProxy = createProxyMiddleware({
    target: 'http://localhost:5173',
    changeOrigin: true,
    ws: true,
  });

  // In development, manually proxy non-API requests to Vite
  app.use((req, res, next) => {
    // Skip API routes - let Express handle them
    if (req.path.startsWith('/api')) {
      console.log(`Skipping proxy for API route: ${req.path}`);
      return next();
    }

    // Proxy everything else to Vite
    console.log(`Proxying to Vite: ${req.path}`);
    viteProxy(req, res, next);
  });
} else {
  // In production, serve built files
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

  // Bind to localhost for Electron (avoids Windows firewall warning)
  // Bind to 0.0.0.0 for Docker (allows Traefik to connect)
  const isElectron = process.env.ELECTRON === 'true' || process.versions.electron;
  const host = isElectron ? 'localhost' : '0.0.0.0';

  app.listen(PORT, host, () => {
    console.log(`DBML Studio server running on http://${host}:${PORT}`);
    if (isElectron) {
      console.log('Running in Electron mode (localhost only - no firewall needed)');
    }
    if (isDevelopment) {
      console.log(`Proxying frontend requests to Vite dev server on port 5173`);
    }
  });
}

// Start the server
startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
