const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const isDev = process.env.NODE_ENV === 'development';
const { setupIPC } = require('./ipc');
const db = require('./database');

console.log('Main process starting...');
console.log('Current directory:', __dirname);
console.log('Development mode:', isDev);

// Keep a global reference of the window object
let mainWindow;

const preloadPath = path.join(__dirname, 'preload.js');
console.log('Preload script path:', preloadPath);
if (!require('fs').existsSync(preloadPath)) {
    console.error('Preload script not found at:', preloadPath);
    process.exit(1);
} else {
    console.log('Preload script found successfully');
}

console.log('Setting up IPC handlers...');
setupIPC();

function createWindow() {
    console.log('Creating window...');
    console.log('Database initialized:', !!db);
    
    // Verify preload script exists
    if (!require('fs').existsSync(preloadPath)) {
        console.error('CRITICAL: Preload script not found at:', preloadPath);
        app.quit();
        return;
    }

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        title: 'ClearFeed',
        icon: path.join(__dirname, 'assets/icon.icns'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: preloadPath,
            sandbox: false,
            devTools: true,
            worldSafeExecuteJavaScript: true
        }
    });

    // Wait for the window to be ready before loading content
    mainWindow.webContents.on('did-create-window', () => {
        console.log('Window created, waiting for preload...');
    });

    // Listen to console messages from renderer
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        const levelStr = typeof level === 'string' ? level : String(level);
        console.log(`[RENDERER ${levelStr.toUpperCase()}]:`, message);
    });

    // Load content only after DOM is ready
    mainWindow.webContents.on('dom-ready', () => {
        console.log('DOM ready, checking electron availability');
        mainWindow.webContents.executeJavaScript(`
            console.log('Electron availability check:', {
                electron: !!window.electron,
                ipcRenderer: !!window.electron?.ipcRenderer
            });
        `);
    });

    // Load the app from built files
    const htmlPath = path.join(__dirname, 'frontend/build/index.html');
    console.log('Loading file:', htmlPath);
    console.log('File exists:', require('fs').existsSync(htmlPath));
    
    if (require('fs').existsSync(htmlPath)) {
        mainWindow.loadFile(htmlPath).catch(err => {
            console.error('Failed to load file:', err);
        });
    } else {
        console.error('Build files not found. Please run: cd frontend && npm run build');
        app.quit();
    }
    
    // Open dev tools in development
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    // Emitted when the window is closed
    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    // Update the existing did-finish-load handler
    mainWindow.webContents.on('did-finish-load', () => {
        console.log('Window loaded, testing IPC availability');
        mainWindow.webContents.executeJavaScript(`
            if (window.electron && window.electron.ipcRenderer) {
                console.log('IPC is available in renderer');
                if (window.electronTest && window.electronTest.testAPI) {
                    console.log('Test API result:', window.electronTest.testAPI());
                }
            } else {
                console.error('IPC is not available in renderer');
            }
        `).catch(console.error);
    });
}

app.whenReady().then(() => {
    console.log('App is ready, creating window...');
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

// Handle graceful shutdown of database connection
app.on('before-quit', () => {
    console.log('Closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
    });
});