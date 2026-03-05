import { app, BrowserWindow, ipcMain, nativeImage } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, type ChildProcess } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const iconPath = path.join(__dirname, '../assets/icon.png');

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: nativeImage.createFromPath(iconPath),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
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

// --- Persistent shell session management ---
const shellSessions = new Map<string, { process: ChildProcess; shell: string }>();

function getDefaultShell(): string {
  if (process.platform === 'win32') return 'cmd.exe';
  return process.env.SHELL || '/bin/zsh';
}

function getOrCreateSession(sessionId: string, loginShell: boolean = false): { process: ChildProcess; shell: string } {
  let session = shellSessions.get(sessionId);
  if (session && !session.process.killed) {
    return session;
  }
  const shell = getDefaultShell();
  const args = loginShell ? ['-l', '-i'] : ['-i'];
  const child = spawn(shell, args, {
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, TERM: 'dumb' },
    cwd: process.env.HOME || '/',
  });
  child.on('exit', () => {
    shellSessions.delete(sessionId);
  });
  session = { process: child, shell };
  shellSessions.set(sessionId, session);
  return session;
}

ipcMain.handle('exec:execute', async (_event, command: string, sessionId?: string, loginShell?: boolean, timeoutMs?: number) => {
  // Only allow on macOS and Linux
  if (process.platform === 'win32') {
    return { error: 'exec tool is only supported on macOS and Linux', sessionId: '', exitCode: -1, output: '' };
  }

  const sid = sessionId || `session_${Date.now()}`;
  const session = getOrCreateSession(sid, loginShell ?? false);
  const { process: child } = session;
  const execTimeout = timeoutMs || 300000; // Default 5 minutes

  return new Promise<{ sessionId: string; exitCode: number; output: string; error?: string }>((resolve) => {
    let output = '';
    let errorOutput = '';

    // Use a unique end marker to detect command completion
    const endMarker = `__EXEC_END_${Date.now()}_${Math.random().toString(36).slice(2)}__`;
    const exitCodeMarker = `__EXIT_CODE_${Date.now()}_${Math.random().toString(36).slice(2)}__`;

    const timeout = setTimeout(() => {
      cleanup();
      resolve({ sessionId: sid, exitCode: -1, output: output || errorOutput, error: `Command timed out after ${execTimeout}ms` });
    }, execTimeout);

    const onStdout = (data: Buffer) => {
      const text = data.toString();
      output += text;
      // Check if we have the end marker in the accumulated output
      if (output.includes(endMarker)) {
        cleanup();
        // Parse exit code and clean output
        const exitCodeMatch = output.match(new RegExp(`${exitCodeMarker}(\\d+)`));
        const exitCode = exitCodeMatch ? parseInt(exitCodeMatch[1], 10) : 0;
        // Remove markers and the echo commands from output
        let cleanOutput = output
          .replace(new RegExp(`echo ${exitCodeMarker}.*`, 'g'), '')
          .replace(new RegExp(`${exitCodeMarker}\\d+`, 'g'), '')
          .replace(new RegExp(`echo ${endMarker}`, 'g'), '')
          .replace(new RegExp(endMarker, 'g'), '')
          .trim();
        resolve({ sessionId: sid, exitCode, output: cleanOutput });
      }
    };

    const onStderr = (data: Buffer) => {
      errorOutput += data.toString();
    };

    const cleanup = () => {
      clearTimeout(timeout);
      child.stdout?.off('data', onStdout);
      child.stderr?.off('data', onStderr);
    };

    child.stdout?.on('data', onStdout);
    child.stderr?.on('data', onStderr);

    // Send command followed by markers to detect completion
    child.stdin?.write(`${command}\necho ${exitCodeMarker}$?\necho ${endMarker}\n`);
  });
});

ipcMain.handle('exec:destroySession', async (_event, sessionId: string) => {
  const session = shellSessions.get(sessionId);
  if (session) {
    session.process.kill();
    shellSessions.delete(sessionId);
  }
});

ipcMain.handle('exec:listSessions', async () => {
  return Array.from(shellSessions.keys());
});

// Clean up all shell sessions on app quit
app.on('before-quit', () => {
  for (const [, session] of shellSessions) {
    session.process.kill();
  }
  shellSessions.clear();
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
