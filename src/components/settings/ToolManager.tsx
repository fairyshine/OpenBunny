// 工具管理组件
// 按工具源类型分类展示，源内按服务器/文件二级分组

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useToolStore } from '../../stores/tools';
import { useSettingsStore } from '../../stores/settings';
import { toolRegistry } from '../../services/tools/registry';
import { ToolSource, ITool } from '../../services/tools/base';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { ScrollArea } from '../ui/scroll-area';
import { ToolIcon } from '../ToolIcon';
import { ChevronRight } from 'lucide-react';
import { fileSystem } from '../../services/filesystem';

/** 单个工具行：名称 + 描述 + 开关 */
function ToolRow({ tool, enabled, onToggle }: {
  tool: ITool;
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
  const [showConfig, setShowConfig] = useState(false);
  const [memoryContent, setMemoryContent] = useState<string | null>(null);
  const [diaryList, setDiaryList] = useState<{ name: string; size: number }[]>([]);
  const [memoryLoading, setMemoryLoading] = useState(false);

  const isWebSearch = tool.metadata.id === 'web_search';
  const isPython = tool.metadata.id === 'python';
  const isMemory = tool.metadata.id === 'memory';

  const loadMemoryData = async () => {
    setMemoryLoading(true);
    try {
      await fileSystem.initialize();
      const content = await fileSystem.readFileText('/sandbox/.memory/MEMORY.md');
      setMemoryContent(content);
      const entries = await fileSystem.readdir('/sandbox/.memory');
      const diaries = entries
        .filter(e => e.type === 'file' && e.name !== 'MEMORY.md' && e.name.endsWith('.md'))
        .sort((a, b) => b.name.localeCompare(a.name));
      setDiaryList(diaries.map(d => ({ name: d.name, size: d.size })));
    } catch {
      setMemoryContent(null);
      setDiaryList([]);
    } finally {
      setMemoryLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between py-2 px-3 hover:bg-accent/50 rounded-md transition-colors">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <ToolIcon icon={tool.metadata.icon} className="w-6 h-6 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{tool.metadata.name}</p>
            <p className="text-xs text-muted-foreground line-clamp-1">{tool.metadata.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isWebSearch && (
            <Button
              onClick={() => setShowConfig(!showConfig)}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              {showConfig ? t('common.close') : t('settings.searchProvider')}
            </Button>
          )}
          {isPython && (
            <Button
              onClick={() => setShowConfig(!showConfig)}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              {showConfig ? t('common.close') : t('settings.preloadPython')}
            </Button>
          )}
          {isMemory && (
            <Button
              onClick={() => {
                const next = !showConfig;
                setShowConfig(next);
                if (next) loadMemoryData();
              }}
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
            >
              {showConfig ? t('common.close') : t('tools.memory.viewContent')}
            </Button>
          )}
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            className="flex-shrink-0"
          />
        </div>
      </div>

      {isWebSearch && showConfig && (
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

      {isPython && showConfig && (
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

      {isMemory && showConfig && (
        <div className="px-3 pb-3 pt-1 space-y-3 bg-muted/30 rounded-md mx-3 mb-2">
          {memoryLoading ? (
            <p className="text-xs text-muted-foreground py-2">{t('common.loading')}</p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('tools.memory.memoryContent')}</Label>
                <ScrollArea className="h-32 rounded-md border bg-background p-2">
                  <pre className="text-xs whitespace-pre-wrap font-mono">
                    {memoryContent || t('tools.memory.noMemoryYet')}
                  </pre>
                </ScrollArea>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('tools.memory.diaryList')}</Label>
                <ScrollArea className="h-24 rounded-md border bg-background p-2">
                  {diaryList.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('tools.memory.noDiariesYet')}</p>
                  ) : (
                    <div className="space-y-1">
                      {diaryList.map(d => (
                        <div key={d.name} className="flex items-center justify-between text-xs">
                          <span className="font-mono">{d.name.replace('.md', '')}</span>
                          <span className="text-muted-foreground">
                            {d.size < 1024 ? `${d.size} B` : `${(d.size / 1024).toFixed(1)} KB`}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** 二级分组：单个工具源（一个 MCP 服务器 / 一个代码片段 / 一个 HTTP 源） */
function SourceSection({ source, tools, loading, enabledTools, toggleTool, toggleSource, reloadSource, removeSource }: {
  source: ToolSource;
  tools: ITool[];
  loading: boolean;
  enabledTools: string[];
  toggleTool: (id: string) => void;
  toggleSource: (id: string) => Promise<void>;
  reloadSource: (id: string) => Promise<void>;
  removeSource: (id: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const subtitle = source.type === 'mcp' && source.metadata?.url
    ? source.metadata.url as string
    : source.type === 'code'
      ? undefined
      : source.source;

  return (
    <details className="group border rounded-lg" open>
      <summary className="cursor-pointer flex items-center justify-between p-3 hover:bg-accent/30 rounded-lg transition-colors">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <ChevronRight className="w-4 h-4 flex-shrink-0 transition-transform group-open:rotate-90" />
          <span className="text-sm font-medium truncate">{source.name}</span>
          {!source.enabled && <Badge variant="outline" className="text-xs">{t('tools.disabled')}</Badge>}
          <span className="text-xs text-muted-foreground">({tools.length})</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Button onClick={() => toggleSource(source.id)} disabled={loading} variant="ghost" size="sm" className="h-7 text-xs">
            {source.enabled ? t('tools.disable') : t('tools.enable')}
          </Button>
          {source.enabled && (
            <Button onClick={() => reloadSource(source.id)} disabled={loading} variant="ghost" size="sm" className="h-7 text-xs">
              {t('tools.reload')}
            </Button>
          )}
          <Button onClick={() => removeSource(source.id)} disabled={loading} variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
            {t('common.delete')}
          </Button>
        </div>
      </summary>
      {subtitle && (
        <p className="px-9 pb-1 text-xs text-muted-foreground truncate">{subtitle}</p>
      )}
      {tools.length > 0 ? (
        <div className="px-3 pb-3 pt-1">
          {tools.map(tool => (
            <ToolRow
              key={tool.metadata.id}
              tool={tool}
              enabled={enabledTools.includes(tool.metadata.id)}
              onToggle={() => toggleTool(tool.metadata.id)}
            />
          ))}
        </div>
      ) : source.enabled ? (
        <p className="px-9 pb-3 text-xs text-muted-foreground">{t('tools.noTools')}</p>
      ) : null}
    </details>
  );
}

export function ToolManager() {
  const { t } = useTranslation();
  const { sources, loading, error, addSource, removeSource, toggleSource, reloadSource } = useToolStore();
  const { enabledTools, toggleTool } = useSettingsStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSource, setNewSource] = useState<{
    type: ToolSource['type'];
    name: string;
    source: string;
    mcpUrl?: string;
    code?: string;
  }>({ type: 'code', name: '', source: '' });

  const TYPE_LABELS: Record<string, string> = {
    builtin: t('tools.type.builtin'),
    code: t('tools.type.code'),
    http: t('tools.type.http'),
    mcp: t('tools.type.mcp'),
  };

  const CODE_TEMPLATE = t('tools.codeTemplate');

  const builtinSource: ToolSource = useMemo(() => ({
    id: 'builtin', type: 'builtin', name: t('tools.type.builtin'), source: '', enabled: true,
  }), [t]);

  const allSources = useMemo(() => [builtinSource, ...sources], [builtinSource, sources]);

  const groups = useMemo(() => {
    const typeOrder: ToolSource['type'][] = ['builtin', 'code', 'http', 'mcp'];
    const map = new Map<ToolSource['type'], { source: ToolSource; tools: ITool[] }[]>();

    for (const tp of typeOrder) map.set(tp, []);

    for (const src of allSources) {
      const tools = toolRegistry.getToolsBySource(src);
      const list = map.get(src.type);
      if (list) list.push({ source: src, tools });
    }

    return typeOrder
      .map(type => ({ type, label: TYPE_LABELS[type], entries: map.get(type)! }))
      .filter(g => g.entries.length > 0);
  }, [allSources, TYPE_LABELS]);

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.type) {
      alert(t('tools.alert.fillComplete'));
      return;
    }
    try {
      if (newSource.type === 'mcp') {
        if (!newSource.mcpUrl) { alert(t('tools.alert.fillServer')); return; }
        await addSource({
          type: 'mcp', name: newSource.name, source: '',
          enabled: true, metadata: { url: newSource.mcpUrl },
        });
      } else if (newSource.type === 'code') {
        if (!newSource.code?.trim()) { alert(t('tools.alert.fillCode')); return; }
        await addSource({
          type: 'code', name: newSource.name, source: '',
          enabled: true, metadata: { code: newSource.code },
        });
      } else {
        if (!newSource.source) { alert(t('tools.alert.fillComplete')); return; }
        await addSource(newSource as Omit<ToolSource, 'id'>);
      }
      setShowAddDialog(false);
      setNewSource({ type: 'code', name: '', source: '' });
    } catch (err) {
      console.error('Failed to add source:', err);
    }
  };

  const resetDialog = () => {
    setShowAddDialog(true);
    if (!newSource.code) {
      setNewSource(s => ({ ...s, code: CODE_TEMPLATE }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <h2 className="text-lg font-semibold">{t('tools.management')}</h2>
        <Button onClick={resetDialog}>{t('tools.addSource')}</Button>
      </div>

      {error && (
        <div className="mx-4 mt-4">
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {groups.map(group => (
            <div key={group.type}>
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                {group.label}
                <span className="text-xs font-normal text-muted-foreground">
                  {t('tools.toolCount', { count: group.entries.reduce((n, e) => n + e.tools.length, 0) })}
                </span>
              </h3>

              <div className="space-y-2">
                {group.entries.map(({ source, tools }) =>
                  source.type === 'builtin' ? (
                    <div key={source.id} className="border rounded-lg">
                      <div className="px-3 pb-3 pt-2">
                        {tools.map(tool => (
                          <ToolRow
                            key={tool.metadata.id}
                            tool={tool}
                            enabled={enabledTools.includes(tool.metadata.id)}
                            onToggle={() => toggleTool(tool.metadata.id)}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <SourceSection
                      key={source.id}
                      source={source}
                      tools={tools}
                      loading={loading}
                      enabledTools={enabledTools}
                      toggleTool={toggleTool}
                      toggleSource={toggleSource}
                      reloadSource={reloadSource}
                      removeSource={removeSource}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className={newSource.type === 'code' ? 'max-w-2xl' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle>{t('tools.dialog.title')}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">{t('tools.dialog.type')}</Label>
              <Select
                value={newSource.type}
                onValueChange={(value) => {
                  const type = value as ToolSource['type'];
                  setNewSource(s => ({
                    ...s,
                    type,
                    code: type === 'code' && !s.code ? CODE_TEMPLATE : s.code,
                  }));
                }}
              >
                <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="code">{t('tools.dialog.customCode')}</SelectItem>
                  <SelectItem value="http">{t('tools.dialog.httpUrl')}</SelectItem>
                  <SelectItem value="mcp">{t('tools.dialog.mcpServer')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">{t('tools.dialog.name')}</Label>
              <Input
                id="name" type="text" value={newSource.name}
                onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                placeholder={t('tools.dialog.namePlaceholder')}
              />
            </div>

            {newSource.type === 'code' && (
              <div className="space-y-2">
                <Label htmlFor="code">{t('tools.dialog.code')}</Label>
                <textarea
                  id="code"
                  value={newSource.code || ''}
                  onChange={e => setNewSource({ ...newSource, code: e.target.value })}
                  className="w-full h-64 p-3 rounded-md border bg-muted/50 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  spellCheck={false}
                  placeholder={CODE_TEMPLATE}
                />
                <p className="text-xs text-muted-foreground">
                  {t('tools.dialog.codeHint')}
                </p>
              </div>
            )}

            {newSource.type === 'mcp' && (
              <div className="space-y-2">
                <Label htmlFor="source">{t('tools.dialog.serverAddress')}</Label>
                <Input
                  id="source" type="text" value={newSource.mcpUrl || ''}
                  onChange={e => setNewSource({ ...newSource, mcpUrl: e.target.value })}
                  placeholder={t('tools.dialog.serverPlaceholder')}
                />
                <p className="text-xs text-muted-foreground">{t('tools.dialog.serverHint')}</p>
              </div>
            )}

            {newSource.type === 'http' && (
              <div className="space-y-2">
                <Label htmlFor="source">{t('tools.dialog.url')}</Label>
                <Input
                  id="source" type="text" value={newSource.source}
                  onChange={e => setNewSource({ ...newSource, source: e.target.value })}
                  placeholder="https://example.com/tool.js"
                />
                <p className="text-xs text-muted-foreground">{t('tools.dialog.urlHint')}</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setShowAddDialog(false)} variant="outline">{t('common.cancel')}</Button>
            <Button onClick={handleAddSource} disabled={loading}>{t('common.add')}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
