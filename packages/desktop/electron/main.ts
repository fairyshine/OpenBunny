import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    console.log('[Main] Loading:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Debug: capture renderer errors
  mainWindow.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('[Main] did-fail-load:', code, desc);
  });
  mainWindow.webContents.on('console-message', (_e, _level, message) => {
    console.log('[Renderer]', message);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC handlers for file system operations
ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  const fs = await import('fs/promises');
  return fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  const fs = await import('fs/promises');
  return fs.writeFile(filePath, content, 'utf-8');
});

ipcMain.handle('fs:readdir', async (_, dirPath: string) => {
  const fs = await import('fs/promises');
  return fs.readdir(dirPath);
});

ipcMain.handle('fs:mkdir', async (_, dirPath: string) => {
  const fs = await import('fs/promises');
  return fs.mkdir(dirPath, { recursive: true });
});

ipcMain.handle('fs:rm', async (_, filePath: string) => {
  const fs = await import('fs/promises');
  return fs.rm(filePath, { recursive: true });
});

ipcMain.handle('fs:rename', async (_, oldPath: string, newPath: string) => {
  const fs = await import('fs/promises');
  return fs.rename(oldPath, newPath);
});

// Storage operations (using electron-store or similar)
ipcMain.handle('storage:getItem', async (_event, _key: string) => {
  // TODO: Implement with electron-store
  return null;
});

ipcMain.handle('storage:setItem', async (_event, _key: string, _value: string) => {
  // TODO: Implement with electron-store
});

ipcMain.handle('storage:removeItem', async (_event, _key: string) => {
  // TODO: Implement with electron-store
});
