import { FileSystemEntry } from '@shared/services/filesystem';

export interface FileTreeProps {
  onSelectFile?: (path: string) => void;
  selectedPath?: string;
  onItemClick?: () => void;
  onBlankClick?: () => void;
  rootPath?: string;
}

export interface TreeNode extends FileSystemEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
}

export type ViewMode = 'list' | 'grid';

// Browser FileSystem API types (webkitGetAsEntry)
export type FileSystemEntry_Web = { isFile: boolean; isDirectory: boolean; name: string };
export type FileSystemFileEntry_Web = FileSystemEntry_Web & { file: (cb: (f: File) => void, err?: (e: any) => void) => void };
export type FileSystemDirectoryEntry_Web = FileSystemEntry_Web & { createReader: () => { readEntries: (cb: (entries: FileSystemEntry_Web[]) => void, err?: (e: any) => void) => void } };
