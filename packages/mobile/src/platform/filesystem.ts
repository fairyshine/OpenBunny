import * as FileSystem from 'expo-file-system';
import type { IPlatformFS } from '@openbunny/shared/platform';

const SANDBOX_DIR = FileSystem.documentDirectory!;

/**
 * Ensure path is within sandbox
 */
function sandboxPath(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${SANDBOX_DIR}${cleanPath}`;
}

/**
 * React Native filesystem implementation using expo-file-system
 */
export const nativeFS: IPlatformFS = {
  readFile: async (path: string): Promise<string> => {
    try {
      const fullPath = sandboxPath(path);
      const content = await FileSystem.readAsStringAsync(fullPath);
      return content;
    } catch (error) {
      console.error('[FS] readFile failed:', path, error);
      throw new Error(`Failed to read file: ${path}`);
    }
  },

  writeFile: async (path: string, content: string): Promise<void> => {
    try {
      const fullPath = sandboxPath(path);
      await FileSystem.writeAsStringAsync(fullPath, content);
    } catch (error) {
      console.error('[FS] writeFile failed:', path, error);
      throw new Error(`Failed to write file: ${path}`);
    }
  },

  readdir: async (path: string): Promise<string[]> => {
    try {
      const fullPath = sandboxPath(path);
      const entries = await FileSystem.readDirectoryAsync(fullPath);
      return entries;
    } catch (error) {
      console.error('[FS] readdir failed:', path, error);
      throw new Error(`Failed to read directory: ${path}`);
    }
  },

  mkdir: async (path: string): Promise<void> => {
    try {
      const fullPath = sandboxPath(path);
      await FileSystem.makeDirectoryAsync(fullPath, { intermediates: true });
    } catch (error) {
      console.error('[FS] mkdir failed:', path, error);
      throw new Error(`Failed to create directory: ${path}`);
    }
  },

  rm: async (path: string): Promise<void> => {
    try {
      const fullPath = sandboxPath(path);
      await FileSystem.deleteAsync(fullPath, { idempotent: true });
    } catch (error) {
      console.error('[FS] rm failed:', path, error);
      throw new Error(`Failed to delete: ${path}`);
    }
  },

  rename: async (oldPath: string, newPath: string): Promise<void> => {
    try {
      const fullOldPath = sandboxPath(oldPath);
      const fullNewPath = sandboxPath(newPath);
      await FileSystem.moveAsync({ from: fullOldPath, to: fullNewPath });
    } catch (error) {
      console.error('[FS] rename failed:', oldPath, newPath, error);
      throw new Error(`Failed to rename: ${oldPath} -> ${newPath}`);
    }
  },
};
