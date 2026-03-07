import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { fileSystem, FileSystemEntry } from '@shared/services/filesystem';
import { TreeNode, ViewMode } from './types';

export function useFileTree() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('filetree-view') as ViewMode) || 'list'; } catch { return 'list'; }
  });
  const [gridPath, setGridPath] = useState('/root');
  const [gridEntries, setGridEntries] = useState<TreeNode[]>([]);

  const [creating, setCreating] = useState<{ path: string; type: 'folder' | 'file' } | null>(null);
  const creatingRef = useRef(creating);
  creatingRef.current = creating;

  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null);

  const isDraggingRef = useRef(false);

  const loadDirectory = useCallback(async (path: string): Promise<TreeNode[]> => {
    try {
      const entries = await fileSystem.readdir(path);
      return entries
        .sort((a, b) => {
          if (a.type === 'directory' && b.type !== 'directory') return -1;
          if (a.type !== 'directory' && b.type === 'directory') return 1;
          return a.name.localeCompare(b.name);
        }).map(entry => ({
          ...entry,
          children: entry.type === 'directory' ? [] : undefined,
          isExpanded: expandedPaths.has(entry.path)
        }));
    } catch (error) {
      console.error('Failed to load directory:', error);
      return [];
    }
  }, [expandedPaths]);

  const loadTree = useCallback(async () => {
    setIsLoading(true);
    await fileSystem.initialize();

    const buildTree = async (path: string): Promise<TreeNode[]> => {
      const entries = await loadDirectory(path);
      for (const entry of entries) {
        if (entry.type === 'directory' && expandedPaths.has(entry.path)) {
          entry.children = await buildTree(entry.path);
        }
      }
      return entries;
    };

    setTree(await buildTree('/root'));
    setIsLoading(false);
  }, [loadDirectory, expandedPaths]);

  useEffect(() => {
    if (!isDraggingRef.current && !creatingRef.current) loadTree();
  }, [loadTree]);

  // Grid view: load flat entries for current path
  useEffect(() => {
    if (viewMode === 'grid') {
      loadDirectory(gridPath).then(setGridEntries);
    }
  }, [viewMode, gridPath, loadDirectory, tree]);

  const setViewModeAndPersist = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('filetree-view', mode); } catch { /* ignore */ }
  }, []);

  const toggleExpand = useCallback(async (entry: TreeNode) => {
    const newExpanded = new Set(expandedPaths);
    if (newExpanded.has(entry.path)) {
      newExpanded.delete(entry.path);
    } else {
      newExpanded.add(entry.path);
      if (!entry.children?.length) {
        entry.children = await loadDirectory(entry.path);
      }
    }
    setExpandedPaths(newExpanded);
    await loadTree();
  }, [expandedPaths, loadDirectory, loadTree]);

  const startCreate = useCallback((parentPath: string, type: 'folder' | 'file') => {
    if (!expandedPaths.has(parentPath)) {
      const newExpanded = new Set(expandedPaths);
      newExpanded.add(parentPath);
      setExpandedPaths(newExpanded);
    }
    setCreating({ path: parentPath, type });
  }, [expandedPaths]);

  const handleCreateSubmit = useCallback(async (name: string) => {
    const cur = creatingRef.current;
    setCreating(null);
    if (!cur || !name.trim()) return;
    try {
      const newPath = `${cur.path}/${name.trim()}`;
      if (cur.type === 'folder') { await fileSystem.mkdir(newPath); }
      else { await fileSystem.writeFile(newPath, ''); }
      setExpandedPaths(prev => { const next = new Set(prev); next.add(cur.path); return next; });
    } catch (error) {
      alert(t('fileManager.createFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
    await loadTree();
  }, [loadTree, t]);

  const startRename = useCallback((entry: FileSystemEntry) => {
    setRenaming({ path: entry.path, name: entry.name });
  }, []);

  const handleRenameSubmit = useCallback(async (name: string) => {
    const cur = renaming;
    setRenaming(null);
    if (!cur || !name.trim()) return;
    try {
      const parentPath = cur.path.substring(0, cur.path.lastIndexOf('/')) || '/root';
      const newPath = `${parentPath}/${name.trim()}`;
      if (newPath !== cur.path) { await fileSystem.rename(cur.path, newPath); await loadTree(); }
    } catch (error) {
      alert(t('fileManager.renameFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
  }, [renaming, loadTree, t]);

  const handleDelete = useCallback(async (entry: FileSystemEntry) => {
    if (!confirm(t('fileManager.confirmDelete', { name: entry.name }))) return;
    try { await fileSystem.rm(entry.path, entry.type === 'directory'); await loadTree(); }
    catch (error) { alert(t('fileManager.deleteFailed', { error: error instanceof Error ? error.message : String(error) })); }
  }, [loadTree, t]);

  const handleDownload = useCallback(async (entry: FileSystemEntry) => {
    if (entry.type !== 'file') return;
    try {
      const blob = await fileSystem.readFile(entry.path);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = entry.name; a.click();
      URL.revokeObjectURL(url);
    } catch (error) { alert(t('fileManager.downloadFailed', { error: error instanceof Error ? error.message : String(error) })); }
  }, [t]);

  return {
    tree, isLoading, expandedPaths, setExpandedPaths,
    searchQuery, setSearchQuery,
    viewMode, setViewModeAndPersist,
    gridPath, setGridPath, gridEntries,
    creating, setCreating, startCreate, handleCreateSubmit,
    renaming, setRenaming, startRename, handleRenameSubmit,
    handleDelete, handleDownload,
    toggleExpand, loadTree, loadDirectory,
    isDraggingRef,
  };
}
