import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileSystemEntry } from '@openbunny/shared/services/filesystem';
import { Folder, File as FileIcon, ChevronRight, ChevronDown, Check } from '../../icons';
import { TreeNode } from './types';
import { getFileColor, formatSize, flattenVisible } from './utils';
import { InlineInput } from './InlineInput';

interface TreeItemProps {
  entry: TreeNode;
  depth?: number;
  // State
  expandedPaths: Set<string>;
  selectedPath?: string;
  selectedPaths: Set<string>;
  dropTarget: string | null;
  draggedPath: string | null;
  renaming: { path: string; name: string } | null;
  creating: { path: string; type: 'folder' | 'file' } | null;
  selectMode: boolean;
  filteredTree: TreeNode[];
  // Handlers
  onToggleExpand: (entry: TreeNode) => void;
  onSelectFile?: (path: string) => void;
  onItemClick?: () => void;
  onSelectClick: (e: React.MouseEvent, path: string, flatList: string[], isDirectory?: boolean) => void;
  onRenameSubmit: (name: string) => void;
  onRenameCancel: () => void;
  onCreateSubmit: (name: string) => void;
  onCreateCancel: () => void;
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

export const TreeItem = React.memo(function TreeItem({
  entry, depth = 0,
  expandedPaths, selectedPath, selectedPaths, dropTarget, draggedPath,
  renaming, creating, selectMode, filteredTree,
  onToggleExpand, onSelectFile, onItemClick, onSelectClick,
  onRenameSubmit, onRenameCancel, onCreateSubmit, onCreateCancel,
  onContextMenu,
  isDragRecent, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOver, onDrop,
}: TreeItemProps) {
  const { t } = useTranslation();
  const isExpanded = expandedPaths.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isChecked = selectedPaths.has(entry.path);
  const isDragOver = dropTarget === entry.path;
  const isDragged = draggedPath === entry.path;
  const isRenamingHere = renaming?.path === entry.path;
  const isCreatingHere = creating?.path === entry.path;

  const flatList = flattenVisible(filteredTree, expandedPaths);

  return (
    <div>
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
            onSelectClick(e, entry.path, flatList, entry.type === 'directory');
            return;
          }
          if (entry.type === 'directory') { onToggleExpand(entry); }
          else { onSelectFile?.(entry.path); onItemClick?.(); }
        }}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, entry); }}
        className={`group flex items-center gap-1.5 px-2 py-[5px] cursor-pointer transition-all duration-150 rounded-sm mx-1 ${
          isChecked ? 'bg-primary/20 text-foreground' : isSelected ? 'bg-primary/15 text-foreground' : 'hover:bg-muted/60'
        } ${isDragOver && entry.type === 'directory' ? 'bg-primary/10 ring-2 ring-primary/40 ring-inset' : ''} ${
          isDragged ? 'opacity-50 scale-95' : ''
        }`}
        style={{ paddingLeft: `${4 + depth * 16}px` }}
      >
        {/* Checkbox in select mode */}
        {selectMode ? (
          <span
            onClick={(e) => { e.stopPropagation(); onSelectClick(e, entry.path, flatList, entry.type === 'directory'); }}
            className={`w-4 h-4 flex items-center justify-center shrink-0 rounded border transition-colors ${
              isChecked ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'
            }`}
          >
            {isChecked && <Check className="w-3 h-3" />}
          </span>
        ) : entry.type === 'directory' ? (
          <span onClick={(e) => { e.stopPropagation(); onToggleExpand(entry); }} className="w-4 h-4 flex items-center justify-center shrink-0 transition-transform">
            {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
          </span>
        ) : <span className="w-4 shrink-0" />}

        {entry.type === 'directory' ? (
          <Folder className={`w-4 h-4 shrink-0 ${isExpanded ? 'text-yellow-500' : 'text-yellow-600/80'}`} />
        ) : (
          <FileIcon className={`w-4 h-4 shrink-0 ${getFileColor(entry.name)}`} />
        )}

        {isRenamingHere ? (
          <InlineInput
            initialValue={renaming!.name}
            className="flex-1 px-1 py-0.5 text-sm bg-background border border-primary rounded min-w-0"
            onSubmit={onRenameSubmit}
            onCancel={onRenameCancel}
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
          <span className="w-4 shrink-0" />
          {creating!.type === 'folder' ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileIcon className="w-4 h-4 text-primary shrink-0" />}
          <InlineInput
            initialValue=""
            placeholder={creating!.type === 'folder' ? t('fileManager.folderName') : t('fileManager.fileName')}
            className="flex-1 px-1 py-0.5 text-sm bg-background border border-primary rounded min-w-0"
            onSubmit={onCreateSubmit}
            onCancel={onCreateCancel}
          />
        </div>
      )}

      {entry.type === 'directory' && isExpanded && entry.children && (
        <div>
          {entry.children.map(child => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              selectedPath={selectedPath}
              selectedPaths={selectedPaths}
              dropTarget={dropTarget}
              draggedPath={draggedPath}
              renaming={renaming}
              creating={creating}
              selectMode={selectMode}
              filteredTree={filteredTree}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
              onItemClick={onItemClick}
              onSelectClick={onSelectClick}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              onCreateSubmit={onCreateSubmit}
              onCreateCancel={onCreateCancel}
              onContextMenu={onContextMenu}
              isDragRecent={isDragRecent}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}
            />
          ))}
        </div>
      )}
    </div>
  );
});
