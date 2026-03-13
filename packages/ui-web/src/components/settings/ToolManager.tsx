import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RefreshCw, Plus, Trash2, Plug2 } from 'lucide-react';
import { useSettingsStore } from '@openbunny/shared/stores/settings';
import { useToolStore, type MCPConnection, type MCPTransportType, type MCPToolDescriptor } from '@openbunny/shared/stores/tools';
import { discoverMCPConnection, getMCPToolId } from '@openbunny/shared/services/ai/mcp';
import { useAgentConfig } from '../../hooks/useAgentConfig';
import { builtinTools } from '@openbunny/shared/services/ai/tools';
import { detectPlatform } from '@openbunny/shared/platform/detect';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { ToolIcon, toolDisplayInfo } from '../ToolIcon';
import { MemoryViewer } from '../memory/MemoryViewer';

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
    execLoginShell,
    setExecLoginShell,
  } = useSettingsStore();
  const [showMemoryViewer, setShowMemoryViewer] = useState(false);

  const tool = builtinTools[toolId as keyof typeof builtinTools];
  const display = toolDisplayInfo[toolId] || { name: toolId, icon: 'wrench' };
  const description = tool ? (tool as any).description || '' : '';

  const isWebSearch = toolId === 'web_search';
  const isPython = toolId === 'python';
  const isMemory = toolId === 'memory';
  const isExec = toolId === 'exec';

  const platform = detectPlatform();
  const execAvailable = platform.isDesktop && (platform.os === 'macos' || platform.os === 'linux');
  const execDisabled = isExec && !execAvailable;

  return (
    <div>
      <div className="flex items-center justify-between py-2 px-3 hover:bg-accent/50 rounded-md transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ToolIcon icon={display.icon} className={`w-6 h-6 flex-shrink-0${execDisabled ? ' opacity-50' : ''}`} />
          <div className="flex-1 min-w-0">
            <p className={`font-medium text-sm${execDisabled ? ' opacity-50' : ''}`}>{display.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {execDisabled ? t('tools.exec.desktopOnly') : description}
            </p>
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
            disabled={execDisabled}
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
                <SelectItem value="exa_free">Exa (Free)</SelectItem>
                <SelectItem value="exa">Exa (API Key)</SelectItem>
                <SelectItem value="brave">Brave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {searchProvider === 'exa_free' && (
            <p className="text-xs text-muted-foreground">
              {t('settings.exaFreeHint')}
            </p>
          )}

          {searchProvider === 'exa' && (
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
          )}

          {searchProvider === 'brave' && (
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

      {isExec && enabled && !execDisabled && (
        <div className="px-3 pb-3 pt-1 bg-muted/30 rounded-md mx-3 mb-2">
          <div className="flex items-start justify-between p-3 border rounded-lg bg-background">
            <div className="space-y-1 flex-1">
              <Label className="text-xs font-medium">{t('settings.execLoginShell')}</Label>
              <p className="text-xs text-muted-foreground">
                {t('settings.execLoginShellDesc')}
              </p>
            </div>
            <Switch
              checked={execLoginShell}
              onCheckedChange={setExecLoginShell}
              className="flex-shrink-0 ml-3"
            />
          </div>
        </div>
      )}

      {isMemory && <MemoryViewer isOpen={showMemoryViewer} onClose={() => setShowMemoryViewer(false)} />}
    </div>
  );
}

function getConnectionBadgeVariant(status: MCPConnection['status']): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'connected':
      return 'default';
    case 'connecting':
      return 'secondary';
    default:
      return 'outline';
  }
}

function MCPToolRow({
  tool,
  connectionName,
  enabled,
  onToggle,
}: {
  tool: MCPToolDescriptor;
  connectionName: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-background px-3 py-2">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 min-w-0">
          <ToolIcon icon="plug" className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
          <p className="text-sm font-medium truncate">{tool.title || tool.name}</p>
          <Badge variant="outline" className="text-[10px] max-w-[40%] truncate">
            {connectionName}
          </Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
          {tool.description || tool.name}
        </p>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} className="ml-3 flex-shrink-0" />
    </div>
  );
}

export function ToolManager() {
  const { t } = useTranslation();
  const { proxyUrl } = useSettingsStore();
  const { enabledTools, toggleTool } = useAgentConfig();
  const {
    mcpConnections,
    addMCPConnection,
    removeMCPConnection,
    updateMCPStatus,
    setMCPTools,
    setMCPError,
  } = useToolStore();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('http://localhost:3000/mcp');
  const [transport, setTransport] = useState<MCPTransportType>('http');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const builtinToolIds = Object.keys(builtinTools);
  const mcpToolIds = useMemo(
    () => mcpConnections.flatMap((connection) => connection.tools.map((tool) => tool.id)),
    [mcpConnections],
  );
  const availableToolIds = [...builtinToolIds, ...mcpToolIds];
  const enabledAvailableCount = availableToolIds.filter((toolId) => enabledTools.includes(toolId)).length;

  const syncConnection = async (connection: Pick<MCPConnection, 'id' | 'name' | 'url' | 'transport'>) => {
    updateMCPStatus(connection.id, 'connecting');
    setMCPError(connection.id, null);

    try {
      const { descriptors } = await discoverMCPConnection(connection, { proxyUrl });
      setMCPTools(connection.id, descriptors);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateMCPStatus(connection.id, 'disconnected');
      setMCPError(connection.id, message);
      window.alert(message);
    }
  };

  const handleAddConnection = async () => {
    if (!name.trim() || !url.trim()) {
      window.alert(t('tools.mcp.validation') || 'Please enter both a name and an MCP URL.');
      return;
    }

    setIsSubmitting(true);
    const id = addMCPConnection(name.trim(), url.trim(), transport);
    const connection = { id, name: name.trim(), url: url.trim(), transport };

    setName('');
    setUrl('http://localhost:3000/mcp');
    setTransport('http');

    try {
      await syncConnection(connection);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveConnection = (connection: MCPConnection) => {
    const confirmText = t('tools.mcp.removeConfirm', { name: connection.name }) || `Remove MCP server ${connection.name}?`;
    if (!window.confirm(confirmText)) {
      return;
    }

    for (const tool of connection.tools) {
      if (enabledTools.includes(tool.id)) {
        toggleTool(tool.id);
      }
    }
    removeMCPConnection(connection.id);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t('tools.management')}</h2>
        <Badge variant="secondary">
          {enabledAvailableCount}/{availableToolIds.length} {t('tools.enable') || 'enabled'}
        </Badge>
      </div>

      <div className="rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <ToolIcon icon="wrench" className="w-4 h-4" />
            <h3 className="text-sm font-medium">{t('tools.builtin.title') || 'Built-in tools'}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('tools.builtin.desc') || 'Toggle OpenBunny built-in tools for the current agent or workspace.'}
          </p>
        </div>
        <div className="px-3 pb-3 pt-2">
          {builtinToolIds.map(toolId => (
            <ToolRow
              key={toolId}
              toolId={toolId}
              enabled={enabledTools.includes(toolId)}
              onToggle={() => toggleTool(toolId)}
            />
          ))}
        </div>
      </div>

      <div className="rounded-xl border bg-background">
        <div className="border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <Plug2 className="w-4 h-4" />
            <h3 className="text-sm font-medium">{t('tools.mcp.title') || 'Custom MCP tools'}</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('tools.mcp.desc') || 'Add your own MCP server, discover its tools, and enable them here.'}
          </p>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid gap-3 rounded-xl border bg-muted/30 p-3 md:grid-cols-[1.1fr_1.6fr_140px_auto] md:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('tools.sourceName') || 'Name'}</Label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder={t('tools.mcp.namePlaceholder') || 'Local Search'}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">MCP URL</Label>
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="http://localhost:3000/mcp"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{t('tools.mcp.transport') || 'Transport'}</Label>
              <Select value={transport} onValueChange={(value) => setTransport(value as MCPTransportType)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="http">HTTP</SelectItem>
                  <SelectItem value="sse">SSE</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddConnection} disabled={isSubmitting} className="h-9 gap-1.5">
              <Plus className="w-4 h-4" />
              {isSubmitting ? (t('settings.testing') || 'Testing...') : (t('tools.addSource') || 'Add MCP Server')}
            </Button>
          </div>

          <div className="rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {t('tools.mcp.hint') || 'Recommended: use HTTP transport for localhost or when routing through the built-in proxy. On mobile devices, replace localhost with your computer LAN IP.'}
          </div>

          {mcpConnections.length === 0 ? (
            <div className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
              {t('tools.mcp.empty') || 'No custom MCP server added yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {mcpConnections.map((connection) => (
                <div key={connection.id} className="rounded-xl border overflow-hidden">
                  <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium">{connection.name}</p>
                        <Badge variant={getConnectionBadgeVariant(connection.status)}>
                          {connection.status}
                        </Badge>
                        <Badge variant="outline">{connection.transport.toUpperCase()}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">{connection.url}</p>
                      {connection.lastError && (
                        <p className="mt-2 text-xs text-red-500">{connection.lastError}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => syncConnection(connection)} className="gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5" />
                        {t('tools.mcp.refresh') || 'Refresh'}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleRemoveConnection(connection)} className="gap-1.5">
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete') || 'Delete'}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2 p-3">
                    {connection.tools.length === 0 ? (
                      <div className="rounded-lg border border-dashed px-3 py-4 text-xs text-muted-foreground">
                        {t('tools.mcp.noTools') || 'No tools discovered yet. Click refresh to pull tools from this MCP server.'}
                      </div>
                    ) : (
                      connection.tools.map((tool) => (
                        <MCPToolRow
                          key={tool.id}
                          tool={tool}
                          connectionName={connection.name}
                          enabled={enabledTools.includes(getMCPToolId(connection.id, tool.name))}
                          onToggle={() => toggleTool(tool.id)}
                        />
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
