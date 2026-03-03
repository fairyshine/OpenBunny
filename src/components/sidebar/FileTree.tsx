import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { fileSystem, FileSystemEntry } from '../../services/filesystem';
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

export default function FileTree({ onSelectFile, selectedPath, onItemClick }: FileTreeProps) {
  const { t } = useTranslation();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/sandbox']));
  const [searchQuery, setSearchQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileSystemEntry } | null>(null);

  const [creating, setCreating] = useState<{ path: string; type: 'folder' | 'file' } | null>(null);
  const [createName, setCreateName] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);

  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const loadDirectory = useCallback(async (path: string): Promise<TreeNode[]> => {
    try {
      const entries = await fileSystem.readdir(path);
      return entries
        .filter(entry => entry.name !== '.memory')
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

    setTree(await buildTree('/sandbox'));
    setIsLoading(false);
  }, [loadDirectory, expandedPaths]);

  useEffect(() => { loadTree(); }, [loadTree]);

  useEffect(() => {
    if (creating && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creating]);

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

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
    if (!creating || !createName.trim()) {
      setCreating(null);
      return;
    }

    try {
      const newPath = `${creating.path}/${createName.trim()}`;
      if (creating.type === 'folder') {
        await fileSystem.mkdir(newPath);
      } else {
        await fileSystem.writeFile(newPath, '');
      }

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

  const startRename = (entry: FileSystemEntry) => {
    setRenaming({ path: entry.path, name: entry.name });
  };

  const submitRename = async () => {
    if (!renaming || !renaming.name.trim()) {
      setRenaming(null);
      return;
    }

    try {
      const parentPath = renaming.path.substring(0, renaming.path.lastIndexOf('/')) || '/sandbox';
      const newPath = `${parentPath}/${renaming.name.trim()}`;

      if (newPath !== renaming.path) {
        await fileSystem.rename(renaming.path, newPath);
        await loadTree();
      }
    } catch (error) {
      alert(t('fileManager.renameFailed', { error: error instanceof Error ? error.message : String(error) }));
    }

    setRenaming(null);
  };

  const handleDelete = async (entry: FileSystemEntry) => {
    if (!confirm(t('fileManager.confirmDelete', { name: entry.name }))) return;
    try {
      await fileSystem.rm(entry.path, entry.type === 'directory');
      await loadTree();
    } catch (error) {
      alert(t('fileManager.deleteFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const handleDownload = async (entry: FileSystemEntry) => {
    if (entry.type !== 'file') return;
    try {
      const blob = await fileSystem.readFile(entry.path);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = entry.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(t('fileManager.downloadFailed', { error: error instanceof Error ? error.message : String(error) }));
    }
  };

  const handleDragStart = (e: React.DragEvent, path: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', path);
    setDraggedPath(path);
  };

  const handleDragEnd = () => {
    setDraggedPath(null);
    setDropTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, path: string) => {
    e.preventDefault();
    if (draggedPath && draggedPath !== path) {
      setDropTarget(path);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetPath: string, isDirectory: boolean) => {
    e.preventDefault();
    e.stopPropagation();

    const dragged = e.dataTransfer.getData('text/plain') || draggedPath;
    if (!dragged || dragged === targetPath) {
      handleDragEnd();
      return;
    }

    if (e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        try { await fileSystem.writeFile(`${targetPath}/${file.name}`, file); } catch (err) { console.error(err); }
      }
      const newExpanded = new Set(expandedPaths);
      newExpanded.add(targetPath);
      setExpandedPaths(newExpanded);
      await loadTree();
      handleDragEnd();
      return;
    }

    try {
      const draggedName = dragged.split('/').pop()!;
      const newPath = isDirectory
        ? `${targetPath}/${draggedName}`
        : `${targetPath.substring(0, targetPath.lastIndexOf('/')) || '/sandbox'}/${draggedName}`;

      if (newPath !== dragged) {
        await fileSystem.rename(dragged, newPath);
        await loadTree();
      }
    } catch (error) {
      alert(t('fileManager.moveFailed', { error: error instanceof Error ? error.message : String(error) }));
    }

    handleDragEnd();
  };

  const TreeItem = ({ entry, depth = 0 }: { entry: TreeNode; depth?: number }) => {
    const isExpanded = expandedPaths.has(entry.path);
    const isSelected = selectedPath === entry.path;
    const isDragOver = dropTarget === entry.path;
    const isRenamingHere = renaming?.path === entry.path;
    const isCreatingHere = creating?.path === entry.path;

    return (
      <div>
        <div
          draggable={!isRenamingHere}
          onDragStart={(e) => handleDragStart(e, entry.path)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, entry.path)}
          onDrop={(e) => handleDrop(e, entry.path, entry.type === 'directory')}
          onClick={() => {
            if (entry.type === 'directory') {
              toggleExpand(entry);
            } else {
              onSelectFile?.(entry.path);
              onItemClick?.();
            }
          }}
          onContextMenu={(e) => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
          className={`group flex items-center gap-1 px-2 py-1 cursor-pointer transition-colors ${
            isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
          } ${isDragOver ? 'bg-primary/10 border-2 border-primary border-dashed' : ''}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          {entry.type === 'directory' ? (
            <span onClick={(e) => { e.stopPropagation(); toggleExpand(entry); }} className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? <ChevronDown className={`w-3 h-3 ${isSelected ? 'text-white' : ''}`} /> : <ChevronRight className={`w-3 h-3 ${isSelected ? 'text-white' : ''}`} />}
            </span>
          ) : <span className="w-4" />}

          {entry.type === 'directory' ? (
            <Folder className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-yellow-500'}`} />
          ) : (
            <FileIcon className={`w-4 h-4 ${isSelected ? 'text-primary-foreground' : 'text-primary'}`} />
          )}

          {isRenamingHere ? (
            <input
              ref={renameInputRef}
              type="text"
              value={renaming.name}
              onChange={(e) => setRenaming({ ...renaming, name: e.target.value })}
              onKeyDown={(e) => { if (e.key === 'Enter') submitRename(); if (e.key === 'Escape') setRenaming(null); }}
              onBlur={submitRename}
              className="flex-1 px-1 py-0.5 text-sm bg-background border border-primary rounded"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={`text-sm truncate flex-1 ${isSelected ? 'text-white' : ''}`}>{entry.name}</span>
          )}
        </div>

        {isCreatingHere && (
          <div className="flex items-center gap-1 px-2 py-1 bg-primary/5" style={{ paddingLeft: `${8 + (depth + 1) * 16}px` }}>
            {creating.type === 'folder' ? <Folder className="w-4 h-4 text-yellow-500" /> : <FileIcon className="w-4 h-4 text-primary" />}
            <input
              ref={createInputRef}
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreating(null); }}
              placeholder={creating.type === 'folder' ? t('fileManager.folderName') : t('fileManager.fileName')}
              className="flex-1 px-1 py-0.5 text-sm bg-background border border-primary rounded"
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

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar - Fixed */}
      <TooltipProvider>
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => startCreate('/sandbox', 'folder')} variant="ghost" size="icon" className="h-8 w-8">
                <Folder className="w-4 h-4 text-yellow-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.newFolder')}</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => startCreate('/sandbox', 'file')} variant="ghost" size="icon" className="h-8 w-8">
                <Plus className="w-4 h-4" />
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
                    for (const file of files) {
                      try { await fileSystem.writeFile(`/sandbox/${file.name}`, file); } catch (err) { console.error(err); }
                    }
                    await loadTree();
                  }
                };
                input.click();
              }} variant="ghost" size="icon" className="h-8 w-8">
                <Upload className="w-4 h-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.upload')}</TooltipContent>
          </Tooltip>

          <div className="flex-1" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={loadTree} variant="ghost" size="icon" className="h-8 w-8">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.refresh')}</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>

      {/* Search Bar - Fixed */}
      <div className="px-2 py-2 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1.5 bg-muted rounded-lg">
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('fileManager.searchFiles')}
            className="flex-1 bg-transparent text-sm border-none h-auto p-0 focus-visible:ring-0"
          />
          {searchQuery && (
            <Button onClick={() => setSearchQuery('')} variant="ghost" size="icon" className="h-5 w-5">
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Create Input - Fixed (conditional) */}
      {creating?.path === '/sandbox' && (
        <div className="flex items-center gap-1 px-2 py-1 bg-primary/5 shrink-0">
          {creating.type === 'folder' ? <Folder className="w-4 h-4 text-yellow-500" /> : <FileIcon className="w-4 h-4 text-blue-500" />}
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

      {/* File Tree - Scrollable */}
      <div
        className="flex-1 overflow-y-auto"
        onDragOver={(e: any) => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); }}
        onDrop={(e: any) => { if (e.dataTransfer.files.length > 0) handleDrop(e, '/sandbox', true); }}
      >
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
        ) : tree.length === 0 && !creating ? (
          <div className="text-center py-8 text-muted-foreground">{t('fileManager.emptyFolderShort')}</div>
        ) : (
          <div className="py-1">{tree.map(entry => <TreeItem key={entry.path} entry={entry} />)}</div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div className="fixed z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[160px]" style={{ left: contextMenu.x, top: contextMenu.y }}>
            {contextMenu.entry.type === 'file' && (
              <button onClick={() => { onSelectFile?.(contextMenu.entry.path); setContextMenu(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2">
                <FileIcon className="w-4 h-4" /> {t('common.open')}
              </button>
            )}
            {contextMenu.entry.type === 'directory' && (
              <>
                <button onClick={() => { startCreate(contextMenu.entry.path, 'folder'); setContextMenu(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2">
                  <Folder className="w-4 h-4 text-yellow-500" /> {t('fileTree.newFolder')}
                </button>
                <button onClick={() => { startCreate(contextMenu.entry.path, 'file'); setContextMenu(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {t('fileTree.newFile')}
                </button>
                <div className="border-t border-border my-1" />
              </>
            )}
            {contextMenu.entry.type === 'file' && (
              <button onClick={() => { handleDownload(contextMenu.entry); setContextMenu(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2">
                <Download className="w-4 h-4" /> {t('common.download')}
              </button>
            )}
            <button onClick={() => { startRename(contextMenu.entry); setContextMenu(null); }} className="w-full px-3 py-2 text-left text-sm hover:bg-accent flex items-center gap-2">
              <Edit2 className="w-4 h-4" /> {t('common.rename')}
            </button>
            <div className="border-t border-border my-1" />
            <button onClick={() => { handleDelete(contextMenu.entry); setContextMenu(null); }} className="w-full px-3 py-2 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              {t('common.delete')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
