import { mkdir, open, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface FileBrowserEntry {
  path: string;
  name: string;
  kind: 'file' | 'directory';
  size: number;
  modifiedAt: number;
}

export interface FileBrowserPreview {
  path: string;
  displayPath: string;
  kind: 'text' | 'binary';
  size: number;
  lines: string[];
  truncated: boolean;
}

export interface FileBrowserOpenResult {
  kind: 'file' | 'directory';
  path: string;
  preview?: FileBrowserPreview;
}

export interface FileBrowserTextFile {
  path: string;
  displayPath: string;
  content: string;
  size: number;
}

interface UseFileBrowserOptions {
  rootPath?: string;
}

const PREVIEW_MAX_BYTES = 12 * 1024;
const PREVIEW_MAX_LINES = 12;
const EDIT_MAX_BYTES = 64 * 1024;

function isWithinRoot(rootPath: string, candidatePath: string): boolean {
  const relativePath = path.relative(rootPath, candidatePath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function isSamePathOrDescendant(targetPath: string, basePath: string): boolean {
  const relativePath = path.relative(basePath, targetPath);
  return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
}

function normalizeDisplayPath(rootPath: string, targetPath: string): string {
  if (rootPath === targetPath) return '.';
  const relativePath = path.relative(rootPath, targetPath);
  return relativePath ? `./${relativePath}` : '.';
}

function assertMutablePath(rootPath: string, targetPath: string, operation: 'rename' | 'delete') {
  if (targetPath === rootPath) {
    throw new Error(`Cannot ${operation} the workspace root.`);
  }
}

function detectBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  let suspicious = 0;
  const sample = buffer.subarray(0, Math.min(buffer.length, 1024));

  for (const byte of sample) {
    if (byte === 0) return true;
    const isControl = byte < 7 || (byte > 13 && byte < 32);
    if (isControl) suspicious += 1;
  }

  return suspicious / sample.length > 0.2;
}

async function loadFilePreview(rootPath: string, filePath: string): Promise<FileBrowserPreview> {
  const handle = await open(filePath, 'r');

  try {
    const stats = await handle.stat();
    const buffer = Buffer.alloc(Math.min(stats.size, PREVIEW_MAX_BYTES));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const previewBuffer = buffer.subarray(0, bytesRead);
    const displayPath = normalizeDisplayPath(rootPath, filePath);

    if (detectBinary(previewBuffer)) {
      return {
        path: filePath,
        displayPath,
        kind: 'binary',
        size: stats.size,
        lines: ['Binary file preview is unavailable in TUI.'],
        truncated: stats.size > bytesRead,
      };
    }

    const content = previewBuffer.toString('utf8').replace(/\r\n/g, '\n');
    const lines = content.length === 0
      ? ['(empty file)']
      : content.split('\n').slice(0, PREVIEW_MAX_LINES);

    return {
      path: filePath,
      displayPath,
      kind: 'text',
      size: stats.size,
      lines,
      truncated: stats.size > bytesRead || content.split('\n').length > PREVIEW_MAX_LINES,
    };
  } finally {
    await handle.close();
  }
}

async function loadTextFile(rootPath: string, filePath: string): Promise<FileBrowserTextFile> {
  const stats = await stat(filePath);
  if (stats.size > EDIT_MAX_BYTES) {
    throw new Error(`File is too large for inline TUI editing (${stats.size} bytes, limit ${EDIT_MAX_BYTES}).`);
  }

  const buffer = await readFile(filePath);
  if (detectBinary(buffer)) {
    throw new Error('Binary files cannot be edited inline in TUI.');
  }

  return {
    path: filePath,
    displayPath: normalizeDisplayPath(rootPath, filePath),
    content: buffer.toString('utf8'),
    size: stats.size,
  };
}

function resolveRenameTarget(currentPath: string, sourcePath: string, nextPathOrName: string) {
  const trimmed = nextPathOrName.trim();
  if (!trimmed) {
    throw new Error('New name cannot be empty.');
  }

  if (!trimmed.includes(path.sep) && trimmed !== '.' && trimmed !== '..') {
    return path.join(path.dirname(sourcePath), trimmed);
  }

  return path.resolve(path.isAbsolute(trimmed) ? trimmed : path.join(currentPath, trimmed));
}

function relocatePathAfterRename(targetPath: string, sourcePath: string, nextPath: string) {
  if (!isSamePathOrDescendant(targetPath, sourcePath)) {
    return targetPath;
  }

  const relativePath = path.relative(sourcePath, targetPath);
  return relativePath ? path.join(nextPath, relativePath) : nextPath;
}

export function useFileBrowser({ rootPath }: UseFileBrowserOptions) {
  const root = useMemo(
    () => path.resolve(rootPath || process.cwd()),
    [rootPath],
  );
  const [currentPath, setCurrentPath] = useState(root);
  const [entries, setEntries] = useState<FileBrowserEntry[]>([]);
  const [preview, setPreview] = useState<FileBrowserPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvePath = useCallback((inputPath?: string) => {
    const candidate = inputPath?.trim();
    const nextPath = candidate
      ? path.resolve(path.isAbsolute(candidate) ? candidate : path.join(currentPath, candidate))
      : currentPath;

    if (!isWithinRoot(root, nextPath)) {
      throw new Error(`Path must stay inside workspace root: ${root}`);
    }

    return nextPath;
  }, [currentPath, root]);

  const refresh = useCallback(async (targetPath = currentPath) => {
    setIsLoading(true);
    setError(null);

    try {
      const dirents = await readdir(targetPath, { withFileTypes: true });
      const nextEntries = await Promise.all(dirents.map(async (dirent) => {
        const entryPath = path.join(targetPath, dirent.name);
        const stats = await stat(entryPath);
        return {
          path: entryPath,
          name: dirent.name,
          kind: dirent.isDirectory() ? 'directory' as const : 'file' as const,
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        };
      }));

      nextEntries.sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'directory' ? -1 : 1;
        }
        return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      setEntries(nextEntries);
    } catch (fileError) {
      setEntries([]);
      setError(fileError instanceof Error ? fileError.message : String(fileError));
    } finally {
      setIsLoading(false);
    }
  }, [currentPath]);

  useEffect(() => {
    setCurrentPath(root);
    setPreview(null);
  }, [root]);

  useEffect(() => {
    void refresh(currentPath);
  }, [currentPath, refresh]);

  const changeDirectory = useCallback(async (inputPath?: string) => {
    const nextPath = resolvePath(inputPath);
    const stats = await stat(nextPath);
    if (!stats.isDirectory()) {
      throw new Error(`${normalizeDisplayPath(root, nextPath)} is not a directory.`);
    }

    setCurrentPath(nextPath);
    setPreview(null);
    return nextPath;
  }, [resolvePath, root]);

  const goUp = useCallback(async () => {
    if (currentPath === root) {
      return root;
    }

    const parentPath = path.dirname(currentPath);
    const nextPath = isWithinRoot(root, parentPath) ? parentPath : root;
    setCurrentPath(nextPath);
    setPreview(null);
    return nextPath;
  }, [currentPath, root]);

  const previewFile = useCallback(async (inputPath: string) => {
    const nextPath = resolvePath(inputPath);
    const nextPreview = await loadFilePreview(root, nextPath);
    setPreview(nextPreview);
    return nextPreview;
  }, [resolvePath, root]);

  const openPath = useCallback(async (inputPath: string): Promise<FileBrowserOpenResult> => {
    const nextPath = resolvePath(inputPath);
    const stats = await stat(nextPath);

    if (stats.isDirectory()) {
      setCurrentPath(nextPath);
      setPreview(null);
      return { kind: 'directory', path: nextPath };
    }

    const nextPreview = await loadFilePreview(root, nextPath);
    setPreview(nextPreview);
    return { kind: 'file', path: nextPath, preview: nextPreview };
  }, [resolvePath, root]);

  const readTextFile = useCallback(async (inputPath: string) => {
    const nextPath = resolvePath(inputPath);
    const nextTextFile = await loadTextFile(root, nextPath);
    setPreview(await loadFilePreview(root, nextPath));
    return nextTextFile;
  }, [resolvePath, root]);

  const readContextFile = useCallback(async (inputPath: string) => {
    const nextPath = resolvePath(inputPath);
    return loadTextFile(root, nextPath);
  }, [resolvePath, root]);

  const clearPreview = useCallback(() => {
    setPreview(null);
  }, []);

  const createFile = useCallback(async (inputPath: string, content = '') => {
    const nextPath = resolvePath(inputPath);
    const nextDirectory = path.dirname(nextPath);
    await mkdir(path.dirname(nextPath), { recursive: true });
    await writeFile(nextPath, content, 'utf8');
    setCurrentPath(nextDirectory);
    await refresh(nextDirectory);
    setPreview(await loadFilePreview(root, nextPath));
    return nextPath;
  }, [refresh, resolvePath, root]);

  const createDirectory = useCallback(async (inputPath: string) => {
    const nextPath = resolvePath(inputPath);
    const nextDirectory = path.dirname(nextPath);
    await mkdir(nextPath, { recursive: true });
    setCurrentPath(nextDirectory);
    await refresh(nextDirectory);
    setPreview(null);
    return nextPath;
  }, [refresh, resolvePath]);

  const renamePath = useCallback(async (inputPath: string, nextPathOrName: string) => {
    const currentTargetPath = resolvePath(inputPath);
    assertMutablePath(root, currentTargetPath, 'rename');
    const nextTargetPath = resolveRenameTarget(currentPath, currentTargetPath, nextPathOrName);

    if (!isWithinRoot(root, nextTargetPath)) {
      throw new Error(`Renamed path must stay inside workspace root: ${root}`);
    }

    const nextCurrentPath = relocatePathAfterRename(currentPath, currentTargetPath, nextTargetPath);
    const nextPreviewPath = preview?.path
      ? relocatePathAfterRename(preview.path, currentTargetPath, nextTargetPath)
      : null;

    await mkdir(path.dirname(nextTargetPath), { recursive: true });
    await rename(currentTargetPath, nextTargetPath);
    setCurrentPath(nextCurrentPath);
    await refresh(nextCurrentPath);

    if (nextPreviewPath) {
      const nextPreviewStats = await stat(nextPreviewPath);
      if (nextPreviewStats.isDirectory()) {
        setPreview(null);
      } else {
        setPreview(await loadFilePreview(root, nextPreviewPath));
      }
      return nextTargetPath;
    }

    if (preview) {
      setPreview(preview);
      return nextTargetPath;
    }

    const renamedStats = await stat(nextTargetPath);
    if (renamedStats.isDirectory()) {
      setPreview(null);
    } else {
      setPreview(await loadFilePreview(root, nextTargetPath));
    }

    return nextTargetPath;
  }, [currentPath, preview, refresh, resolvePath, root]);

  const deletePath = useCallback(async (inputPath: string) => {
    const nextPath = resolvePath(inputPath);
    assertMutablePath(root, nextPath, 'delete');
    await rm(nextPath, { recursive: true, force: false });

    const refreshTarget = isSamePathOrDescendant(currentPath, nextPath)
      ? path.dirname(nextPath)
      : currentPath;
    const nextCurrentPath = isWithinRoot(root, refreshTarget) ? refreshTarget : root;

    setCurrentPath(nextCurrentPath);
    await refresh(nextCurrentPath);
    if (preview?.path && isSamePathOrDescendant(preview.path, nextPath)) {
      setPreview(null);
    }
    return nextPath;
  }, [currentPath, preview?.path, refresh, resolvePath, root]);

  const writeTextFile = useCallback(async (inputPath: string, content: string) => {
    const nextPath = resolvePath(inputPath);
    const nextDirectory = path.dirname(nextPath);
    await mkdir(path.dirname(nextPath), { recursive: true });
    await writeFile(nextPath, content, 'utf8');
    setCurrentPath(nextDirectory);
    await refresh(nextDirectory);
    const nextPreview = await loadFilePreview(root, nextPath);
    setPreview(nextPreview);
    return nextPreview;
  }, [refresh, resolvePath, root]);

  return {
    rootPath: root,
    currentPath,
    currentDisplayPath: normalizeDisplayPath(root, currentPath),
    entries,
    preview,
    isLoading,
    error,
    resolvePath,
    changeDirectory,
    goUp,
    openPath,
    readTextFile,
    readContextFile,
    previewFile,
    refresh,
    clearPreview,
    createFile,
    createDirectory,
    renamePath,
    deletePath,
    writeTextFile,
  };
}

export type FileBrowserController = ReturnType<typeof useFileBrowser>;
