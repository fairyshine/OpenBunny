// Python 执行器 - 使用 CDN 动态加载 Pyodide
// 集成文件系统沙盒支持

import { PythonResult } from '../../types';
import { FileSystem } from '../filesystem';

type PyodideInterface = {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (handler: { batched: (text: string) => void }) => void;
  setStderr: (handler: { batched: (text: string) => void }) => void;
  _api: { version: string; };
  FS: {
    writeFile: (path: string, data: Uint8Array) => void;
    readFile: (path: string) => Uint8Array;
    mkdir: (path: string) => void;
    readdir: (path: string) => string[];
    rmdir: (path: string) => void;
    unlink: (path: string) => void;
    stat: (path: string) => { mode: number; size: number };
  };
};

type LoadPyodideFunction = (options: {
  indexURL: string;
  stdout?: (text: string) => void;
  stderr?: (text: string) => void;
}) => Promise<PyodideInterface>;

export class PythonExecutor {
  private pyodide: PyodideInterface | null = null;
  private isLoading: boolean = false;
  private loadPromise: Promise<void> | null = null;
  private loadError: Error | null = null;
  private fileSystem: FileSystem;

  constructor(fileSystem: FileSystem) {
    this.fileSystem = fileSystem;
  }

  async initialize(): Promise<void> {
    if (this.pyodide) return;
    if (this.loadError) throw this.loadError;
    if (this.loadPromise) return this.loadPromise;

    this.isLoading = true;
    this.loadPromise = this.doInitialize().finally(() => {
      this.isLoading = false;
    });
    return this.loadPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      await this.loadPyodideScript();
      const loadPyodide = (window as WindowWithPyodide).loadPyodide;
      if (!loadPyodide) {
        throw new Error('Failed to load Pyodide script');
      }

      this.pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/',
        stdout: (text: string) => console.log('[Python]', text),
        stderr: (text: string) => console.error('[Python]', text),
      });

      await this.setupFileSystemSync();
      console.log('Pyodide initialized, version:', this.pyodide._api?.version);
    } catch (error) {
      this.loadError = error instanceof Error ? error : new Error(String(error));
      console.error('Failed to initialize Pyodide:', error);
      throw error;
    }
  }

  private async setupFileSystemSync(): Promise<void> {
    if (!this.pyodide) return;
    await this.fileSystem.initialize();
    try {
      this.pyodide.FS.mkdir('/sandbox');
    } catch {
      // Directory exists
    }
    await this.syncFromDB();
  }

  private async syncFromDB(): Promise<void> {
    if (!this.pyodide) return;
    const entries = await this.fileSystem.readdir('/sandbox');
    
    for (const entry of entries) {
      if (entry.type === 'file') {
        const blob = await this.fileSystem.readFile(entry.path);
        if (blob) {
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          try {
            this.pyodide.FS.writeFile(entry.path, uint8Array);
          } catch (e) {
            console.warn('Failed to sync file to Pyodide FS:', entry.path, e);
          }
        }
      }
    }
  }

  private async syncToDB(): Promise<void> {
    if (!this.pyodide) return;
    try {
      const entries = this.pyodide.FS.readdir('/sandbox');
      for (const name of entries) {
        if (name === '.' || name === '..') continue;
        const pyPath = `/sandbox/${name}`;
        const stat = this.pyodide.FS.stat(pyPath);
        if ((stat.mode & 0o170000) === 0o100000) {
          const data = this.pyodide.FS.readFile(pyPath);
          const bytes = Array.from(data);
          const blob = new Blob([new Uint8Array(bytes)]);
          await this.fileSystem.writeFile(`sandbox/${name}`, blob);
        }
      }
    } catch (e) {
      console.warn('Sync to DB failed:', e);
    }
  }

  private loadPyodideScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[data-pyodide="loaded"]')) {
        resolve();
        return;
      }

      if (document.querySelector('script[data-pyodide="loading"]')) {
        const checkInterval = setInterval(() => {
          if (document.querySelector('script[data-pyodide="loaded"]')) {
            clearInterval(checkInterval);
            resolve();
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
      script.async = true;
      script.setAttribute('data-pyodide', 'loading');
      
      script.onload = () => {
        script.setAttribute('data-pyodide', 'loaded');
        resolve();
      };
      script.onerror = () => reject(new Error('Failed to load Pyodide from CDN'));
      document.head.appendChild(script);
    });
  }

  async execute(code: string): Promise<PythonResult> {
    await this.initialize();
    if (!this.pyodide) {
      throw new Error('Python executor not initialized');
    }

    const result: PythonResult = { output: '', plots: [] };
    let outputBuffer = '';

    try {
      this.pyodide.setStdout({ 
        batched: (text: string) => { outputBuffer += text; } 
      });
      this.pyodide.setStderr({ 
        batched: (text: string) => { outputBuffer += text; } 
      });

      const wrappedCode = `
import sys
from io import StringIO
old_stdout = sys.stdout
old_stderr = sys.stderr
sys.stdout = StringIO()
sys.stderr = StringIO()
import os
os.chdir('/sandbox')
${code}
output = sys.stdout.getvalue()
error = sys.stderr.getvalue()
sys.stdout = old_stdout
sys.stderr = old_stderr
output
`;
      const pyResult = await this.pyodide.runPythonAsync(wrappedCode);
      result.output = outputBuffer || String(pyResult || '');
      
      if (code.includes('plt.show') || code.includes('pyplot')) {
        result.output += '\n[注：matplotlib 图表需在支持的环境中查看]';
      }

      await this.syncToDB();
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  }

  getFileSystem(): FileSystem {
    return this.fileSystem;
  }

  isReady(): boolean {
    return this.pyodide !== null && !this.isLoading;
  }
}

interface WindowWithPyodide extends Window {
  loadPyodide?: LoadPyodideFunction;
}

// 创建单例实例
import { fileSystem } from '../filesystem';
export const pythonExecutor = new PythonExecutor(fileSystem);
