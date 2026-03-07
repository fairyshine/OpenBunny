import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, MessageSquare, Plus, FolderOpen, FolderTree } from '../icons';
import { Button } from '../ui/button';
import { useState } from 'react';

type TabType = 'sessions' | 'files';

interface SidebarHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onCollapse: () => void;
  onCreateProject: () => void;
  onCreateSession: () => void;
}

export function SidebarHeader({ activeTab, onTabChange, onCollapse, onCreateProject, onCreateSession }: SidebarHeaderProps) {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-3 shrink-0">
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          {activeTab === 'sessions' ? (
            <MessageSquare className="w-4 h-4 text-muted-foreground" />
          ) : (
            <FolderTree className="w-4 h-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold tracking-tight">
            {activeTab === 'sessions' ? t('sidebar.sessions') : t('sidebar.files')}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-1 w-44 bg-popover border border-border rounded-md shadow-md z-50 py-1">
              <button
                onClick={() => { onTabChange('sessions'); setDropdownOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                  activeTab === 'sessions' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                {t('sidebar.sessions')}
              </button>
              <button
                onClick={() => { onTabChange('files'); setDropdownOpen(false); }}
                className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                  activeTab === 'files' ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                }`}
              >
                <FolderTree className="w-4 h-4" />
                {t('sidebar.files')}
              </button>
            </div>
          </>
        )}
      </div>
      <div className="flex items-center gap-1">
        {activeTab === 'sessions' && (
          <>
            <Button
              onClick={onCreateProject}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('sidebar.createProject')}
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
            <Button
              onClick={onCreateSession}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('header.newSession')}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </>
        )}
        <Button
          onClick={onCollapse}
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={t('sidebar.collapse')}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
