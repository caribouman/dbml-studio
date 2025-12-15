const { app, BrowserWindow, Menu, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

// Keep a global reference of the window objects
let mainWindow;
let loadingWindow;
let serverInstance;
const SERVER_PORT = 3000;
const MAX_RETRIES = 30; // 30 seconds total

// Setup logging
let logFile;
let userDataPath;

function initLogging() {
  try {
    userDataPath = app.getPath('userData');
    const logPath = path.join(userDataPath, 'electron-debug.log');
    logFile = fs.createWriteStream(logPath, { flags: 'a' });

    // Track if stream is writable
    let streamClosed = false;

    logFile.on('close', () => {
      streamClosed = true;
    });

    logFile.on('error', (err) => {
      streamClosed = true;
      console.error('Log file error:', err);
    });

    // Save original console methods FIRST
    const originalLog = console.log;
    const originalError = console.error;

    // Safe write function
    const safeWrite = (message) => {
      if (logFile && !streamClosed && logFile.writable) {
        try {
          logFile.write(message);
        } catch (err) {
          // Silently ignore write errors
          streamClosed = true;
        }
      }
    };

    // Override console methods
    console.log = (...args) => {
      originalLog.apply(console, args);
      const message = args.join(' ');
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      safeWrite(logMessage);
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      const message = 'ERROR: ' + args.join(' ');
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] ${message}\n`;
      safeWrite(logMessage);
    };

    console.log('=== DBML Studio Starting ===');
    console.log('Electron version:', process.versions.electron);
    console.log('Node version:', process.versions.node);
    console.log('Platform:', process.platform);
    console.log('User data path:', userDataPath);
    console.log('App path:', app.getAppPath());
  } catch (error) {
    // Use original console.error to avoid issues
    console.error('Failed to initialize logging:', error);
  }
}

// Function to check if server is ready by making an HTTP request
function checkServerReady(retries = 0) {
  return new Promise((resolve, reject) => {
    const options = {
      host: 'localhost',
      port: SERVER_PORT,
      path: '/',
      method: 'GET',
      timeout: 1000
    };

    const req = http.request(options, (res) => {
      console.log(`Server responded with status: ${res.statusCode}`);
      if (res.statusCode === 200 || res.statusCode === 304) {
        resolve();
      } else if (retries < MAX_RETRIES) {
        setTimeout(() => {
          checkServerReady(retries + 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error(`Server not ready after ${MAX_RETRIES} retries`));
      }
    });

    req.on('error', (err) => {
      if (retries < MAX_RETRIES) {
        setTimeout(() => {
          checkServerReady(retries + 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error(`Server not responding: ${err.message}`));
      }
    });

    req.on('timeout', () => {
      req.destroy();
      if (retries < MAX_RETRIES) {
        setTimeout(() => {
          checkServerReady(retries + 1).then(resolve).catch(reject);
        }, 1000);
      } else {
        reject(new Error('Server timeout'));
      }
    });

    req.end();
  });
}

function updateLoadingMessage(message) {
  console.log('Loading: ' + message);
  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.webContents.executeJavaScript(`
      document.getElementById('message').textContent = '${message.replace(/'/g, "\\'")}';
    `).catch(() => {});
  }
}

function showError(error) {
  const errorMsg = error.stack || error.message || String(error);
  console.error('FATAL ERROR:', errorMsg);

  const errorDisplay = `Failed to start DBML Studio:\n\n${errorMsg}\n\nLog file: ${path.join(userDataPath, 'electron-debug.log')}\n\nThe app will close in 15 seconds.`;

  if (loadingWindow && !loadingWindow.isDestroyed()) {
    loadingWindow.webContents.executeJavaScript(`
      document.getElementById('message').innerHTML = '<div class="error">${errorDisplay.replace(/\n/g, '<br>').replace(/'/g, "\\'")}</div>';
    `).catch(() => {});
  } else {
    // Loading window not available, show native dialog
    dialog.showErrorBox('DBML Studio Error', errorDisplay);
  }
}

function createLoadingWindow() {
  try {
    console.log('Creating loading window');
    loadingWindow = new BrowserWindow({
      width: 600,
      height: 450,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    // Create a simple HTML loading screen
    const loadingHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body {
            margin: 0;
            padding: 20px;
            background: linear-gradient(180deg, #1a2f4a 0%, #2a5a7f 50%, #3a8faf 100%);
            border-radius: 10px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            color: white;
            box-sizing: border-box;
          }
          .icon {
            width: 150px;
            height: 150px;
            margin-bottom: 30px;
            animation: fadeIn 0.8s ease-in-out;
          }
          .logo {
            font-size: 42px;
            font-weight: bold;
            margin-bottom: 20px;
            animation: fadeIn 1s ease-in-out 0.2s both;
          }
          .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid rgba(255, 255, 255, 0.3);
            border-top-color: white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .message {
            margin-top: 20px;
            font-size: 13px;
            color: rgba(255, 255, 255, 0.9);
            text-align: center;
            padding: 0 30px;
            max-width: 500px;
            line-height: 1.6;
            word-wrap: break-word;
            animation: fadeIn 1.2s ease-in-out 0.4s both;
          }
          .error {
            color: #ff6b6b;
            margin-top: 20px;
            padding: 20px;
            text-align: left;
            font-size: 11px;
            font-family: 'Consolas', 'Monaco', monospace;
            max-width: 540px;
            line-height: 1.5;
            background: rgba(255, 107, 107, 0.1);
            border-radius: 5px;
            border: 1px solid rgba(255, 107, 107, 0.3);
            max-height: 300px;
            overflow-y: auto;
          }
        </style>
      </head>
      <body>
        <img class="icon" src="data:image/png;base64,${fs.readFileSync(path.join(__dirname, 'public', 'icon.png')).toString('base64')}" alt="DBML Studio" />
        <div class="logo">DBML Studio</div>
        <div class="spinner"></div>
        <div class="message" id="message">Initializing...</div>
      </body>
      </html>
    `;

    loadingWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(loadingHTML)}`);
    console.log('Loading window created');
  } catch (error) {
    console.error('Failed to create loading window:', error);
    throw error;
  }
}

function startServer() {
  return new Promise((resolve, reject) => {
    console.log('=== Starting Server ===');
    updateLoadingMessage('Preparing server environment...');

    try {
      // Use userData directory for writable storage (outside ASAR)
      const dataDir = path.join(userDataPath, 'data');

      console.log('Data directory:', dataDir);

      // Ensure data directory exists
      if (!fs.existsSync(dataDir)) {
        console.log('Creating data directory');
        fs.mkdirSync(dataDir, { recursive: true });
        console.log('Data directory created successfully');
      } else {
        console.log('Data directory already exists');
      }

      // Set environment variables BEFORE requiring any server modules
      console.log('Setting environment variables');
      process.env.NODE_ENV = 'production';
      process.env.PORT = SERVER_PORT.toString();
      process.env.DATA_DIR = dataDir;
      process.env.ELECTRON = 'true'; // Flag for server.js to bind to localhost (avoids Windows firewall)

      console.log('Environment configured:');
      console.log('  NODE_ENV:', process.env.NODE_ENV);
      console.log('  PORT:', process.env.PORT);
      console.log('  DATA_DIR:', process.env.DATA_DIR);
      console.log('  ELECTRON:', process.env.ELECTRON);

      updateLoadingMessage('Loading server modules...');

      // Import and start the Express server directly
      const serverPath = path.join(__dirname, 'server.js');
      console.log('Loading server from:', serverPath);

      // Check if server.js exists
      if (!fs.existsSync(serverPath)) {
        throw new Error(`Server file not found: ${serverPath}`);
      }

      updateLoadingMessage('Starting Express server...');

      // Wrap the require in try-catch to catch any immediate errors
      try {
        console.log('Requiring server.js');
        serverInstance = require(serverPath);
        console.log('Server module loaded, type:', typeof serverInstance);
      } catch (requireError) {
        console.error('Failed to require server.js:', requireError);
        throw new Error(`Failed to load server: ${requireError.message}`);
      }

      console.log('Server code executed, waiting for HTTP server to be ready');
      updateLoadingMessage('Waiting for server to start...');

      // Wait for server to bind to port
      setTimeout(() => {
        console.log('Checking if server is responding');
        updateLoadingMessage('Checking server connection...');
        checkServerReady()
          .then(() => {
            console.log('Server is ready!');
            updateLoadingMessage('Server ready!');
            resolve();
          })
          .catch((error) => {
            console.error('Server health check failed:', error);
            reject(error);
          });
      }, 3000); // Give server more time to initialize

    } catch (error) {
      console.error('Error in startServer:', error);
      reject(error);
    }
  });
}

function createWindow() {
  try {
    console.log('Creating main window');

    // Create the browser window
    const iconPath = path.join(__dirname, 'public', 'icon.png');
    const windowOptions = {
      width: 1400,
      height: 900,
      show: false, // Don't show until ready
      icon: iconPath,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        devTools: true,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'DBML Studio',
      backgroundColor: '#1a1a1a'
    };

    mainWindow = new BrowserWindow(windowOptions);

    // Show window when ready to avoid white flash
    mainWindow.once('ready-to-show', () => {
      console.log('Main window ready to show');
      mainWindow.show();
      if (loadingWindow && !loadingWindow.isDestroyed()) {
        loadingWindow.close();
      }
    });

    // Handle loading errors
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load page:', errorCode, errorDescription);

      // Retry loading after a delay
      if (errorCode !== -3) { // -3 is user abort, don't retry
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            console.log('Retrying page load');
            mainWindow.loadURL(`http://localhost:${SERVER_PORT}`);
          }
        }, 2000);
      }
    });

    // Load the app
    const url = `http://localhost:${SERVER_PORT}`;
    console.log('Loading URL:', url);
    mainWindow.loadURL(url);

    // Create application menu
    const template = [
      {
        label: 'File',
        submenu: [
          {
            label: 'Reload',
            accelerator: 'CmdOrCtrl+R',
            click: () => mainWindow.reload()
          },
          {
            label: 'Open Dev Tools',
            accelerator: 'CmdOrCtrl+Shift+I',
            click: () => mainWindow.webContents.openDevTools()
          },
          {
            label: 'View Logs',
            click: () => {
              const logPath = path.join(userDataPath, 'electron-debug.log');
              require('electron').shell.openPath(logPath);
            }
          },
          { type: 'separator' },
          {
            label: 'Exit',
            accelerator: 'CmdOrCtrl+Q',
            click: () => app.quit()
          }
        ]
      },
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' },
          { role: 'redo' },
          { type: 'separator' },
          { role: 'cut' },
          { role: 'copy' },
          { role: 'paste' }
        ]
      },
      {
        label: 'View',
        submenu: [
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' }
        ]
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'About DBML Studio',
            click: () => {
              dialog.showMessageBox(mainWindow, {
                type: 'info',
                title: 'About DBML Studio',
                message: 'DBML Studio',
                detail: `Version: 1.0.0\nInteractive DBML viewer with draggable tables\n\nElectron: ${process.versions.electron}\nChrome: ${process.versions.chrome}\nNode: ${process.versions.node}\n\nLog file: ${path.join(userDataPath, 'electron-debug.log')}`
              });
            }
          }
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    // Open external links in default browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      require('electron').shell.openExternal(url);
      return { action: 'deny' };
    });

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
      console.log('Main window closed');
      mainWindow = null;
    });

    console.log('Main window created successfully');
  } catch (error) {
    console.error('Failed to create main window:', error);
    throw error;
  }
}

// Install early error handlers
process.on('uncaughtException', (error) => {
  console.error('UNCAUGHT EXCEPTION:', error);
  showError(error);
  setTimeout(() => process.exit(1), 15000);
});

process.on('unhandledRejection', (error) => {
  console.error('UNHANDLED REJECTION:', error);
  showError(error);
  setTimeout(() => process.exit(1), 15000);
});

// This method will be called when Electron has finished initialization
app.whenReady().then(async () => {
  console.log('=== Electron App Ready ===');

  // Initialize logging first
  initLogging();

  try {
    // Show loading window
    createLoadingWindow();

    // Small delay to ensure loading window is visible
    await new Promise(resolve => setTimeout(resolve, 500));

    // Start server and wait for it to be ready
    await startServer();

    // Create main window
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  } catch (error) {
    console.error('FATAL: Failed to start application:', error);
    showError(error);

    // Don't quit immediately, let user see the error
    setTimeout(() => {
      if (logFile && logFile.writable) {
        try {
          logFile.end();
        } catch (err) {
          // Ignore errors during cleanup
        }
      }
      app.quit();
    }, 15000);
  }
});

// Quit when all windows are closed
app.on('window-all-closed', () => {
  console.log('All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up on quit
app.on('before-quit', () => {
  console.log('App is quitting');
  if (logFile && logFile.writable) {
    try {
      logFile.end();
    } catch (err) {
      // Ignore errors during cleanup
    }
  }
});

app.on('will-quit', () => {
  console.log('App will quit');
});
