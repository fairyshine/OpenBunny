// 文件系统沙盒 - 基于 IndexedDB 的浏览器文件存储
// 提供类似 POSIX 的文件操作接口

import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface FileSystemEntry {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: Blob;
  size: number;
  createdAt: number;
  modifiedAt: number;
}

interface FileSystemSchema extends DBSchema {
  files: {
    key: string;
    value: FileSystemEntry;
  };
}

export class FileSystem {
  private db: IDBPDatabase<FileSystemSchema> | null = null;
  private dbName = 'webagent-filesystem';
  private dbVersion = 1;
  private isReady = false;

  async initialize(): Promise<void> {
    if (this.isReady && this.db) return;

    try {
      this.db = await openDB<FileSystemSchema>(this.dbName, this.dbVersion, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('files')) {
            db.createObjectStore('files', { keyPath: 'path' });
          }
        },
      });

      // 创建默认根目录（避免调用this.mkdir因为mkdir也会调用initialize）
      const rootPath = '/sandbox';
      const rootEntry: FileSystemEntry = {
        path: rootPath,
        name: 'sandbox',
        type: 'directory',
        size: 0,
        createdAt: Date.now(),
        modifiedAt: Date.now(),
      };
      
      const existing = await this.db.get('files', rootPath);
      if (!existing) {
        await this.db.put('files', rootEntry);
      }
      
      this.isReady = true;
      console.log('[FileSystem] Initialized');
    } catch (error) {
      console.error('[FileSystem] Failed to initialize:', error);
      throw error;
    }
  }

  // 创建目录（递归确保所有父目录存在）
  async mkdir(path: string): Promise<void> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);

    // 递归创建父目录
    const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));
    if (parentDir && parentDir !== '/sandbox' && !(await this.exists(parentDir))) {
      await this.mkdir(parentDir);
    }

    const entry: FileSystemEntry = {
      path: normalizedPath,
      name: normalizedPath.split('/').pop() || '',
      type: 'directory',
      size: 0,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    await this.db!.put('files', entry);
  }

  // 写入文件
  async writeFile(path: string, content: Blob | string): Promise<void> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);

    // 确保父目录存在
    const parentDir = normalizedPath.substring(0, normalizedPath.lastIndexOf('/')) || '/';
    if (parentDir !== '/' && !(await this.exists(parentDir))) {
      await this.mkdir(parentDir);
    }

    // 确保使用 UTF-8 编码创建 Blob
    const blob = content instanceof Blob
      ? content
      : new Blob([content], { type: 'text/plain;charset=utf-8' });

    const entry: FileSystemEntry = {
      path: normalizedPath,
      name: normalizedPath.split('/').pop() || '',
      type: 'file',
      content: blob,
      size: blob.size,
      createdAt: Date.now(),
      modifiedAt: Date.now(),
    };

    // 如果是更新，保留创建时间
    const existing = await this.db!.get('files', normalizedPath);
    if (existing) {
      entry.createdAt = existing.createdAt;
    }

    await this.db!.put('files', entry);
    console.log('[FileSystem] Wrote file:', normalizedPath, 'size:', blob.size);
  }

  // 读取文件
  async readFile(path: string): Promise<Blob | null> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);
    const entry = await this.db!.get('files', normalizedPath);
    
    if (!entry || entry.type !== 'file') {
      return null;
    }
    
    return entry.content || null;
  }

  // 读取文件为文本
  async readFileText(path: string): Promise<string | null> {
    const blob = await this.readFile(path);
    if (!blob) return null;
    const text = await blob.text();
    console.log('[FileSystem] Read file:', path, 'length:', text.length);
    return text;
  }

  // 列出目录内容
  async readdir(path: string): Promise<FileSystemEntry[]> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);
    const allFiles = await this.db!.getAll('files');

    return allFiles.filter(entry => {
      const entryPath = entry.path;
      // 排除自身
      if (entryPath === normalizedPath) return false;

      // 检查是否是直接子项
      // 例如：normalizedPath = '/sandbox', entryPath = '/sandbox/test_dir'
      // 或者：normalizedPath = '/sandbox/test_dir', entryPath = '/sandbox/test_dir/1.md'
      if (!entryPath.startsWith(normalizedPath + '/')) return false;

      // 获取相对路径部分
      const relativePath = entryPath.substring(normalizedPath.length + 1);

      // 如果相对路径中还有 '/'，说明是更深层的子项，不是直接子项
      return !relativePath.includes('/');
    });
  }

  // 检查路径是否存在
  async exists(path: string): Promise<boolean> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);
    const entry = await this.db!.get('files', normalizedPath);
    return !!entry;
  }

  // 获取文件状态
  async stat(path: string): Promise<FileSystemEntry | null> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);
    return await this.db!.get('files', normalizedPath) || null;
  }

  // 删除文件或目录
  async rm(path: string, recursive = false): Promise<void> {
    await this.initialize();
    const normalizedPath = this.normalizePath(path);
    const entry = await this.db!.get('files', normalizedPath);
    
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, '${path}'`);
    }

    if (entry.type === 'directory') {
      const children = await this.readdir(normalizedPath);
      if (children.length > 0 && !recursive) {
        throw new Error(`EEXIST: directory not empty, '${path}'`);
      }
      // 递归删除子项
      for (const child of children) {
        await this.rm(child.path, true);
      }
    }

    await this.db!.delete('files', normalizedPath);
  }

  // 重命名/移动
  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.initialize();
    const normalizedOldPath = this.normalizePath(oldPath);
    const normalizedNewPath = this.normalizePath(newPath);
    
    const entry = await this.db!.get('files', normalizedOldPath);
    if (!entry) {
      throw new Error(`ENOENT: no such file or directory, '${oldPath}'`);
    }

    // 删除旧条目，创建新条目
    await this.db!.delete('files', normalizedOldPath);
    
    entry.path = normalizedNewPath;
    entry.name = normalizedNewPath.split('/').pop() || '';
    entry.modifiedAt = Date.now();
    
    await this.db!.put('files', entry);
  }

  // 搜索文件
  async search(query: string): Promise<FileSystemEntry[]> {
    await this.initialize();
    const allFiles = await this.db!.getAll('files');
    const lowerQuery = query.toLowerCase();
    
    return allFiles.filter(entry => 
      entry.name.toLowerCase().includes(lowerQuery)
    );
  }

  // 清空文件系统
  async clear(): Promise<void> {
    await this.initialize();
    await this.db!.clear('files');
    await this.mkdir('/sandbox');
  }

  // 获取存储使用情况
  async getStorageInfo(): Promise<{ used: number; total: number }> {
    await this.initialize();
    const allFiles = await this.db!.getAll('files');
    const used = allFiles.reduce((sum, entry) => sum + entry.size, 0);
    return { used, total: 1024 * 1024 * 1024 }; // 1GB hint
  }

  private normalizePath(path: string): string {
    let normalized = path.replace(/\/+/g, '/');
    if (!normalized.startsWith('/')) {
      normalized = '/sandbox/' + normalized;
    }
    return normalized;
  }
}

// 单例导出
export const fileSystem = new FileSystem();
