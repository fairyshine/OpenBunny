/**
 * Mobile FileSystem 实现
 * 基于 expo-file-system，实现 IFileSystem 接口
 * 根目录为 documentDirectory/root/
 */

import * as ExpoFS from 'expo-file-system';
import type { IFileSystem, FileSystemEntry } from '@openbunny/shared/services/filesystem';

const FS_ROOT = `${ExpoFS.documentDirectory}root/`;

function normalizePath(path: string): string {
  let normalized = path.replace(/\/+/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = '/root/' + normalized;
  }
  return normalized;
}

function toFullPath(normalizedPath: string): string {
  // /root/foo/bar.txt → documentDirectory/root/foo/bar.txt
  const relativePath = normalizedPath.startsWith('/root')
    ? normalizedPath.slice('/root'.length)
    : normalizedPath;
  return `${FS_ROOT}${relativePath.startsWith('/') ? relativePath.slice(1) : relativePath}`;
}

async function getFileInfo(fullPath: string): Promise<ExpoFS.FileInfo> {
  return ExpoFS.getInfoAsync(fullPath);
}

export class MobileFileSystem implements IFileSystem {
  private isReady = false;

  async initialize(): Promise<void> {
    if (this.isReady) return;

    try {
      const info = await getFileInfo(FS_ROOT);
      if (!info.exists) {
        await ExpoFS.makeDirectoryAsync(FS_ROOT, { intermediates: true });
      }
      this.isReady = true;
      console.log('[MobileFS] Initialized at', FS_ROOT);
    } catch (error) {
      console.error('[MobileFS] Failed to initialize:', error);
      throw error;
    }
  }

  async mkdir(path: string): Promise<void> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    try {
      await ExpoFS.makeDirectoryAsync(fullPath, { intermediates: true });
    } catch (error) {
      // Ignore if already exists
      const info = await getFileInfo(fullPath);
      if (!info.exists) {
        throw error;
      }
    }
  }

  async writeFile(path: string, content: Blob | string): Promise<void> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    // Ensure parent directory exists
    const parentPath = fullPath.substring(0, fullPath.lastIndexOf('/'));
    const parentInfo = await getFileInfo(parentPath);
    if (!parentInfo.exists) {
      await ExpoFS.makeDirectoryAsync(parentPath, { intermediates: true });
    }

    let textContent: string;
    if (content instanceof Blob) {
      textContent = await content.text();
    } else {
      textContent = content;
    }

    await ExpoFS.writeAsStringAsync(fullPath, textContent, {
      encoding: ExpoFS.EncodingType.UTF8,
    });
  }

  async readFile(path: string): Promise<Blob | null> {
    const text = await this.readFileText(path);
    if (text === null) return null;
    return new Blob([text], { type: 'text/plain;charset=utf-8' });
  }

  async readFileText(path: string): Promise<string | null> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    try {
      const info = await getFileInfo(fullPath);
      if (!info.exists || info.isDirectory) {
        return null;
      }
      return await ExpoFS.readAsStringAsync(fullPath, {
        encoding: ExpoFS.EncodingType.UTF8,
      });
    } catch {
      return null;
    }
  }

  async readdir(path: string, recursive = false): Promise<FileSystemEntry[]> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    try {
      const info = await getFileInfo(fullPath);
      if (!info.exists || !info.isDirectory) {
        return [];
      }

      const names = await ExpoFS.readDirectoryAsync(fullPath);
      const entries: FileSystemEntry[] = [];

      for (const name of names) {
        const childFullPath = `${fullPath}/${name}`;
        const childInfo = await getFileInfo(childFullPath);
        const childNormPath = `${normalizedPath}/${name}`;

        const entry: FileSystemEntry = {
          path: childNormPath,
          name,
          type: childInfo.isDirectory ? 'directory' : 'file',
          size: childInfo.exists && !childInfo.isDirectory ? (childInfo.size || 0) : 0,
          createdAt: childInfo.exists ? (childInfo.modificationTime || 0) * 1000 : Date.now(),
          modifiedAt: childInfo.exists ? (childInfo.modificationTime || 0) * 1000 : Date.now(),
        };

        entries.push(entry);

        if (recursive && childInfo.isDirectory) {
          const subEntries = await this.readdir(childNormPath, true);
          entries.push(...subEntries);
        }
      }

      return entries;
    } catch {
      return [];
    }
  }

  async exists(path: string): Promise<boolean> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    try {
      const info = await getFileInfo(fullPath);
      return info.exists;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FileSystemEntry | null> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    try {
      const info = await getFileInfo(fullPath);
      if (!info.exists) return null;

      return {
        path: normalizedPath,
        name: normalizedPath.split('/').pop() || '',
        type: info.isDirectory ? 'directory' : 'file',
        size: !info.isDirectory ? (info.size || 0) : 0,
        createdAt: (info.modificationTime || 0) * 1000,
        modifiedAt: (info.modificationTime || 0) * 1000,
      };
    } catch {
      return null;
    }
  }

  async rm(path: string, recursive = false): Promise<void> {
    await this.initialize();
    const normalizedPath = normalizePath(path);
    const fullPath = toFullPath(normalizedPath);

    const info = await getFileInfo(fullPath);
    if (!info.exists) {
      throw new Error(`ENOENT: no such file or directory, '${path}'`);
    }

    if (info.isDirectory && !recursive) {
      const children = await ExpoFS.readDirectoryAsync(fullPath);
      if (children.length > 0) {
        throw new Error(`EEXIST: directory not empty, '${path}'`);
      }
    }

    await ExpoFS.deleteAsync(fullPath, { idempotent: true });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.initialize();
    const normalizedOldPath = normalizePath(oldPath);
    const normalizedNewPath = normalizePath(newPath);
    const fullOldPath = toFullPath(normalizedOldPath);
    const fullNewPath = toFullPath(normalizedNewPath);

    // Ensure parent of new path exists
    const newParent = fullNewPath.substring(0, fullNewPath.lastIndexOf('/'));
    const parentInfo = await getFileInfo(newParent);
    if (!parentInfo.exists) {
      await ExpoFS.makeDirectoryAsync(newParent, { intermediates: true });
    }

    await ExpoFS.moveAsync({ from: fullOldPath, to: fullNewPath });
  }

  async search(query: string): Promise<FileSystemEntry[]> {
    await this.initialize();
    const allEntries = await this.readdir('/root', true);
    const lowerQuery = query.toLowerCase();
    return allEntries.filter((entry) => entry.name.toLowerCase().includes(lowerQuery));
  }

  async clear(): Promise<void> {
    await this.initialize();
    try {
      await ExpoFS.deleteAsync(FS_ROOT, { idempotent: true });
      await ExpoFS.makeDirectoryAsync(FS_ROOT, { intermediates: true });
    } catch (error) {
      console.error('[MobileFS] Failed to clear:', error);
    }
  }

  async getStorageInfo(): Promise<{ used: number; total: number }> {
    await this.initialize();
    const allEntries = await this.readdir('/root', true);
    const used = allEntries.reduce((sum, entry) => sum + entry.size, 0);
    return { used, total: 1024 * 1024 * 1024 }; // 1GB hint
  }
}

export const mobileFileSystem = new MobileFileSystem();
