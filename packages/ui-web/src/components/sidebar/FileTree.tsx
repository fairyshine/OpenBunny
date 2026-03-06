import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { fileSystem, FileSystemEntry } from '@shared/services/filesystem';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, Search, Plus, Upload, Download, Edit2, X } from '../icons';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface FileTreeProps {
  onSelectFile?: (path: string) => void;
  selectedPath?: string;
  onItemClick?: () => void;
}

interface TreeNode extends FileSystemEntry {
  children?: TreeNode[];
  isExpanded?: boolean;
}

type ViewMode = 'list' | 'grid';

// File extension to color/icon mapping
const EXT_COLORS: Record<string, string> = {
  md: 'text-blue-500', txt: 'text-gray-500', json: 'text-yellow-600',
  js: 'text-yellow-500', ts: 'text-blue-600', tsx: 'text-blue-500', jsx: 'text-blue-400',
  py: 'text-green-600', css: 'text-pink-500', html: 'text-orange-500',
  csv: 'text-green-500', xml: 'text-orange-400', yaml: 'text-red-400', yml: 'text-red-400',
  png: 'text-purple-500', jpg: 'text-purple-500', jpeg: 'text-purple-500', gif: 'text-purple-500',
  svg: 'text-purple-400', pdf: 'text-red-600',
};

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return EXT_COLORS[ext] || 'text-muted-foreground';
}

function getFileExt(name: string): string {
  const ext = name.split('.').pop()?.toUpperCase() || '';
  return ext.length <= 5 ? ext : '';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileTree({ onSelectFile, selectedPath, onItemClick }: FileTreeProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/root']));
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileSystemEntry } | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try { return (localStorage.getItem('filetree-view') as ViewMode) || 'list'; } catch { return 'list'; }
  });

  const [creating, setCreating] = useState<{ path: string; type: 'folder' | 'file' } | null>(null);
  const [createName, setCreateName] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);

  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartTimeRef = useRef(0);

  // Current grid directory path (grid view navigates into folders)
  const [gridPath, setGridPath] = useState('/root');

  const setViewModeAndPersist = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    try { localStorage.setItem('filetree-view', mode); } catch { /* ignore */ }
  }, []);

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

  useEffect(() => { if (!isDraggingRef.current) loadTree(); }, [loadTree]);

  useEffect(() => {
    if (creating && createInputRef.current) createInputRef.current.focus();
  }, [creating]);

  useEffect(() => {
    if (renaming && renameInputRef.current) { renameInputRef.current.focus(); renameInputRef.current.select(); }
  }, [renaming]);

  // --- Grid view: load flat entries for current path ---
  const [gridEntries, setGridEntries] = useState<TreeNode[]>([]);
  useEffect(() => {
    if (viewMode === 'grid') {
      loadDirectory(gridPath).then(setGridEntries);
    }
  }, [viewMode, gridPath, loadDirectory, tree]); // reload when tree refreshes

  // --- Tree operations ---
  const toggleExpand = async (entry: TreeNode) => {
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
  };

  const startCreate = (parentPath: string, type: 'folder' | 'file') => {
    setCreating({ path: parentPath, type });
    setCreateName('');
  };

  const submitCreate = async () => {
    if (!creating || !createName.trim()) { setCreating(null); return; }
    try {
      const newPath = `${creating.path}/${createName.trim()}`;
      if (creating.type === 'folder') { await fileSystem.mkdir(newPath); }
      else { await fileSystem.writeFile(newPath, ''); }
      const newExpanded = new Set(expandedPaths);
      newExpanded.add(creating.path);
      setExpandedPaths(newExpanded);
      await loadTree();
    } catch (error) {
      alert(t('fileManager.createFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
    setCreating(null);
    setCreateName('');
  };

  const startRename = (entry: FileSystemEntry) => { setRenaming({ path: entry.path, name: entry.name }); };

  const submitRename = async () => {
    if (!renaming || !renaming.name.trim()) { setRenaming(null); return; }
    try {
      const parentPath = renaming.path.substring(0, renaming.path.lastIndexOf('/')) || '/root';
      const newPath = `${parentPath}/${renaming.name.trim()}`;
      if (newPath !== renaming.path) { await fileSystem.rename(renaming.path, newPath); await loadTree(); }
    } catch (error) {
      alert(t('fileManager.renameFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
    setRenaming(null);
  };

  const handleDelete = async (entry: FileSystemEntry) => {
    if (!confirm(t('fileManager.confirmDelete', { name: entry.name }))) return;
    try { await fileSystem.rm(entry.path, entry.type === 'directory'); await loadTree(); }
    catch (error) { alert(t('fileManager.deleteFailed', { error: error instanceof Error ? error.message : String(error) })); }
  };

  const handleDownload = async (entry: FileSystemEntry) => {
    if (entry.type !== 'file') return;
    try {
      const blob = await fileSystem.readFile(entry.path);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = entry.name; a.click();
      URL.revokeObjectURL(url);
    } catch (error) { alert(t('fileManager.downloadFailed', { error: error instanceof Error ? error.message : String(error) })); }
  };

  // --- Drag & Drop ---
  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/plain', path);
    isDraggingRef.current = true;
    dragStartTimeRef.current = Date.now();
    // Delay state update to avoid re-render interrupting drag start
    requestAnimationFrame(() => {
      setDraggedPath(path);
    });
  };

  const handleDragEnd = () => {
    setDraggedPath(null);
    setDropTarget(null);
    isDraggingRef.current = false;
    // Keep drag state for a short time to prevent onClick from firing
    setTimeout(() => {
      dragStartTimeRef.current = 0;
    }, 100);
  };

  const handleDragEnter = (e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedPath && draggedPath !== path) {
      if (isDirectory) {
        setDropTarget(path);
      } else {
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/root';
        setDropTarget(parentPath);
      }
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent, path: string, isDirectory: boolean) => {
    e.preventDefault();
    if (draggedPath && draggedPath !== path) {
      e.dataTransfer.dropEffect = 'move';
      // For directories, highlight the folder itself; for files, highlight their parent
      if (isDirectory) {
        setDropTarget(path);
      } else {
        const parentPath = path.substring(0, path.lastIndexOf('/')) || '/root';
        setDropTarget(parentPath);
      }
    } else if (e.dataTransfer.types.includes('Files')) {
      e.dataTransfer.dropEffect = 'copy';
      if (isDirectory) setDropTarget(path);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetPath: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    const dragged = e.dataTransfer.getData('text/plain') || draggedPath;

    // Handle file upload from OS
    if (e.dataTransfer.files.length > 0) {
      const dest = isDirectory ? targetPath : (targetPath.substring(0, targetPath.lastIndexOf('/')) || '/root');
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        try { await fileSystem.writeFile(`${dest}/${file.name}`, file); } catch (err) { console.error(err); }
      }
      const newExpanded = new Set(expandedPaths);
      newExpanded.add(dest);
      setExpandedPaths(newExpanded);
      await loadTree();
      handleDragEnd();
      return;
    }

    if (!dragged || dragged === targetPath) { handleDragEnd(); return; }

    // Prevent dropping parent into its own child
    if (isDirectory && targetPath.startsWith(dragged + '/')) { handleDragEnd(); return; }

    try {
      const draggedName = dragged.split('/').pop()!;
      const destDir = isDirectory ? targetPath : (targetPath.substring(0, targetPath.lastIndexOf('/')) || '/root');
      const newPath = `${destDir}/${draggedName}`;

      if (newPath !== dragged) {
        await fileSystem.rename(dragged, newPath);
        const newExpanded = new Set(expandedPaths);
        newExpanded.add(destDir);
        setExpandedPaths(newExpanded);
        await loadTree();
      }
    } catch (error) {
      alert(t('fileManager.moveFailed', { error: error instanceof Error ? error.message : String(error) }));
    }

    handleDragEnd();
  };

  // --- Tree Item (List View) ---
  const TreeItem = ({ entry, depth = 0 }: { entry: TreeNode; depth?: number }) => {
    const isExpanded = expandedPaths.has(entry.path);
    const isSelected = selectedPath === entry.path;
    const isDragOver = dropTarget === entry.path;
    const isDragged = draggedPath === entry.path;
    const isRenamingHere = renaming?.path === entry.path;
    const isCreatingHere = creating?.path === entry.path;

    return (
      <div>
        <div
          draggable={!isRenamingHere}
          onDragStart={(e) => handleDragStart(e, entry.path)}
          onDragEnd={handleDragEnd}
          onDragEnter={(e) => handleDragEnter(e, entry.path, entry.type === 'directory')}
          onDragLeave={handleDragLeave}
          onDragOver={(e) => handleDragOver(e, entry.path, entry.type === 'directory')}
          onDrop={(e) => handleDrop(e, entry.path, entry.type === 'directory')}
          onClick={() => {
            // Don't trigger click actions during/after drag
            if (draggedPath || (Date.now() - dragStartTimeRef.current < 200)) return;
            if (entry.type === 'directory') { toggleExpand(entry); }
            else { onSelectFile?.(entry.path); onItemClick?.(); }
          }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
          className={`group flex items-center gap-1.5 px-2 py-[5px] cursor-pointer transition-all duration-150 rounded-sm mx-1 ${
            isSelected ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/60'
          } ${isDragOver && entry.type === 'directory' ? 'bg-primary/10 ring-2 ring-primary/40 ring-inset' : ''} ${
            isDragged ? 'opacity-50 scale-95' : ''
          }`}
          style={{ paddingLeft: `${4 + depth * 16}px` }}
        >
          {entry.type === 'directory' ? (
            <span onClick={(e) => { e.stopPropagation(); toggleExpand(entry); }} className="w-4 h-4 flex items-center justify-center shrink-0 transition-transform">
              {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </span>
          ) : <span className="w-4 shrink-0" />}

          {entry.type === 'directory' ? (
            <Folder className={`w-4 h-4 shrink-0 ${isExpanded ? 'text-yellow-500' : 'text-yellow-600/80'}`} />
          ) : (
            <FileIcon className={`w-4 h-4 shrink-0 ${getFileColor(entry.name)}`} />
          )}

          {isRenamingHere ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
              onBlur={submitRename}
              className="flex-1 px-1 py-0.5 text-sm bg-background border border-primary rounded min-w-0"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-sm truncate flex-1 min-w-0">{entry.name}</span>
          )}

          {entry.type === 'file' && !isRenamingHere && (
            <span className="text-[10px] text-muted-foreground/50 shrink-0 hidden group-hover:inline">
              {formatSize(entry.size)}
            </span>
          )}
        </div>

        {isCreatingHere && (
          <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 mx-1 rounded-sm" style={{ paddingLeft: `${4 + (depth + 1) * 16}px` }}>
            {creating.type === 'folder' ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileIcon className="w-4 h-4 text-primary shrink-0" />}
            <input
              ref={createInputRef}
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(null); }}
              placeholder={creating.type === 'folder' ? t('fileManager.folderName') : t('fileManager.fileName')}
              className="flex-1 px-1 py-0.5 text-sm bg-background border border-primary rounded min-w-0"
              onBlur={() => setTimeout(() => setCreating(null), 200)}
            />
          </div>
        )}

        {entry.type === 'directory' && isExpanded && entry.children && (
          <div>{entry.children.map(child => <TreeItem key={child.path} entry={child} depth={depth + 1} />)}</div>
        )}
      </div>
    );
  };

  // --- Grid Item ---
  const GridItem = ({ entry }: { entry: TreeNode }) => {
    const isSelected = selectedPath === entry.path;
    const isDragOver = dropTarget === entry.path;
    const isDragged = draggedPath === entry.path;
    const isRenamingHere = renaming?.path === entry.path;

    return (
      <div
        draggable={!isRenamingHere}
        onDragStart={(e) => handleDragStart(e, entry.path)}
        onDragEnd={handleDragEnd}
        onDragEnter={(e) => handleDragEnter(e, entry.path, entry.type === 'directory')}
        onDragLeave={handleDragLeave}
        onDragOver={(e) => handleDragOver(e, entry.path, entry.type === 'directory')}
        onDrop={(e) => handleDrop(e, entry.path, entry.type === 'directory')}
        onClick={() => {
          // Don't trigger click actions during/after drag
          if (draggedPath || (Date.now() - dragStartTimeRef.current < 200)) return;
          if (entry.type === 'directory') { setGridPath(entry.path); }
          else { onSelectFile?.(entry.path); onItemClick?.(); }
        }}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
        className={`group flex flex-col items-center gap-0.5 p-1.5 rounded-lg cursor-pointer transition-all duration-150 select-none ${
          isSelected ? 'bg-primary/15' : 'hover:bg-muted/60'
        } ${isDragOver && entry.type === 'directory' ? 'bg-primary/10 ring-2 ring-primary/40' : ''} ${
          isDragged ? 'opacity-50 scale-95' : ''
        }`}
      >
        {/* Icon area */}
        <div className="w-8 h-8 flex items-center justify-center shrink-0 relative">
          {entry.type === 'directory' ? (
            <Folder className="w-7 h-7 text-yellow-500" />
          ) : (
            <div className="relative">
              <FileIcon className={`w-7 h-7 ${getFileColor(entry.name)}`} />
              {getFileExt(entry.name) && (
                <span className="absolute -bottom-0.5 -right-1 text-[7px] font-bold leading-none bg-background/80 px-0.5 rounded">
                  {getFileExt(entry.name)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Name */}
        {isRenamingHere ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renaming.name}
            onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
            onBlur={submitRename}
            className="w-full px-1 py-0.5 text-[11px] bg-background border border-primary rounded text-center"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-[11px] text-center w-full truncate leading-tight" title={entry.name}>
            {entry.name}
          </span>
        )}

        {/* File size */}
        {entry.type === 'file' && !isRenamingHere && (
          <span className="text-[9px] text-muted-foreground/50 leading-none">{formatSize(entry.size)}</span>
        )}
      </div>
    );
  };

  // --- Breadcrumb for Grid view ---
  const GridBreadcrumb = () => {
    const parts = gridPath.split('/').filter(Boolean); // ['root', 'subfolder', ...]
    const paths: { name: string; path: string }[] = [];
    let acc = '';
    for (const part of parts) {
      acc += '/' + part;
      paths.push({ name: part, path: acc });
    }

    return (
      <div className="flex items-center gap-0.5 px-2 py-1.5 text-xs text-muted-foreground overflow-x-auto shrink-0 border-b border-border">
        {paths.map((p, i) => (
          <span key={p.path} className="flex items-center gap-0.5 shrink-0">
            {i > 0 && <ChevronRight className="w-3 h-3" />}
            <button
              onClick={() => setGridPath(p.path)}
              className={`hover:text-foreground px-1 py-0.5 rounded transition-colors ${
                p.path === gridPath ? 'text-foreground font-medium' : ''
              }`}
            >
              {p.name}
            </button>
          </span>
        ))}
      </div>
    );
  };

  // Filter entries by search
  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
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
  };

  const filteredTree = filterTree(tree, searchQuery);
  const filteredGrid = searchQuery
    ? gridEntries.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : gridEntries;

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <TooltipProvider>
        <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => startCreate(viewMode === 'grid' ? gridPath : '/root', 'folder')} variant="ghost" size="icon" className="h-7 w-7">
                <Folder className="w-3.5 h-3.5 text-yellow-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.newFolder')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => startCreate(viewMode === 'grid' ? gridPath : '/root', 'file')} variant="ghost" size="icon" className="h-7 w-7">
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.newFile')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.multiple = true;
                input.onchange = async (e) => {
                  const files = (e.target as HTMLInputElement).files;
                  if (files) {
                    const dest = viewMode === 'grid' ? gridPath : '/root';
                    for (const file of files) {
                      try { await fileSystem.writeFile(`${dest}/${file.name}`, file); } catch (err) { console.error(err); }
                    }
                    await loadTree();
                  }
                };
                input.click();
              }} variant="ghost" size="icon" className="h-7 w-7">
                <Upload className="w-3.5 h-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.upload')}</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          {/* View mode toggle */}
          <div className="flex items-center bg-muted rounded p-0.5">
            <button
              onClick={() => setViewModeAndPersist('list')}
              className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
              title={t('fileTree.listView')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setViewModeAndPersist('grid')}
              className={`p-1 rounded transition-colors ${viewMode === 'grid' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
              title={t('fileTree.gridView')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={loadTree} variant="ghost" size="icon" className="h-7 w-7">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.refresh')}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Search Bar */}
      <div className="px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('fileManager.searchFiles')}
            className="flex-1 bg-transparent text-sm border-none h-auto p-0 focus-visible:ring-0"
          />
          {searchQuery && (
            <Button onClick={() => setSearchQuery('')} variant="ghost" size="icon" className="h-5 w-5">
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Grid breadcrumb */}
      {viewMode === 'grid' && <GridBreadcrumb />}

      {/* Create Input (root-level) */}
      {creating?.path === (viewMode === 'grid' ? gridPath : '/root') && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/5 shrink-0">
          {creating.type === 'folder' ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />}
          <Input
            ref={createInputRef}
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(null); }}
            placeholder={creating.type === 'folder' ? t('fileManager.folderName') : t('fileManager.fileName')}
            className="flex-1 h-7 text-sm"
            onBlur={() => setTimeout(() => setCreating(null), 200)}
          />
        </div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 overflow-y-auto"
        onDragOver={(e: any) => {
          e.preventDefault();
          const dir = viewMode === 'grid' ? gridPath : '/root';
          if (draggedPath) { e.dataTransfer.dropEffect = 'move'; setDropTarget(dir); }
          else if (e.dataTransfer.types.includes('Files')) { e.dataTransfer.dropEffect = 'copy'; setDropTarget(dir); }
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e: any) => handleDrop(e, viewMode === 'grid' ? gridPath : '/root', true)}
        onContextMenu={(e) => {
          e.preventDefault();
          const dir = viewMode === 'grid' ? gridPath : '/root';
          setContextMenu({ x: e.clientX, y: e.clientY, entry: { path: dir, name: dir.split('/').pop() || 'root', type: 'directory', size: 0, createdAt: 0, modifiedAt: 0 } });
        }}
      >
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : viewMode === 'list' ? (
          /* List View */
          filteredTree.length === 0 && !creating ? (
            <div data-filetree-blank className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? t('fileManager.noResults') : t('fileManager.emptyFolderShort')}
            </div>
          ) : (
            <div data-filetree-blank className="py-0.5 min-h-full">{filteredTree.map(entry => <TreeItem key={entry.path} entry={entry} />)}</div>
          )
        ) : (
          /* Grid View */
          filteredGrid.length === 0 && !creating ? (
            <div data-filetree-blank className="text-center py-8 text-muted-foreground text-sm">
              {searchQuery ? t('fileManager.noResults') : t('fileManager.emptyFolderShort')}
            </div>
          ) : (
            <div data-filetree-blank className="grid grid-cols-4 gap-0.5 p-1.5 content-start">
              {filteredGrid.map(entry => <GridItem key={entry.path} entry={entry} />)}
            </div>
          )
        )}
      </div>

      {/* Drop overlay */}
      {dropTarget === (viewMode === 'grid' ? gridPath : '/root') && draggedPath === null && (
        <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <div className="text-sm text-primary/60 font-medium">{t('fileManager.emptyFolder')}</div>
        </div>
      )}

      {/* Context Menu — rendered via portal to avoid transform offset issues */}
      {contextMenu && createPortal(
        <ContextMenuPortal contextMenu={contextMenu} onClose={() => setContextMenu(null)}>
            {contextMenu.entry.type === 'file' && (
              <button onClick={() => { onSelectFile?.(contextMenu.entry.path); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                <FileIcon className="w-4 h-4" /> {t('common.open')}
              </button>
            )}
            {contextMenu.entry.type === 'directory' && (
              <>
                {viewMode === 'grid' && (
                  <button onClick={() => { setGridPath(contextMenu.entry.path); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                    <Folder className="w-4 h-4 text-yellow-500" /> {t('common.open')}
                  </button>
                )}
                <button onClick={() => { startCreate(contextMenu.entry.path, 'folder'); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                  <Folder className="w-4 h-4 text-yellow-500" /> {t('fileTree.newFolder')}
                </button>
                <button onClick={() => { startCreate(contextMenu.entry.path, 'file'); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {t('fileTree.newFile')}
                </button>
                <div className="border-t border-border my-1" />
              </>
            )}
            {contextMenu.entry.type === 'file' && (
              <button onClick={() => { handleDownload(contextMenu.entry); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                <Download className="w-4 h-4" /> {t('common.download')}
              </button>
            )}
            <button onClick={() => { startRename(contextMenu.entry); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> {t('common.rename')}
            </button>
            <div className="border-t border-border my-1" />
            <button onClick={() => { handleDelete(contextMenu.entry); setContextMenu(null); }} className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              {t('common.delete')}
            </button>
        </ContextMenuPortal>,
        document.body
      )}
    </div>
  );
}

/** Portal wrapper that measures itself and clamps position within viewport */
function ContextMenuPortal({
  contextMenu,
  onClose,
  children,
}: {
  contextMenu: { x: number; y: number };
  onClose: () => void;
  children: React.ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: contextMenu.x, y: contextMenu.y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 8;
    let x = contextMenu.x;
    let y = contextMenu.y;
    // Clamp right edge
    if (x + rect.width + pad > vw) x = vw - rect.width - pad;
    // Clamp bottom edge — if overflows, show above cursor
    if (y + rect.height + pad > vh) y = Math.max(pad, contextMenu.y - rect.height);
    // Clamp left/top
    if (x < pad) x = pad;
    if (y < pad) y = pad;
    setPos({ x, y });
  }, [contextMenu.x, contextMenu.y]);

  return (
    <>
      <div className="fixed inset-0 z-[9998]" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className="fixed z-[9999] bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{ left: pos.x, top: pos.y }}
      >
        {children}
      </div>
    </>
  );
}
