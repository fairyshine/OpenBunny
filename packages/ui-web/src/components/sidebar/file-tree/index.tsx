import { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { fileSystem, FileSystemEntry } from '@shared/services/filesystem';
import { Folder, File as FileIcon, Search, X } from '../../icons';
import { Input } from '../../ui/input';
import { Button } from '../../ui/button';
import { FileTreeProps } from './types';
import { filterTree, flattenVisible } from './utils';
import { useFileTree } from './use-file-tree';
import { useDragDrop } from './use-drag-drop';
import { useMultiSelect } from './use-multi-select';
import { InlineInput } from './InlineInput';
import { TreeItem } from './TreeItem';
import { GridItem } from './GridItem';
import { GridBreadcrumb } from './GridBreadcrumb';
import { Toolbar } from './Toolbar';
import { ContextMenu } from './ContextMenu';

export default function FileTree({ onSelectFile, selectedPath, onItemClick }: FileTreeProps) {
  const { t } = useTranslation();

  const ft = useFileTree();
  const dd = useDragDrop(ft.expandedPaths, ft.setExpandedPaths, ft.loadTree);
  const ms = useMultiSelect(ft.tree, ft.loadTree);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry: FileSystemEntry } | null>(null);

  // Filtered data
  const filteredTree = filterTree(ft.tree, ft.searchQuery);
  const filteredGrid = ft.searchQuery
    ? ft.gridEntries.filter(e => e.name.toLowerCase().includes(ft.searchQuery.toLowerCase()))
    : ft.gridEntries;

  // Upload handler
  const handleUploadFiles = useCallback(async (files: FileList, dest: string) => {
    for (const file of Array.from(files)) {
      const relativePath = (file as any).webkitRelativePath as string;
      const filePath = relativePath ? `${dest}/${relativePath}` : `${dest}/${file.name}`;
      try { await fileSystem.writeFile(filePath, file); } catch (err) { console.error(err); }
    }
    await ft.loadTree();
  }, [ft.loadTree]);

  // Visible flat list for select-all
  const getVisibleFlatList = useCallback(() => {
    return ft.viewMode === 'list'
      ? flattenVisible(filteredTree, ft.expandedPaths)
      : filteredGrid.map(e => e.path);
  }, [ft.viewMode, filteredTree, filteredGrid, ft.expandedPaths]);

  const rootDir = ft.viewMode === 'grid' ? ft.gridPath : '/root';

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <Toolbar
        viewMode={ft.viewMode}
        selectMode={ms.selectMode}
        selectedCount={ms.selectedPaths.size}
        gridPath={ft.gridPath}
        onStartCreate={ft.startCreate}
        onSetViewMode={ft.setViewModeAndPersist}
        onToggleSelectMode={() => ms.selectMode ? ms.exitSelectMode() : ms.setSelectMode(true)}
        onExitSelectMode={ms.exitSelectMode}
        onSelectAll={() => ms.selectAllVisible(getVisibleFlatList())}
        onDeselectAll={() => ms.setSelectedPaths(new Set())}
        onBatchDelete={ms.handleBatchDelete}
        onRefresh={ft.loadTree}
        onUploadFiles={handleUploadFiles}
      />

      {/* Search Bar */}
      <div className="px-2 py-1.5 shrink-0">
        <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded-md">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <Input
            type="text"
            value={ft.searchQuery}
            onChange={(e) => ft.setSearchQuery(e.target.value)}
            placeholder={t('fileManager.searchFiles')}
            className="flex-1 bg-transparent text-sm border-none h-auto p-0 focus-visible:ring-0"
          />
          {ft.searchQuery && (
            <Button onClick={() => ft.setSearchQuery('')} variant="ghost" size="icon" className="h-5 w-5">
              <X className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Grid breadcrumb */}
      {ft.viewMode === 'grid' && <GridBreadcrumb gridPath={ft.gridPath} onNavigate={ft.setGridPath} />}

      {/* Create Input (root-level) */}
      {ft.creating?.path === rootDir && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 mx-1 rounded-sm" style={{ paddingLeft: '4px' }}>
          <span className="w-4 shrink-0" />
          {ft.creating.type === 'folder' ? <Folder className="w-4 h-4 text-yellow-500 shrink-0" /> : <FileIcon className="w-4 h-4 text-blue-500 shrink-0" />}
          <InlineInput
            initialValue=""
            placeholder={ft.creating.type === 'folder' ? t('fileManager.folderName') : t('fileManager.fileName')}
            className="flex-1 h-7 text-sm px-2 bg-background border border-primary rounded"
            onSubmit={ft.handleCreateSubmit}
            onCancel={() => ft.setCreating(null)}
          />
        </div>
      )}

      {/* Content Area */}
      <div
        className="flex-1 overflow-y-auto"
        onDragOver={(e: any) => {
          e.preventDefault();
          if (dd.draggedPath) { e.dataTransfer.dropEffect = 'move'; dd.setDropTarget(rootDir); }
          else if (e.dataTransfer.types.includes('Files')) { e.dataTransfer.dropEffect = 'copy'; dd.setDropTarget(rootDir); }
        }}
        onDragLeave={() => dd.setDropTarget(null)}
        onDrop={(e: any) => dd.handleDrop(e, rootDir, true)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, entry: { path: rootDir, name: rootDir.split('/').pop() || 'root', type: 'directory', size: 0, createdAt: 0, modifiedAt: 0 } });
        }}
      >
        {ft.isLoading ? (
          <div className="text-center py-8 text-muted-foreground text-sm">{t('common.loading')}</div>
        ) : ft.viewMode === 'list' ? (
          /* List View */
          filteredTree.length === 0 && !ft.creating ? (
            <div data-filetree-blank className="text-center py-8 text-muted-foreground text-sm">
              {ft.searchQuery ? t('fileManager.noResults') : t('fileManager.emptyFolderShort')}
            </div>
          ) : (
            <div data-filetree-blank className="py-0.5 min-h-full">
              {filteredTree.map(entry => (
                <TreeItem
                  key={entry.path}
                  entry={entry}
                  expandedPaths={ft.expandedPaths}
                  selectedPath={selectedPath}
                  selectedPaths={ms.selectedPaths}
                  dropTarget={dd.dropTarget}
                  draggedPath={dd.draggedPath}
                  renaming={ft.renaming}
                  creating={ft.creating}
                  selectMode={ms.selectMode}
                  filteredTree={filteredTree}
                  onToggleExpand={ft.toggleExpand}
                  onSelectFile={onSelectFile}
                  onItemClick={onItemClick}
                  onSelectClick={ms.handleSelectClick}
                  onRenameSubmit={ft.handleRenameSubmit}
                  onRenameCancel={() => ft.setRenaming(null)}
                  onCreateSubmit={ft.handleCreateSubmit}
                  onCreateCancel={() => ft.setCreating(null)}
                  onContextMenu={(e, entry) => { setContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
                  isDragRecent={dd.isDragRecent}
                  onDragStart={dd.handleDragStart}
                  onDragEnd={dd.handleDragEnd}
                  onDragEnter={dd.handleDragEnter}
                  onDragLeave={dd.handleDragLeave}
                  onDragOver={dd.handleDragOver}
                  onDrop={dd.handleDrop}
                />
              ))}
            </div>
          )
        ) : (
          /* Grid View */
          filteredGrid.length === 0 && !ft.creating ? (
            <div data-filetree-blank className="text-center py-8 text-muted-foreground text-sm">
              {ft.searchQuery ? t('fileManager.noResults') : t('fileManager.emptyFolderShort')}
            </div>
          ) : (
            <div data-filetree-blank className="grid grid-cols-4 gap-0.5 p-1.5 content-start">
              {filteredGrid.map(entry => (
                <GridItem
                  key={entry.path}
                  entry={entry}
                  selectedPath={selectedPath}
                  selectedPaths={ms.selectedPaths}
                  dropTarget={dd.dropTarget}
                  draggedPath={dd.draggedPath}
                  renaming={ft.renaming}
                  selectMode={ms.selectMode}
                  filteredGrid={filteredGrid}
                  onSelectFile={onSelectFile}
                  onItemClick={onItemClick}
                  onGridNavigate={ft.setGridPath}
                  onSelectClick={ms.handleSelectClick}
                  onRenameSubmit={ft.handleRenameSubmit}
                  onRenameCancel={() => ft.setRenaming(null)}
                  onContextMenu={(e, entry) => { setContextMenu({ x: e.clientX, y: e.clientY, entry }); }}
                  isDragRecent={dd.isDragRecent}
                  onDragStart={dd.handleDragStart}
                  onDragEnd={dd.handleDragEnd}
                  onDragEnter={dd.handleDragEnter}
                  onDragLeave={dd.handleDragLeave}
                  onDragOver={dd.handleDragOver}
                  onDrop={dd.handleDrop}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Drop overlay */}
      {dd.dropTarget === rootDir && dd.draggedPath === null && (
        <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary/30 rounded-lg flex items-center justify-center pointer-events-none z-10">
          <div className="text-sm text-primary/60 font-medium">{t('fileManager.emptyFolder')}</div>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && createPortal(
        <ContextMenu
          contextMenu={contextMenu}
          onClose={() => setContextMenu(null)}
          selectMode={ms.selectMode}
          selectedPaths={ms.selectedPaths}
          viewMode={ft.viewMode}
          onSelectFile={onSelectFile}
          onGridNavigate={ft.setGridPath}
          onStartCreate={ft.startCreate}
          onStartRename={ft.startRename}
          onDelete={ft.handleDelete}
          onDownload={ft.handleDownload}
          onBatchDelete={ms.handleBatchDelete}
        />,
        document.body
      )}
    </div>
  );
}
