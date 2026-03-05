import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  platform: 'desktop',
  os: process.platform === 'darwin' ? 'macos' : process.platform === 'win32' ? 'windows' : 'linux',

  // File system operations
  fs: {
    readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
    writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
    readdir: (path: string) => ipcRenderer.invoke('fs:readdir', path),
    mkdir: (path: string) => ipcRenderer.invoke('fs:mkdir', path),
    rm: (path: string) => ipcRenderer.invoke('fs:rm', path),
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
  },

  // Shell exec operations (persistent sessions)
  exec: {
    execute: (command: string, sessionId?: string, loginShell?: boolean, timeoutMs?: number) => ipcRenderer.invoke('exec:execute', command, sessionId, loginShell, timeoutMs),
    destroySession: (sessionId: string) => ipcRenderer.invoke('exec:destroySession', sessionId),
    listSessions: () => ipcRenderer.invoke('exec:listSessions'),
  },

  // Storage operations
  storage: {
    getItem: (key: string) => ipcRenderer.invoke('storage:getItem', key),
    setItem: (key: string, value: string) => ipcRenderer.invoke('storage:setItem', key, value),
    removeItem: (key: string) => ipcRenderer.invoke('storage:removeItem', key),
  },
});
