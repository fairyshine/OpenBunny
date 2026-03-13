import { useTranslation } from 'react-i18next';
import { Folder, File as FileIcon, Plus, Upload, X } from '../../icons';
import { Button } from '../../ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../../ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { ViewMode } from './types';

interface ToolbarProps {
  viewMode: ViewMode;
  selectMode: boolean;
  selectedCount: number;
  gridPath: string;
  // Handlers
  onStartCreate: (parentPath: string, type: 'folder' | 'file') => void;
  onSetViewMode: (mode: ViewMode) => void;
  onToggleSelectMode: () => void;
  onExitSelectMode: () => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBatchDelete: () => void;
  onRefresh: () => void;
  onUploadFiles: (files: FileList, dest: string) => void;
}

export function Toolbar({
  viewMode, selectMode, selectedCount, gridPath,
  onStartCreate, onSetViewMode,
  onToggleSelectMode, onExitSelectMode,
  onSelectAll, onDeselectAll, onBatchDelete, onRefresh, onUploadFiles,
}: ToolbarProps) {
  const { t } = useTranslation();
  const dest = viewMode === 'grid' ? gridPath : '/shared/root';

  return (
    <TooltipProvider>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => onStartCreate(dest, 'folder')} variant="ghost" size="icon" className="h-7 w-7">
              <Folder className="w-3.5 h-3.5 text-yellow-500" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fileTree.newFolder')}</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button onClick={() => onStartCreate(dest, 'file')} variant="ghost" size="icon" className="h-7 w-7">
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fileTree.newFile')}</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Upload className="w-3.5 h-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>{t('fileTree.upload')}</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="start" className="min-w-[140px]">
            <DropdownMenuItem onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              input.multiple = true;
              input.onchange = async (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) onUploadFiles(files, dest);
              };
              input.click();
            }} className="gap-2 text-xs">
              <FileIcon className="w-3.5 h-3.5" />
              {t('fileTree.uploadFiles')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              const input = document.createElement('input');
              input.type = 'file';
              (input as any).webkitdirectory = true;
              input.onchange = async (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) onUploadFiles(files, dest);
              };
              input.click();
            }} className="gap-2 text-xs">
              <Folder className="w-3.5 h-3.5" />
              {t('fileTree.uploadFolder')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="flex-1" />

        {/* Select mode toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onToggleSelectMode}
              variant={selectMode ? 'default' : 'ghost'}
              size="icon"
              className={`h-7 w-7 ${selectMode ? 'bg-primary text-primary-foreground' : ''}`}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <path strokeLinecap="round" d="M7 14h0M7 18h0M14 6h6M14 12h6M14 18h6" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fileTree.selectMode')}</TooltipContent>
        </Tooltip>

        {/* View mode toggle */}
        <div className="flex items-center bg-muted rounded p-0.5">
          <button
            onClick={() => onSetViewMode('list')}
            className={`p-1 rounded transition-colors ${viewMode === 'list' ? 'bg-background shadow-sm' : 'hover:bg-background/50'}`}
            title={t('fileTree.listView')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => onSetViewMode('grid')}
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
            <Button onClick={onRefresh} variant="ghost" size="icon" className="h-7 w-7">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('fileTree.refresh')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Batch action bar */}
      {selectMode && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border shrink-0 bg-muted/30">
          <span className="text-xs text-muted-foreground mr-1">
            {selectedCount > 0 ? t('fileTree.selected', { count: selectedCount }) : t('fileTree.selectMode')}
          </span>
          <div className="flex-1" />
          <Button
            onClick={() => selectedCount > 0 ? onDeselectAll() : onSelectAll()}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
          >
            {selectedCount > 0 ? t('fileTree.deselectAll') : t('fileTree.selectAll')}
          </Button>
          {selectedCount > 0 && (
            <Button
              onClick={onBatchDelete}
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              {t('fileTree.batchDelete')}
            </Button>
          )}
          <Button onClick={onExitSelectMode} variant="ghost" size="icon" className="h-6 w-6">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      )}
    </TooltipProvider>
  );
}
