// Try to require electron with error handling
let electron;
try {
  electron = require('electron');
  if (!electron || !electron.app) {
    throw new Error('Electron module loaded but app is undefined');
  }
} catch (error) {
  console.error('❌ Failed to load Electron:', error.message);
  console.error('\nPlease ensure Electron is installed correctly:');
  console.error('  1. Delete node_modules: rmdir /s /q node_modules');
  console.error('  2. Delete package-lock.json: del package-lock.json');
  console.error('  3. Reinstall: npm install');
  console.error('\nIf the problem persists, try:');
  console.error('  npm install electron@latest --save-dev');
  process.exit(1);
}

const { app, BrowserWindow, ipcMain, Notification } = electron;
const path = require('path');

console.log('✅ Electron loaded successfully');
console.log('📦 Electron version:', process.versions.electron);
console.log('📦 Chrome version:', process.versions.chrome);
console.log('📦 Node version:', process.versions.node);

let mainWindow;

function createWindow() {
  console.log('🪟 Creating window...');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: true,
    },
    titleBarStyle: 'default',
    show: false, // Don't show until ready
    backgroundColor: '#0e1621',
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    console.log('✅ Window ready to show');
    mainWindow.show();
  });

  // Development mode
  const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

  if (isDev) {
    const devUrl = 'http://localhost:5173';
    console.log('🔧 Development mode - loading:', devUrl);
    
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error('❌ Failed to load URL:', err);
      console.error('Make sure Vite dev server is running on port 5173');
    });
    
    // Open DevTools in development
    mainWindow.webContents.openDevTools();
  } else {
    // Production mode
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('📦 Production mode - loading:', indexPath);
    
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('❌ Failed to load file:', err);
    });
  }

  mainWindow.on('closed', () => {
    console.log('🪟 Window closed');
    mainWindow = null;
  });

  // Handle window controls from renderer
  ipcMain.on('minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('close', () => {
    if (mainWindow) mainWindow.close();
  });

  // Handle notifications
  ipcMain.on('show-notification', (event, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  console.log('✅ Window created successfully');
}

// App ready
app.whenReady().then(() => {
  console.log('🚀 App is ready');
  createWindow();
}).catch((err) => {
  console.error('❌ Failed to start app:', err);
  process.exit(1);
});

app.on('window-all-closed', () => {
  console.log('🚪 All windows closed');
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  console.log('🔄 App activated');
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
});

console.log('📄 Main process initialized');
