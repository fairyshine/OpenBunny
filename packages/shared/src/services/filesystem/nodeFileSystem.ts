/// <reference types="node" />

import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { FileSystemEntry, IFileSystem } from './index';

function toVirtualPath(inputPath: string): string {
  const normalized = inputPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  if (normalized === '' || normalized === '.') {
    return '/root';
  }
  if (normalized === '/root' || normalized.startsWith('/root/')) {
    return normalized;
  }
  if (normalized.startsWith('/')) {
    return `/root${normalized}`;
  }
  return `/root/${normalized}`;
}

export class NodeFileSystem implements IFileSystem {
  private initialized = false;

  constructor(private readonly rootDir: string) {}

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await mkdir(this.rootDir, { recursive: true });
    this.initialized = true;
  }

  async mkdir(targetPath: string): Promise<void> {
    await this.initialize();
    await mkdir(this.resolveRealPath(targetPath), { recursive: true });
  }

  async writeFile(targetPath: string, content: Blob | string): Promise<void> {
    await this.initialize();
    const filePath = this.resolveRealPath(targetPath);
    await mkdir(path.dirname(filePath), { recursive: true });

    if (content instanceof Blob) {
      const buffer = Buffer.from(await content.arrayBuffer());
      await writeFile(filePath, buffer);
      return;
    }

    await writeFile(filePath, content, 'utf8');
  }

  async readFile(targetPath: string): Promise<Blob | null> {
    await this.initialize();

    try {
      const buffer = await readFile(this.resolveRealPath(targetPath));
      return new Blob([buffer]);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async readFileText(targetPath: string): Promise<string | null> {
    await this.initialize();

    try {
      return await readFile(this.resolveRealPath(targetPath), 'utf8');
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async readdir(targetPath: string, recursive = false): Promise<FileSystemEntry[]> {
    await this.initialize();
    const baseVirtualPath = this.normalizePath(targetPath);
    const baseRealPath = this.resolveRealPath(baseVirtualPath);

    const items: FileSystemEntry[] = [];

    const walk = async (dirRealPath: string, dirVirtualPath: string) => {
      const dirents = await readdir(dirRealPath, { withFileTypes: true });

      for (const dirent of dirents) {
        const childRealPath = path.join(dirRealPath, dirent.name);
        const childVirtualPath = this.joinVirtualPath(dirVirtualPath, dirent.name);
        const childStat = await stat(childRealPath);
        const entry = this.createEntry(childVirtualPath, dirent.isDirectory() ? 'directory' : 'file', childStat.size, childStat.birthtimeMs, childStat.mtimeMs);

        items.push(entry);

        if (recursive && dirent.isDirectory()) {
          await walk(childRealPath, childVirtualPath);
        }
      }
    };

    try {
      await walk(baseRealPath, baseVirtualPath);
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    return items;
  }

  async exists(targetPath: string): Promise<boolean> {
    await this.initialize();

    try {
      await stat(this.resolveRealPath(targetPath));
      return true;
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  async stat(targetPath: string): Promise<FileSystemEntry | null> {
    await this.initialize();
    const virtualPath = this.normalizePath(targetPath);

    try {
      const itemStat = await stat(this.resolveRealPath(virtualPath));
      return this.createEntry(
        virtualPath,
        itemStat.isDirectory() ? 'directory' : 'file',
        itemStat.size,
        itemStat.birthtimeMs,
        itemStat.mtimeMs,
      );
    } catch (error: any) {
      if (error?.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async rm(targetPath: string, recursive = false): Promise<void> {
    await this.initialize();
    const virtualPath = this.normalizePath(targetPath);
    if (virtualPath === '/root') {
      throw new Error('Cannot remove /root');
    }

    await rm(this.resolveRealPath(virtualPath), { recursive, force: false });
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.initialize();
    const sourcePath = this.resolveRealPath(oldPath);
    const destinationPath = this.resolveRealPath(newPath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await rename(sourcePath, destinationPath);
  }

  async search(query: string): Promise<FileSystemEntry[]> {
    const allEntries = await this.readdir('/root', true);
    const lowerQuery = query.toLowerCase();
    return allEntries.filter((entry) => entry.name.toLowerCase().includes(lowerQuery));
  }

  async clear(): Promise<void> {
    await this.initialize();
    const entries = await readdir(this.rootDir, { withFileTypes: true });

    await Promise.all(entries.map((entry) => (
      rm(path.join(this.rootDir, entry.name), { recursive: true, force: true })
    )));
  }

  async getStorageInfo(): Promise<{ used: number; total: number }> {
    const entries = await this.readdir('/root', true);
    const used = entries.reduce((sum, entry) => sum + entry.size, 0);
    return { used, total: 1024 * 1024 * 1024 };
  }

  private normalizePath(targetPath: string): string {
    const virtualPath = toVirtualPath(targetPath);
    const normalized = path.posix.normalize(virtualPath);
    if (normalized !== '/root' && !normalized.startsWith('/root/')) {
      throw new Error(`Path must stay within /root: ${targetPath}`);
    }
    return normalized;
  }

  private resolveRealPath(targetPath: string): string {
    const virtualPath = this.normalizePath(targetPath);
    const relativePath = virtualPath === '/root' ? '' : virtualPath.slice('/root/'.length);
    const resolved = path.resolve(this.rootDir, relativePath);
    if (resolved !== this.rootDir && !resolved.startsWith(`${this.rootDir}${path.sep}`)) {
      throw new Error(`Path must stay inside Node filesystem root: ${targetPath}`);
    }
    return resolved;
  }

  private joinVirtualPath(basePath: string, childName: string): string {
    return path.posix.join(basePath, childName);
  }

  private createEntry(
    virtualPath: string,
    type: 'file' | 'directory',
    size: number,
    createdAt: number,
    modifiedAt: number,
  ): FileSystemEntry {
    return {
      path: virtualPath,
      name: path.posix.basename(virtualPath),
      type,
      size,
      createdAt: Number.isFinite(createdAt) ? createdAt : modifiedAt,
      modifiedAt,
    };
  }
}
