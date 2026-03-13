import { useTranslation } from 'react-i18next';
import { SessionType } from '@openbunny/shared/types';
import { HardDrive, MessageSquare, Globe, Lightbulb } from '../icons';

export type SessionTypeFilter = 'all' | SessionType;

const SESSION_TYPE_ICONS: Record<SessionTypeFilter, React.FC<{ className?: string }>> = {
  all: HardDrive,
  user: MessageSquare,
  agent: Globe,
  mind: Lightbulb,
};

export const SESSION_TYPE_FILTERS: SessionTypeFilter[] = ['all', 'user', 'agent', 'mind'];

interface SessionTypeFilterBarProps {
  value: SessionTypeFilter;
  onChange: (filter: SessionTypeFilter) => void;
}

export function SessionTypeFilterBar({ value, onChange }: SessionTypeFilterBarProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-4 mx-2 mt-2 mb-1 bg-muted/50 rounded-md p-1 shrink-0">
      {SESSION_TYPE_FILTERS.map((filter) => {
        const Icon = SESSION_TYPE_ICONS[filter];
        return (
          <button
            key={filter}
            onClick={() => onChange(filter)}
            className={`flex items-center justify-center gap-1 text-xs px-1 py-1.5 rounded-sm transition-colors ${
              value === filter
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="w-3 h-3" />
            {t(`sidebar.sessionType.${filter}`)}
          </button>
        );
      })}
    </div>
  );
}

export { SESSION_TYPE_ICONS };
