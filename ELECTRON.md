# DBML Studio - Electron Desktop App

DBML Studio can be packaged as a standalone desktop application for Windows and Linux using Electron.

## Features

- **Standalone desktop app** - No need for Docker or separate server
- **Native window** - Runs as a native application with menu bar
- **Portable** - Single executable file (AppImage for Linux, NSIS installer for Windows)
- **Embedded server** - Express server runs inside the Electron app
- **Local database** - SQLite database stored alongside the app

## Prerequisites

Before building, ensure you have:
- Node.js 20+ installed
- All project dependencies: `npm install`
- Build tools:
  - **Linux**: `build-essential` package (`sudo apt-get install build-essential`)
  - **Windows**: Visual Studio Build Tools or windows-build-tools npm package

## Quick Start

### Development Mode

Run the Electron app in development mode:

```bash
cd app
npm run electron:dev
```

This will:
1. Build the frontend with Vite
2. Start the Electron app
3. Launch the Express server on port 3000
4. Open the app window

### Building Executables

#### Linux (AppImage)

Build a portable Linux executable:

```bash
cd app
npm run electron:build:linux
```

Output: `app/release/DBML Studio-1.0.0.AppImage` (~130 MB)

To run the AppImage:
```bash
chmod +x "app/release/DBML Studio-1.0.0.AppImage"
./app/release/DBML\ Studio-1.0.0.AppImage
```

#### Windows (NSIS Installer)

**Option 1: Build on Windows**

The easiest way to build Windows executables is on a Windows machine:

```bash
cd app
npm install
npm run electron:build:win
```

Output: `app/release/DBML Studio Setup 1.0.0.exe`

**Option 2: Cross-compile from Linux (requires Wine)**

To build Windows executables from Linux, you need Wine:

```bash
# Install Wine (Ubuntu/Debian)
sudo dpkg --add-architecture i386
sudo apt-get update
sudo apt-get install wine64 wine32

# Build Windows executable
cd app
npm run electron:build:win
```

## Build Outputs

All builds are saved to `app/release/`:

| Platform | File | Size | Type |
|----------|------|------|------|
| Linux | `DBML Studio-1.0.0.AppImage` | ~130 MB | Portable executable |
| Linux | `dbml-studio_1.0.0_amd64.deb` | ~120 MB | Debian package (requires metadata) |
| Windows | `DBML Studio Setup 1.0.0.exe` | ~140 MB | NSIS installer |

## NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run electron` | Run Electron app (requires pre-built frontend) |
| `npm run electron:dev` | Build frontend and run Electron app |
| `npm run electron:build` | Build for current platform |
| `npm run electron:build:win` | Build Windows installer |
| `npm run electron:build:linux` | Build Linux AppImage + DEB package |

## Architecture

### How it Works

The Electron app consists of:

1. **Main Process** (`electron.js`):
   - Spawns the Express server as a child process
   - Creates the BrowserWindow
   - Loads `http://localhost:3000`
   - Handles app lifecycle (quit, close, etc.)

2. **Express Server** (`server.js`):
   - Serves the built React app from `dist/`
   - Provides API endpoints for auth and diagrams
   - Manages SQLite database (`data/diagrams.db`)

3. **Frontend** (React + Vite):
   - Pre-built static files in `dist/`
   - Connects to `localhost:3000` for API calls
   - Uses React Flow for diagram visualization

### Native Dependencies

The following native modules are rebuilt for Electron during the build process:

- **bcrypt** - Password hashing
- **better-sqlite3** - SQLite database
- **sqlite3** - Alternative SQLite bindings (legacy)

Electron Builder automatically rebuilds these modules using `@electron/rebuild`.

## Configuration

### package.json

The Electron configuration is in `package.json` under the `"build"` key:

```json
{
  "main": "electron.js",
  "build": {
    "appId": "com.dbmlstudio.app",
    "productName": "DBML Studio",
    "files": [
      "electron.js",
      "server.js",
      "database.js",
      "auth.js",
      "dist/**/*",
      "data",
      "node_modules/**/*",
      "package.json"
    ],
    "win": {
      "target": ["nsis"]
    },
    "linux": {
      "target": ["AppImage", "deb"],
      "category": "Development"
    }
  }
}
```

### Window Options

Configure window size, appearance, and behavior in `electron.js`:

```javascript
mainWindow = new BrowserWindow({
  width: 1400,
  height: 900,
  title: 'DBML Studio',
  backgroundColor: '#1a1a1a',
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true
  }
});
```

## Customization

### App Icon

To use a custom app icon instead of the default Electron icon:

1. Create icons:
   - **Windows**: `app/build/icon.ico` (256x256, multi-resolution)
   - **Linux**: `app/build/icon.png` (512x512 or 1024x1024)

2. Update `package.json`:
   ```json
   "build": {
     "win": {
       "icon": "build/icon.ico"
     },
     "linux": {
       "icon": "build/icon.png"
     }
   }
   ```

See `app/build/README.md` for detailed icon creation instructions.

### Application Metadata

Update in `package.json`:

```json
{
  "name": "dbml-studio",
  "version": "1.0.0",
  "description": "Interactive DBML viewer with draggable tables",
  "author": {
    "name": "Your Name",
    "email": "your.email@example.com"
  },
  "homepage": "https://github.com/yourusername/dbml-studio",
  "license": "MIT"
}
```

### Menu Bar

Customize the application menu in `electron.js`:

```javascript
const template = [
  {
    label: 'File',
    submenu: [
      { label: 'New Diagram', click: () => { /* ... */ } },
      { label: 'Open', click: () => { /* ... */ } },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() }
    ]
  }
];
```

## Distribution

### Linux AppImage

The AppImage is a portable executable that works on most Linux distributions:

```bash
# Make executable
chmod +x "DBML Studio-1.0.0.AppImage"

# Run directly
./DBML\ Studio-1.0.0.AppImage

# Or integrate with system
./DBML\ Studio-1.0.0.AppImage --appimage-extract
# Files extracted to squashfs-root/
```

### Windows Installer

The NSIS installer provides:
- Installation wizard
- Desktop shortcut
- Start menu shortcut
- Uninstaller
- Custom installation directory

Users can run the installer and follow the wizard.

## Troubleshooting

### Build Errors

**Error: "make: not found"**
```bash
# Install build tools
sudo apt-get install build-essential
```

**Error: "wine is required"**
- Either build on Windows, or install Wine to cross-compile from Linux

**Error: "Please specify author email"**
- Add author metadata to `package.json` (see Customization section)

### Runtime Issues

**App shows blank window**
- Check console logs for errors
- Ensure `dist/` folder has been built: `npm run build`
- Verify server started: check console for "Server running on port 3000"

**Database errors**
- Ensure `data/` directory exists and is writable
- Check file permissions on `data/diagrams.db`

**Port 3000 already in use**
- Stop other processes using port 3000
- Or change PORT in `electron.js` and `server.js`

### Development Tips

**Enable DevTools**

DevTools are enabled by default. Press `Ctrl+Shift+I` (or `Cmd+Option+I` on Mac) to open them.

**View Console Logs**

- **Main process logs**: Check terminal where you ran `npm run electron:dev`
- **Renderer logs**: Open DevTools (Console tab)
- **Server logs**: Check terminal for Express server output

**Live Reload**

The Electron app doesn't have hot-reload. After code changes:
```bash
# Rebuild and restart
npm run build
# Then close and reopen the Electron app
```

## Production Deployment

### Code Signing (Optional but Recommended)

For production apps, sign your executables to avoid security warnings:

**Windows:**
```bash
# Set environment variables
export CSC_LINK=/path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password

# Build with signing
npm run electron:build:win
```

**macOS** (if building for Mac in the future):
```bash
export APPLE_ID=your@email.com
export APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx

npm run electron:build:mac
```

### Auto-Updates

To add auto-update functionality, integrate electron-updater:

```bash
npm install electron-updater
```

See: https://www.electron.build/auto-update

## Comparison: Electron vs Docker

| Feature | Electron App | Docker Web App |
|---------|--------------|----------------|
| Installation | Single .exe/AppImage | Requires Docker |
| Startup | ~2-3 seconds | ~5-10 seconds |
| Memory | ~200-300 MB | ~150-200 MB |
| Updates | Manual download | `docker-compose pull` |
| Multi-instance | ✅ Yes | ⚠️ Requires port config |
| Distribution | Single file | `docker-compose.yml` + image |
| Best for | End users, offline | Servers, teams, dev |

## FAQ

**Q: Can I run both the Docker and Electron versions?**
A: Yes, but not simultaneously (they both use port 3000 by default).

**Q: Where is the database stored in the Electron app?**
A: In the `data/` folder next to the executable. For AppImage, it's in the app's working directory.

**Q: Can I use OAuth (Google/GitHub) login in the Electron app?**
A: OAuth requires a public callback URL. It works in development but requires additional configuration for production. Consider using email/password auth for desktop apps.

**Q: How do I update the app?**
A: Currently, users must download and install the new version manually. Auto-update can be added with electron-updater.

**Q: Can I build for macOS?**
A: Yes! Add this to `package.json`:
```json
"build": {
  "mac": {
    "target": ["dmg", "zip"],
    "category": "public.app-category.developer-tools"
  }
}
```
Then run: `npm run electron:build:mac` (requires macOS to build)

## Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [Electron Builder](https://www.electron.build/)
- [Electron Forge](https://www.electronforge.io/)
- [Debugging Electron](https://www.electronjs.org/docs/latest/tutorial/debugging-main-process)

## License

Same as DBML Studio - see main project LICENSE file.
