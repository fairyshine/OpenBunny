// 工具管理组件
// Simplified for AI SDK — built-in tools only, with MCP support

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore } from '@shared/stores/settings';
import { builtinTools } from '@shared/services/ai/tools';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { ToolIcon } from '../ToolIcon';
import { MemoryViewer } from '../memory/MemoryViewer';

// Tool display metadata
const toolDisplayInfo: Record<string, { name: string; icon: string }> = {
  python: { name: 'Python', icon: 'python' },
  web_search: { name: 'Web Search', icon: 'search' },
  calculator: { name: 'Calculator', icon: 'calculator' },
  file_manager: { name: 'File Manager', icon: 'folder' },
  memory: { name: 'Memory', icon: 'brain' },
};

function ToolRow({ toolId, enabled, onToggle }: {
  toolId: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const {
    searchProvider,
    setSearchProvider,
    exaApiKey,
    setExaApiKey,
    braveApiKey,
    setBraveApiKey,
    initializePython,
    setInitializePython,
  } = useSettingsStore();
  const [showMemoryViewer, setShowMemoryViewer] = useState(false);

  const tool = builtinTools[toolId as keyof typeof builtinTools];
  const display = toolDisplayInfo[toolId] || { name: toolId, icon: 'wrench' };
  const description = tool ? (tool as any).description || '' : '';

  const isWebSearch = toolId === 'web_search';
  const isPython = toolId === 'python';
  const isMemory = toolId === 'memory';

  return (
    <div>
      <div className="flex items-center justify-between py-2 px-3 hover:bg-accent/50 rounded-md transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ToolIcon icon={display.icon} className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{display.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isMemory && (
            <Button
              onClick={() => setShowMemoryViewer(true)}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              {t('tools.memory.viewContent')}
            </Button>
          )}
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {isWebSearch && enabled && (
        <div className="px-3 pb-3 pt-1 space-y-3 bg-muted/30 rounded-md mx-3 mb-2">
          <div className="space-y-2">
            <Label htmlFor="searchProvider" className="text-xs font-medium">{t('settings.searchProvider')}</Label>
            <Select
              value={searchProvider}
              onValueChange={(value) => setSearchProvider(value as any)}
            >
              <SelectTrigger id="searchProvider" className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exa">Exa</SelectItem>
                <SelectItem value="brave">Brave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {searchProvider === 'exa' ? (
            <div className="space-y-2">
              <Label htmlFor="exaApiKey" className="text-xs font-medium">{t('settings.exaApiKey')}</Label>
              <Input
                id="exaApiKey"
                type="password"
                value={exaApiKey}
                onChange={(e) => setExaApiKey(e.target.value)}
                placeholder="exa-..."
                className="h-9 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.exaApiKeyHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="braveApiKey" className="text-xs font-medium">{t('settings.braveApiKey')}</Label>
              <Input
                id="braveApiKey"
                type="password"
                value={braveApiKey}
                onChange={(e) => setBraveApiKey(e.target.value)}
                placeholder="BSA..."
                className="h-9 text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t('settings.braveApiKeyHint')}
              </p>
            </div>
          )}
        </div>
      )}

      {isPython && enabled && (
        <div className="px-3 pb-3 pt-1 bg-muted/30 rounded-md mx-3 mb-2">
          <div className="flex items-start justify-between p-3 border rounded-lg bg-background">
            <div className="space-y-1 flex-1">
              <Label className="text-xs font-medium">{t('settings.preloadPython')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.preloadPythonDesc')}
              </p>
            </div>
            <Switch
              checked={initializePython}
              onCheckedChange={setInitializePython}
              className="flex-shrink-0 ml-3"
            />
          </div>
        </div>
      )}

      {isMemory && <MemoryViewer isOpen={showMemoryViewer} onClose={() => setShowMemoryViewer(false)} />}
    </div>
  );
}

export function ToolManager() {
  const { t } = useTranslation();
  const { enabledTools, toggleTool } = useSettingsStore();
  const allToolIds = Object.keys(builtinTools);

  return (
    <div>
      <div className="flex items-center justify-between px-4 md:px-6 pt-4 pb-3">
        <h2 className="text-lg font-semibold">{t('tools.management')}</h2>
        <Badge variant="secondary">
          {enabledTools.length}/{allToolIds.length} {t('tools.enable') || 'enabled'}
        </Badge>
      </div>

      <div className="px-4 md:px-6 pb-4 md:pb-6">
        <div className="border rounded-lg">
          <div className="px-3 pb-3 pt-2">
            {allToolIds.map(toolId => (
              <ToolRow
                key={toolId}
                toolId={toolId}
                enabled={enabledTools.includes(toolId)}
                onToggle={() => toggleTool(toolId)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
