# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DBML Studio is an interactive web-based DBML (Database Markup Language) viewer with draggable tables, automatic position persistence, and user authentication. It allows users to visualize database schemas, save diagrams, and share them publicly.

## Commands

### Development Workflow (Recommended)

This project uses a **volume-mounted workflow** for fast iterations:

```bash
# Initial setup (one time)
cd app
npm install
cd ..

# Build the Docker image (only when package.json changes)
docker-compose up -d --build

# Fast development iteration
cd app
# (edit your code in src/)
npm run build          # Rebuilds frontend (10-15 seconds)
# Changes are live immediately!

# View logs
docker-compose logs -f dbml-studio

# Stop container
docker-compose down
```

**How it works:**
- Your `./app` folder is mounted into the container
- Container's `node_modules` (Linux-compiled) is preserved via anonymous volume
- You build on your host with `npm run build`
- Changes apply instantly via the volume mount
- No Docker rebuild needed for code changes!

### Alternative: Fully Containerized Build

If you prefer building inside Docker:

```bash
# Use the simple Dockerfile that builds everything
docker-compose -f docker-compose.simple.yml up -d --build
```

See `WORKFLOW.md` for detailed workflow documentation.

## Architecture

### Tech Stack
- **Frontend**: React 18 + Vite
- **UI Components**:
  - React Flow (diagram visualization with drag-and-drop)
  - CodeMirror (DBML editor with syntax highlighting)
- **DBML Parser**: @dbml/core
- **Backend**: Node.js + Express
- **Database**: better-sqlite3 (SQLite)
- **Authentication**:
  - JWT tokens
  - Passport.js (local, Google OAuth, GitHub OAuth)
  - Express sessions
- **State Management**: Zustand
- **Layout Engine**: Dagre (auto-layout for database diagrams)

### Directory Structure
```
app/
├── server.js              # Express server with API routes
├── database.js            # SQLite database layer
├── auth.js               # Authentication logic (JWT, Passport)
├── vite.config.js        # Vite configuration
├── data/                 # SQLite database and legacy position files
└── src/
    ├── App.jsx           # Main application component
    ├── stores/
    │   └── authStore.js  # Zustand store for authentication state
    ├── utils/
    │   ├── dbmlParser.js      # DBML parsing and node/edge generation
    │   ├── positionStorage.js # Position persistence (localStorage + API)
    │   ├── historyStore.js    # Undo/redo functionality
    │   └── api.js             # API client utilities
    └── components/
        ├── DBMLEditor.jsx     # CodeMirror-based DBML editor
        ├── DBMLViewer.jsx     # React Flow diagram viewer
        ├── TableNode.jsx      # Custom React Flow table node
        ├── GroupNode.jsx      # Custom React Flow group node
        ├── AuthModal.jsx      # Authentication modal
        ├── Library.jsx        # User's saved diagrams
        ├── SaveDiagramDialog.jsx
        └── UserMenu.jsx
```

### Key Architectural Patterns

#### DBML Parsing Flow
1. **Input**: DBML code entered in `DBMLEditor` component
2. **Parsing**: `parseDBML()` in `utils/dbmlParser.js` uses @dbml/core Parser
3. **Node Generation**: Creates React Flow nodes for:
   - Tables (type: 'table') - using `TableNode` component
   - Groups (type: 'group') - using `GroupNode` component
4. **Edge Generation**: Converts DBML relationships to React Flow edges
5. **Layout**: Dagre algorithm for auto-layout (configurable direction: TB/LR)
6. **Rendering**: `DBMLViewer` renders using React Flow

#### Position Persistence (Dual Strategy)
- **localStorage**: Immediate local storage for quick recovery
- **Backend API**: Persistent storage when authenticated
- **Legacy API**: `/api/positions/:projectId` for backward compatibility
- **New API**: `/api/diagrams` for saved diagrams with metadata

#### Server Binding (Conditional by Environment)

**IMPORTANT: The Express server uses conditional binding to support both Docker and Electron deployments.**

The server binding is automatically determined at runtime in `server.js:439`:

```javascript
const isElectron = process.env.ELECTRON === 'true' || process.versions.electron;
const host = isElectron ? 'localhost' : '0.0.0.0';
app.listen(PORT, host, () => { ... });
```

**Electron Mode (Windows/Desktop App):**
- Binds to `localhost` (127.0.0.1)
- Prevents Windows Firewall warnings when running as desktop app
- Only accepts connections from the local machine
- `electron.js` sets `process.env.ELECTRON = 'true'` before requiring `server.js`

**Docker Mode (Web Deployment):**
- Binds to `0.0.0.0` (all network interfaces)
- Allows Traefik reverse proxy to connect from Docker network
- Required for container-to-container communication
- Automatically detected when `process.env.ELECTRON` is not set

**Why this matters:**
- DO NOT change the binding logic without understanding both deployment modes
- Binding to `localhost` in Docker breaks Traefik connectivity (Bad Gateway errors)
- Binding to `0.0.0.0` in Electron triggers Windows Firewall prompts
- The conditional binding solves both requirements automatically

#### Authentication Architecture

**CRITICAL: This is a hybrid authentication system using BOTH JWT tokens AND Express sessions. Understanding both mechanisms is essential.**

##### Overview
- **Multi-provider**: Local (email/password), Google OAuth, GitHub OAuth
- **Dual Authentication**: JWT tokens (primary) + Express sessions (fallback for OAuth)
- **Middleware**:
  - `authenticateJWT`: Requires authentication, tries JWT Bearer token first, then session as fallback
  - `optionalAuth`: Allows anonymous access but attaches user if authenticated

##### Authentication Flow Details

**1. Local Authentication (Email/Password)**
```
Client → POST /api/auth/login → Server validates → Returns JWT + sets session → Client stores JWT
```
- Client sends `{ email, password }` to `/api/auth/login`
- Server validates credentials with bcrypt
- Server generates JWT with 7-day expiration
- Server returns `{ token, user }` AND sets session cookie
- Client stores JWT in `localStorage` as `auth-token`
- Subsequent requests include JWT as `Authorization: Bearer {token}` header

**2. OAuth Authentication (Google/GitHub) - COMPLETE FLOW**
```
Client → Redirect to /api/auth/google → Google auth → Callback to /api/auth/google/callback →
Server generates JWT + sets session → Redirect to /?auth=success&token={jwt} →
Client extracts token from URL → Stores in localStorage → Cleans URL → Calls /api/auth/me
```

Step-by-step:
1. User clicks "Continue with Google" button
2. Frontend calls `window.location.href = '/api/auth/google'`
3. Backend Passport middleware redirects to Google OAuth page
4. User authenticates with Google
5. Google redirects to `https://yourdomain.com/api/auth/google/callback?code=...`
6. Backend Passport middleware handles callback:
   - Verifies OAuth code with Google
   - Gets user profile (email, name, photo)
   - Looks up or creates user in database
   - Generates JWT token
   - Sets Express session with user ID
7. Backend redirects to `/?auth=success&token={jwt_token}`
8. Frontend React useEffect detects `auth=success` in URL:
   - Extracts token from query parameter
   - Stores in localStorage as `auth-token`
   - Cleans URL with `window.history.replaceState()`
9. Frontend calls `initialize()` which requests `/api/auth/me`
10. Backend authenticates via JWT and returns user object
11. Frontend updates Zustand store with user data
12. UI shows user menu instead of "Sign In" button

**3. CRITICAL: fetch() credentials configuration**

⚠️ **MUST HAVE** `credentials: 'include'` in ALL fetch requests!

```javascript
// In src/utils/api.js
const response = await fetch(`${API_BASE}${endpoint}`, {
  ...options,
  headers,
  credentials: 'include', // ← CRITICAL: Sends cookies with every request
});
```

**Why this is critical:**
- Without `credentials: 'include'`, browsers won't send session cookies
- OAuth sets session cookies on callback
- Backend `authenticateJWT` middleware checks JWT first, then falls back to session
- If no credentials are sent, session auth fails
- Result: User appears logged out even after successful OAuth

**Common symptom if missing:**
- OAuth callback succeeds (user created in database)
- Token stored in localStorage
- But API calls to `/api/auth/me` return 401 Unauthorized
- User sees "Sign In" button despite being authenticated
- Network tab shows cookies not being sent

**4. Middleware Authentication Logic**

The `authenticateJWT` middleware (in `auth.js`) checks authentication in this order:

```javascript
1. Check Authorization header for JWT Bearer token
   ↓ Found and valid? → Attach user to req.user → Continue
   ↓ Not found or invalid?
2. Check Express session for userId
   ↓ Found? → Load user from database → Attach to req.user → Continue
   ↓ Not found?
3. Return 401 Unauthorized
```

This hybrid approach ensures:
- JWT tokens work for API clients
- OAuth callbacks work via sessions
- Seamless fallback if JWT expires but session is valid

**5. Token Storage and Lifecycle**

**Frontend (localStorage):**
```javascript
// Token is stored after login or OAuth callback
localStorage.setItem('auth-token', token);

// Token is read on every API request
const token = localStorage.getItem('auth-token');

// Token is removed on logout
localStorage.removeItem('auth-token');
```

**Backend (JWT):**
- Secret: `process.env.JWT_SECRET` (MUST be consistent across restarts)
- Expiration: 7 days (`JWT_EXPIRES_IN = '7d'`)
- Payload: `{ id, email, username }`
- Algorithm: HMAC SHA256 (default for jsonwebtoken)

**Backend (Session):**
- Secret: `process.env.SESSION_SECRET`
- Storage: In-memory (MemoryStore) - ⚠️ NOT suitable for production scale
- Cookie name: `connect.sid`
- Lifespan: 7 days (same as JWT)
- Used primarily for OAuth callbacks

**6. Production Deployment Considerations**

**MUST configure for production:**
```env
NODE_ENV=production
JWT_SECRET=random-secret-at-least-32-chars
SESSION_SECRET=different-random-secret-32-chars
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
```

**Session store warning:**
The app uses `MemoryStore` for sessions, which:
- Works fine for single-instance deployments
- Does NOT work with multiple instances (load balancing)
- Loses all sessions on restart
- For production scale, use: Redis, MongoDB, or PostgreSQL session store

**Docker deployment notes:**
- Database is persistent via volume mount (`./app/data:/app/data`)
- Sessions are NOT persistent (in-memory only)
- Users stay logged in via JWT tokens after container restart
- OAuth requires HTTPS (Traefik with Let's Encrypt in docker-compose.yml)

**7. Common Issues and Solutions**

**Issue: "Sign In" button shows after successful OAuth**
- Cause: Missing `credentials: 'include'` in fetch()
- Solution: Add to all fetch requests in `src/utils/api.js`

**Issue: OAuth works but breaks after container rebuild**
- Cause: JWT_SECRET changed or not set
- Solution: Set JWT_SECRET in .env file or docker-compose environment

**Issue: Token expired errors**
- Cause: JWT expired after 7 days
- Solution: User must log in again (expected behavior)
- Future: Implement refresh tokens for seamless renewal

**Issue: CORS errors on OAuth callback**
- Cause: CORS not configured for credentials
- Solution: Already configured with `cors()` middleware and credentials

**Issue: OAuth redirect to wrong URL**
- Cause: GOOGLE_CALLBACK_URL not matching OAuth console configuration
- Solution: Ensure URLs match exactly (including protocol and trailing slashes)

**8. Testing Authentication**

**Test JWT authentication:**
```bash
# Get token from login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Use token in subsequent requests
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Test OAuth flow:**
1. Open browser to http://localhost:3000
2. Click "Sign In"
3. Click "Continue with Google"
4. Observe redirect through Google auth
5. Check URL for `?auth=success&token=...`
6. Check localStorage for `auth-token`
7. Verify user menu appears

**Check session in Docker:**
```bash
# View server logs for auth events
docker-compose logs -f dbml-studio | grep -E "(auth|session)"

# Check users in database
docker exec dbml-studio node -e "const db = require('./database'); console.log(db.db.prepare('SELECT * FROM users').all());"
```

#### Database Schema
- **users**: id, email, username, password_hash, provider, provider_id, avatar_url
- **diagrams**: id, user_id, title, description, dbml_code, positions (JSON), is_public
- **Indexes**: Optimized for user_id, email, provider lookups, public diagrams

#### React Flow Node Hierarchy
- **Group Nodes**:
  - Rendered at z-index 0
  - Draggable by header only (`.group-header` drag handle)
  - Auto-expand when child tables move (`expandParent: true`)
- **Table Nodes**:
  - Rendered at z-index 100 (above groups)
  - Draggable by header (`.drag-handle`)
  - Can be children of group nodes (`parentNode` property)
  - Positions relative to parent when grouped

#### State Management
- **Global Auth State**: Zustand store (`authStore.js`)
  - `user`: Current user object
  - `isAuthenticated`: Boolean flag
  - `initialize()`: Loads user from JWT or session on mount
- **Local Component State**: React useState for UI state
- **History State**: Custom Zustand store for undo/redo (`historyStore.js`)

### Deployment Architecture

**Volume-Mounted Production Mode:**
- Docker container runs Express server on port 3000
- Serves pre-built static files from `dist/` directory
- `./app` folder mounted into container for instant updates
- Container's `node_modules` preserved (Linux-compiled)
- Build on host (`npm run build`), deploy instantly via volume mount

**OAuth Requirements:**
- Backend must run on the port that Traefik routes to (port 3000)
- OAuth callbacks go directly to Express server
- Container runs `npm start` to serve built files
- No Vite dev server in production (would break OAuth callbacks)

**Local Development (optional):**
If you need to develop locally without Docker:
```bash
cd app
npm run dev  # Starts Express (port 3001) + Vite (port 5173)
```
This mode sets `DEV_MODE=true` and proxies requests to Vite for HMR.

### Docker Configuration

**Production Dockerfile:**
```dockerfile
FROM node:20-slim
WORKDIR /app

# Install build dependencies (required for better-sqlite3)
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

# Install dependencies
COPY app/package*.json ./
RUN npm install

# Copy application files (node_modules excluded via .dockerignore)
COPY app/ ./

# Build frontend for production
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000
CMD ["npm", "start"]
```

**Critical .dockerignore entries:**
```
node_modules
app/node_modules    # Prevents copying host node_modules
app/dist            # Prevents copying old builds
data
app/data
```

**Why .dockerignore is important:**
- Host `node_modules` may contain binaries compiled for different architecture
- `better-sqlite3` native module MUST be compiled inside Docker container
- Copying host node_modules causes "NODE_MODULE_VERSION mismatch" errors
- Each build creates fresh node_modules with correct binaries

**Docker Compose:**
- **Command**: `npm start` to serve built files from `dist/`
- **Volume Mounts**:
  - `./app:/app` - Entire app folder (code changes apply instantly)
  - `/app/node_modules` - Anonymous volume preserves container's Linux-compiled dependencies
  - `/app/dist` - Anonymous volume (optional, can rebuild on host)
  - `./app/data:/app/data` - Database persistence
- **Traefik Integration**: Labels for automatic HTTPS with Let's Encrypt
- **Network**: Connects to external `frontend` network for Traefik
- **Environment**: `NODE_ENV=production` for secure cookies and production settings

**Build optimization (vite.config.js):**
```javascript
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],           // ~141 KB
        'reactflow': ['reactflow'],                        // ~148 KB
        'codemirror': ['@codemirror/*', '@uiw/...'],      // ~428 KB
        'dbml': ['@dbml/core'],                           // ~10.9 MB (large!)
      },
    },
  },
}
```

This code splitting:
- Loads critical chunks first (React, ReactFlow, CodeMirror)
- DBML parser loads last (largest chunk)
- Enables parallel chunk downloads
- Improves perceived load time
- Better browser caching (chunks cached separately)

### Important Implementation Details

#### DBML Parser Error Handling
- The parser extracts line/column information from parse errors
- Errors are displayed in the viewer with location details
- Empty DBML code returns empty nodes/edges (not an error)

#### React Flow Position Validation
- All positions must be valid numbers (not NaN)
- Positions are converted with `Number()` and fallback to 0
- Group positions are calculated based on table count and layout

#### Table Groups
- Groups auto-size based on contained tables (TABLES_PER_ROW = 2)
- Child table positions are relative to parent group
- Groups use `expandParent` instead of `extent: 'parent'` to avoid NaN issues

#### OAuth Flow
See **Authentication Architecture** section above for complete OAuth flow details including:
- Step-by-step flow diagram
- Token and session handling
- Critical `credentials: 'include'` requirement
- Common issues and solutions

## Environment Variables

Required for production:
- `NODE_ENV`: Set to 'production'
- `JWT_SECRET`: Secret key for JWT tokens
- `SESSION_SECRET`: Secret key for Express sessions
- `GOOGLE_CLIENT_ID`: Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret (optional)
- `GOOGLE_CALLBACK_URL`: Google OAuth callback URL (optional)
- `GITHUB_CLIENT_ID`: GitHub OAuth client ID (optional)
- `GITHUB_CLIENT_SECRET`: GitHub OAuth client secret (optional)
- `GITHUB_CALLBACK_URL`: GitHub OAuth callback URL (optional)

## Troubleshooting Guide

### OAuth Login Issues

**Symptom: OAuth redirect shows blank page or "Sign In" button persists**
- **Cause #1**: Multiple containers running with same Traefik domain
  - Check: `docker ps | grep dbml` - should show only ONE container
  - Solution: Stop any duplicate containers: `docker-compose down`
- **Cause #2**: Container not serving built files
  - Check: `ls -la app/dist/` - should have built files
  - Solution: Run `cd app && npm run build`
- **Cause #3**: Missing `credentials: 'include'` in fetch requests
  - Check: `src/utils/api.js` must include `credentials: 'include'` in fetch options
  - Result: Session cookies sent with API requests

**Symptom: Page loads forever after OAuth**
- **Cause**: JavaScript bundle too large (12+ MB) without code splitting
- **Solution**: Check `vite.config.js` has `manualChunks` configuration
- **Result**: Split into smaller chunks that load in parallel

### Deployment Workflow

**Fast iteration workflow:**
```bash
# 1. Edit code in app/src/
# 2. Build frontend
cd app && npm run build

# 3. Changes are live immediately (via volume mount)
# No Docker restart needed!
```

**When to rebuild Docker image:**
- `package.json` changed (new dependencies)
- Dockerfile changed
- `.dockerignore` changed

```bash
docker-compose up -d --build
```

### Database Issues

**Symptom: Database reset after rebuild**
- **Cause**: Volume mount not configured or data directory not persisted
- **Solution**: Check `docker-compose.yml` has `./app/data:/app/data` volume

**Symptom: better-sqlite3 module error**
- **Cause**: Host node_modules copied to container
- **Solution**: Ensure `.dockerignore` excludes `app/node_modules`
- **Details**: Native modules must be compiled inside container

## Database Migrations

The database auto-initializes on first run via `database.initDatabase()` called in `server.js`. No manual migrations needed for schema changes - modify `database.js` and restart.

## API Routes

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout (destroy session)
- `GET /api/auth/me` - Get current user (requires auth)
- `GET /api/auth/google` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback
- `GET /api/auth/github` - GitHub OAuth login
- `GET /api/auth/github/callback` - GitHub OAuth callback

### Diagrams
- `POST /api/diagrams` - Create new diagram (requires auth)
- `GET /api/diagrams` - Get user's diagrams (requires auth)
- `GET /api/diagrams/:id` - Get single diagram (public or owner)
- `PUT /api/diagrams/:id` - Update diagram (requires auth, owner only)
- `DELETE /api/diagrams/:id` - Delete diagram (requires auth, owner only)
- `GET /api/public/diagrams` - Get public diagrams (no auth)

### Legacy
- `POST /api/positions/:projectId` - Save positions (legacy, file-based)
- `GET /api/positions/:projectId` - Load positions (legacy, file-based)
