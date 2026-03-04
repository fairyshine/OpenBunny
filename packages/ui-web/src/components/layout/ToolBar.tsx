import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@shared/stores/settings';
import { builtinTools } from '@shared/services/ai/tools';
import { Badge } from '../ui/badge';
import { ToolIcon } from '../ToolIcon';

// Tool metadata for display
const toolDisplayInfo: Record<string, { name: string; description: string; icon: string }> = {
  python: { name: 'Python', description: 'Execute Python code', icon: 'python' },
  web_search: { name: 'Web Search', description: 'Search the web', icon: 'search' },
  calculator: { name: 'Calculator', description: 'Calculate math expressions', icon: 'calculator' },
  file_manager: { name: 'File Manager', description: 'Manage files', icon: 'folder' },
  memory: { name: 'Memory', description: 'Persistent memory', icon: 'brain' },
};

export default function ToolBar() {
  const { t } = useTranslation();
  const { enabledTools, toggleTool } = useSettingsStore();
  const allToolIds = Object.keys(builtinTools);

  return (
    <div className="flex items-center gap-1 px-2 md:px-4 py-2 border-b border-border bg-muted/50 overflow-x-auto">
      <span className="text-xs text-muted-foreground mr-2 font-medium hidden sm:inline">{t('tools.label')}</span>
      <div className="flex items-center gap-1 flex-nowrap">
        {allToolIds.map((toolId) => {
          const info = toolDisplayInfo[toolId] || { name: toolId, description: '', icon: 'wrench' };
          return (
            <Badge
              key={toolId}
              onClick={() => toggleTool(toolId)}
              variant={enabledTools.includes(toolId) ? 'default' : 'outline'}
              className={`cursor-pointer transition-all whitespace-nowrap ${
                !enabledTools.includes(toolId) ? 'opacity-60' : ''
              }`}
              title={info.description}
            >
              <ToolIcon icon={info.icon} className="w-3.5 h-3.5 mr-1" />
              <span>{info.name}</span>
            </Badge>
          );
        })}
      </div>
    </div>
  );
}
