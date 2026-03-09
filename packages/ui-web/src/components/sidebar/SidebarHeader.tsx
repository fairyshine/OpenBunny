import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronLeft, MessageSquare, Plus, FolderOpen, FolderTree, Rabbit, Network } from '../icons';
import { Button } from '../ui/button';
import type { FC } from 'react';
import { FolderPlus } from 'lucide-react';

type TabType = 'agents' | 'sessions' | 'files';

interface SidebarHeaderProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onCollapse: () => void;
  onCreateProject: () => void;
  onCreateSession: () => void;
  onCreateAgent: () => void;
  onCreateGroup?: () => void;
  onOpenGraph?: () => void;
}

const TAB_CONFIG: { key: TabType; icon: FC<{ className?: string }>; labelKey: string }[] = [
  { key: 'agents', icon: Rabbit, labelKey: 'sidebar.agents' },
  { key: 'sessions', icon: MessageSquare, labelKey: 'sidebar.sessions' },
  { key: 'files', icon: FolderTree, labelKey: 'sidebar.files' },
];

export function SidebarHeader({ activeTab, onTabChange, onCollapse, onCreateProject, onCreateSession, onCreateAgent, onCreateGroup, onOpenGraph }: SidebarHeaderProps) {
  const { t } = useTranslation();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!dropdownOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    return () => window.removeEventListener('mousedown', handlePointerDown);
  }, [dropdownOpen]);

  const currentTab = TAB_CONFIG.find((tab) => tab.key === activeTab)!;
  const CurrentIcon = currentTab.icon;

  return (
    <div className="h-14 border-b border-border flex items-center justify-between px-3 shrink-0">
      <div
        ref={dropdownRef}
        className="relative"
        onMouseEnter={() => setDropdownOpen(true)}
        onMouseLeave={() => setDropdownOpen(false)}
      >
        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/50 transition-colors"
        >
          <CurrentIcon className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold tracking-tight">
            {t(currentTab.labelKey as any)}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {dropdownOpen && (
          <div className="absolute top-full left-0 w-44 pt-1 z-50">
            <div className="bg-popover border border-border rounded-md shadow-md py-1">
              {TAB_CONFIG.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { onTabChange(tab.key); setDropdownOpen(false); }}
                    className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm transition-colors ${
                      activeTab === tab.key ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {t(tab.labelKey as any)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        {activeTab === 'agents' && (
          <>
            <Button
              onClick={onOpenGraph}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('sidebar.agent.allGraph')}
            >
              <Network className="w-4 h-4" />
            </Button>
            <Button
              onClick={onCreateGroup}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('sidebar.agent.createGroup')}
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
            <Button
              onClick={onCreateAgent}
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title={t('sidebar.agent.create')}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </>
        )}
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
