import { useTranslation } from 'react-i18next';
import { BarChart3 } from 'lucide-react';
import { Button } from '../ui/button';
import { ChevronRight, MessageSquare, FolderTree, Rabbit } from '../icons';

type TabType = 'agents' | 'sessions' | 'files' | 'stats';

interface CollapsedSidebarProps {
  activeTab: TabType;
  onExpand: (tab: TabType) => void;
}

export function CollapsedSidebar({ activeTab, onExpand }: CollapsedSidebarProps) {
  const { t } = useTranslation();

  return (
    <div className="w-12 bg-background border-r border-border flex-col items-center hidden md:flex shadow-elegant">
      <div className="h-14 flex items-center justify-center border-b border-border w-full">
        <Button
          onClick={() => onExpand(activeTab)}
          variant="ghost"
          size="icon"
          title={t('sidebar.expand')}
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex flex-col items-center py-3 gap-2">
        <Button
          onClick={() => onExpand('agents')}
          variant={activeTab === 'agents' ? 'default' : 'ghost'}
          size="icon"
          title={t('sidebar.agents')}
          className="h-9 w-9"
        >
          <Rabbit className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onExpand('sessions')}
          variant={activeTab === 'sessions' ? 'default' : 'ghost'}
          size="icon"
          title={t('sidebar.sessions')}
          className="h-9 w-9"
        >
          <MessageSquare className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onExpand('files')}
          variant={activeTab === 'files' ? 'default' : 'ghost'}
          size="icon"
          title={t('sidebar.files')}
          className="h-9 w-9"
        >
          <FolderTree className="w-4 h-4" />
        </Button>
        <Button
          onClick={() => onExpand('stats')}
          variant={activeTab === 'stats' ? 'default' : 'ghost'}
          size="icon"
          title={t('sidebar.stats')}
          className="h-9 w-9"
        >
          <BarChart3 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
