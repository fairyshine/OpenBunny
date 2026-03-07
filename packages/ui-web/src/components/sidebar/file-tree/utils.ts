import { FileSystemEntry_Web, FileSystemFileEntry_Web, FileSystemDirectoryEntry_Web, TreeNode } from './types';

// File extension to color/icon mapping
const EXT_COLORS: Record<string, string> = {
  md: 'text-blue-500', txt: 'text-gray-500', json: 'text-yellow-600',
  js: 'text-yellow-500', ts: 'text-blue-600', tsx: 'text-blue-500', jsx: 'text-blue-400',
  py: 'text-green-600', css: 'text-pink-500', html: 'text-orange-500',
  csv: 'text-green-500', xml: 'text-orange-400', yaml: 'text-red-400', yml: 'text-red-400',
  png: 'text-purple-500', jpg: 'text-purple-500', jpeg: 'text-purple-500', gif: 'text-purple-500',
  svg: 'text-purple-400', pdf: 'text-red-600',
};

export function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_COLORS[ext] || 'text-muted-foreground';
}

export function getFileExt(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() || '';
  return ext.length <= 5 ? ext : '';
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Recursively read all files from a FileSystemEntry (drag-and-drop folder)
export async function readEntryFiles(entry: FileSystemEntry_Web, basePath: string): Promise<{ path: string; file: File }[]> {
  if (entry.isFile) {
    return new Promise((resolve) => {
      (entry as FileSystemFileEntry_Web).file((file) => {
        resolve([{ path: `${basePath}/${entry.name}`, file }]);
      }, () => resolve([]));
    });
  }
  if (entry.isDirectory) {
    const dirPath = `${basePath}/${entry.name}`;
    const dirReader = (entry as FileSystemDirectoryEntry_Web).createReader();
    const entries = await new Promise<FileSystemEntry_Web[]>((resolve) => {
      const all: FileSystemEntry_Web[] = [];
      const readBatch = () => {
        dirReader.readEntries((batch) => {
          if (batch.length === 0) { resolve(all); return; }
          all.push(...batch);
          readBatch();
        }, () => resolve(all));
      };
      readBatch();
    });
    const results: { path: string; file: File }[] = [];
    for (const child of entries) {
      results.push(...await readEntryFiles(child, dirPath));
    }
    return results;
  }
  return [];
}

// Filter tree nodes by search query
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (node.name.toLowerCase().includes(q)) {
      acc.push(node);
    } else if (node.children) {
      const filtered = filterTree(node.children, query);
      if (filtered.length > 0) acc.push({ ...node, children: filtered, isExpanded: true });
    }
    return acc;
  }, []);
}

// Flatten visible tree nodes into ordered list (for shift-click range select)
export function flattenVisible(nodes: TreeNode[], expandedPaths: Set<string>): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.path);
    if (node.type === 'directory' && expandedPaths.has(node.path) && node.children) {
      result.push(...flattenVisible(node.children, expandedPaths));
    }
  }
  return result;
}

// Collect all descendant paths under a directory node
export function collectDescendants(nodes: TreeNode[], targetPath: string): string[] {
  for (const node of nodes) {
    if (node.path === targetPath) {
      const result: string[] = [];
      const collect = (n: TreeNode) => {
        if (n.children) {
          for (const child of n.children) {
            result.push(child.path);
            collect(child);
          }
        }
      };
      collect(node);
      return result;
    }
    if (node.children) {
      const found = collectDescendants(node.children, targetPath);
      if (found.length > 0) return found;
    }
  }
  return [];
}
