import { useRef, useState, useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSystemEntry } from '@openbunny/shared/services/filesystem';
import { Folder, File as FileIcon, Plus, Download, Edit2 } from '../../icons';

interface ContextMenuProps {
  contextMenu: { x: number; y: number; entry: FileSystemEntry };
  onClose: () => void;
  // State
  selectMode: boolean;
  selectedPaths: Set<string>;
  viewMode: 'list' | 'grid';
  // Handlers
  onSelectFile?: (path: string) => void;
  onGridNavigate: (path: string) => void;
  onStartCreate: (parentPath: string, type: 'folder' | 'file') => void;
  onStartRename: (entry: FileSystemEntry) => void;
  onDelete: (entry: FileSystemEntry) => void;
  onDownload: (entry: FileSystemEntry) => void;
  onBatchDelete: () => void;
}

export function ContextMenu({
  contextMenu, onClose,
  selectMode, selectedPaths, viewMode,
  onSelectFile, onGridNavigate,
  onStartCreate, onStartRename, onDelete, onDownload, onBatchDelete,
}: ContextMenuProps) {
  const { t } = useTranslation();

  return (
    <ContextMenuPortal contextMenu={contextMenu} onClose={onClose}>
      {/* Batch operations when multiple items selected */}
      {selectMode && selectedPaths.size > 0 ? (
        <>
          <div className="px-3 py-1.5 text-xs text-muted-foreground">
            {t('fileTree.selected', { count: selectedPaths.size })}
          </div>
          <div className="border-t border-border my-1" />
          <button onClick={() => { onBatchDelete(); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            {t('fileTree.batchDelete')}
          </button>
        </>
      ) : (
        <>
          {contextMenu.entry.type === 'file' && (
            <button onClick={() => { onSelectFile?.(contextMenu.entry.path); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
              <FileIcon className="w-4 h-4" /> {t('common.open')}
            </button>
          )}
          {contextMenu.entry.type === 'directory' && (
            <>
              {viewMode === 'grid' && (
                <button onClick={() => { onGridNavigate(contextMenu.entry.path); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                  <Folder className="w-4 h-4 text-yellow-500" /> {t('common.open')}
                </button>
              )}
              <button onClick={() => { onStartCreate(contextMenu.entry.path, 'folder'); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                <Folder className="w-4 h-4 text-yellow-500" /> {t('fileTree.newFolder')}
              </button>
              <button onClick={() => { onStartCreate(contextMenu.entry.path, 'file'); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                <Plus className="w-4 h-4" /> {t('fileTree.newFile')}
              </button>
              <div className="border-t border-border my-1" />
            </>
          )}
          {contextMenu.entry.type === 'file' && (
            <button onClick={() => { onDownload(contextMenu.entry); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
              <Download className="w-4 h-4" /> {t('common.download')}
            </button>
          )}
          {contextMenu.entry.path !== '/shared/root' && (
            <>
              <button onClick={() => { onStartRename(contextMenu.entry); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2">
                <Edit2 className="w-4 h-4" /> {t('common.rename')}
              </button>
              <div className="border-t border-border my-1" />
              <button onClick={() => { onDelete(contextMenu.entry); onClose(); }} className="w-full px-3 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                {t('common.delete')}
              </button>
            </>
          )}
        </>
      )}
    </ContextMenuPortal>
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
    if (x + rect.width + pad > vw) x = vw - rect.width - pad;
    if (y + rect.height + pad > vh) y = Math.max(pad, contextMenu.y - rect.height);
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
