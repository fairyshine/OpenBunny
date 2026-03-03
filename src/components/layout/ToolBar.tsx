import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '../../stores/settings';
import { toolRegistry } from '../../services/tools/registry';
import { ITool } from '../../services/tools/base';
import { Badge } from '../ui/badge';
import { ToolIcon } from '../ToolIcon';

export default function ToolBar() {
  const { t } = useTranslation();
  const { enabledTools, toggleTool } = useSettingsStore();
  const allTools = toolRegistry.getAll();

  return (
    <div className="flex items-center gap-1 px-2 md:px-4 py-2 border-b border-border bg-muted/50 overflow-x-auto">
      <span className="text-xs text-muted-foreground mr-2 font-medium hidden sm:inline">{t('tools.label')}</span>
      <div className="flex items-center gap-1 flex-nowrap">
        {allTools.map((tool: ITool) => (
          <Badge
            key={tool.metadata.id}
            onClick={() => toggleTool(tool.metadata.id)}
            variant={enabledTools.includes(tool.metadata.id) ? 'default' : 'outline'}
            className={`cursor-pointer transition-all whitespace-nowrap ${
              !enabledTools.includes(tool.metadata.id) ? 'opacity-60' : ''
            }`}
            title={tool.metadata.description}
          >
            <ToolIcon icon={tool.metadata.icon} className="w-3.5 h-3.5 mr-1" />
            <span>{tool.metadata.name}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
