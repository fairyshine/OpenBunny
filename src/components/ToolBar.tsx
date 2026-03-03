import { useSettingsStore } from '../stores/settings';
import { toolRegistry } from '../services/tools/registry';
import { ITool } from '../services/tools/base';
import { Badge } from './ui/badge';

export default function ToolBar() {
  const { enabledTools, toggleTool } = useSettingsStore();
  const allTools = toolRegistry.getAll();

  return (
    <div className="flex items-center gap-1 px-2 md:px-4 py-2 border-b border-border bg-muted/50 overflow-x-auto">
      <span className="text-xs text-muted-foreground mr-2 font-medium hidden sm:inline">工具:</span>
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
            <span className="text-sm mr-1">{tool.metadata.icon}</span>
            <span>{tool.metadata.name}</span>
          </Badge>
        ))}
      </div>
    </div>
  );
}
