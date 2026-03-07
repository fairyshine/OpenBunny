import React from 'react';
import { FileSystemEntry } from '@shared/services/filesystem';
import { Folder, File as FileIcon, Check } from '../../icons';
import { TreeNode } from './types';
import { getFileColor, getFileExt, formatSize } from './utils';
import { InlineInput } from './InlineInput';

interface GridItemProps {
  entry: TreeNode;
  // State
  selectedPath?: string;
  selectedPaths: Set<string>;
  dropTarget: string | null;
  draggedPath: string | null;
  renaming: { path: string; name: string } | null;
  selectMode: boolean;
  filteredGrid: TreeNode[];
  // Handlers
  onSelectFile?: (path: string) => void;
  onItemClick?: () => void;
  onGridNavigate: (path: string) => void;
  onSelectClick: (e: React.MouseEvent, path: string, flatList: string[], isDirectory?: boolean) => void;
  onRenameSubmit: (name: string) => void;
  onRenameCancel: () => void;
  onContextMenu: (e: React.MouseEvent, entry: FileSystemEntry) => void;
  // Drag
  isDragRecent: () => boolean;
  onDragStart: (e: React.DragEvent, path: string) => void;
  onDragEnd: () => void;
  onDragEnter: (e: React.DragEvent, path: string, isDirectory: boolean) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent, path: string, isDirectory: boolean) => void;
  onDrop: (e: React.DragEvent, targetPath: string, isDirectory: boolean) => void;
}

export const GridItem = React.memo(function GridItem({
  entry,
  selectedPath, selectedPaths, dropTarget, draggedPath,
  renaming, selectMode, filteredGrid,
  onSelectFile, onItemClick, onGridNavigate, onSelectClick,
  onRenameSubmit, onRenameCancel, onContextMenu,
  isDragRecent, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop,
}: GridItemProps) {
  const isSelected = selectedPath === entry.path;
  const isChecked = selectedPaths.has(entry.path);
  const isDragOver = dropTarget === entry.path;
  const isDragged = draggedPath === entry.path;
  const isRenamingHere = renaming?.path === entry.path;

  return (
    <div
      draggable={!isRenamingHere && !selectMode}
      onDragStart={(e) => onDragStart(e, entry.path)}
      onDragEnd={onDragEnd}
      onDragEnter={(e) => onDragEnter(e, entry.path, entry.type === 'directory')}
      onDragLeave={onDragLeave}
      onDragOver={(e) => onDragOver(e, entry.path, entry.type === 'directory')}
      onDrop={(e) => onDrop(e, entry.path, entry.type === 'directory')}
      onClick={(e) => {
        if (draggedPath || isDragRecent()) return;
        if (selectMode) {
          onSelectClick(e, entry.path, filteredGrid.map(e => e.path), entry.type === 'directory');
          return;
        }
        if (entry.type === 'directory') { onGridNavigate(entry.path); }
        else { onSelectFile?.(entry.path); onItemClick?.(); }
      }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, entry); }}
      className={`group flex flex-col items-center gap-0.5 p-1.5 rounded-lg cursor-pointer transition-all duration-150 select-none relative ${
        isChecked ? 'bg-primary/20' : isSelected ? 'bg-primary/15' : 'hover:bg-muted/60'
      } ${isDragOver && entry.type === 'directory' ? 'bg-primary/10 ring-2 ring-primary/40' : ''} ${
        isDragged ? 'opacity-50 scale-95' : ''
      }`}
    >
      {/* Checkbox overlay in select mode */}
      {selectMode && (
        <span
          className={`absolute top-1 left-1 w-4 h-4 flex items-center justify-center rounded border transition-colors z-10 ${
            isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 bg-background/80 hover:border-primary'
          }`}
        >
          {isChecked && <Check className="w-3 h-3" />}
        </span>
      )}

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
        <InlineInput
          initialValue={renaming!.name}
          className="w-full px-1 py-0.5 text-[11px] bg-background border border-primary rounded text-center"
          onSubmit={onRenameSubmit}
          onCancel={onRenameCancel}
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
});
