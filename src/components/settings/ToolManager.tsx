// 工具管理组件
// 按工具源类型分类展示，源内按服务器/文件二级分组

import { useState, useMemo } from 'react';
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

const TYPE_LABELS: Record<string, string> = {
  builtin: '内置工具',
  code: '自定义代码',
  http: 'HTTP 远程',
  mcp: 'MCP 服务器',
};

const CODE_TEMPLATE = `// 工具示例：导出一个符合 ITool 接口的对象
export default {
  metadata: {
    id: 'my_tool',
    name: '我的工具',
    description: '工具描述',
  },
  async execute(input, context) {
    return { content: '执行结果: ' + input, type: 'text' };
  },
};
`;

/** 单个工具行：名称 + 描述 + 开关 */
function ToolRow({ tool, enabled, onToggle }: {
  tool: ITool;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2 px-3 hover:bg-accent/50 rounded-md transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <ToolIcon icon={tool.metadata.icon} className="w-6 h-6 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{tool.metadata.name}</p>
          <p className="text-xs text-muted-foreground line-clamp-1">{tool.metadata.description}</p>
        </div>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="flex-shrink-0 ml-3"
      />
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
          {!source.enabled && <Badge variant="outline" className="text-xs">已禁用</Badge>}
          <span className="text-xs text-muted-foreground">({tools.length})</span>
        </div>
        <div className="flex items-center gap-1.5 ml-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <Button onClick={() => toggleSource(source.id)} disabled={loading} variant="ghost" size="sm" className="h-7 text-xs">
            {source.enabled ? '禁用' : '启用'}
          </Button>
          {source.enabled && (
            <Button onClick={() => reloadSource(source.id)} disabled={loading} variant="ghost" size="sm" className="h-7 text-xs">
              重载
            </Button>
          )}
          <Button onClick={() => removeSource(source.id)} disabled={loading} variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
            删除
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
        <p className="px-9 pb-3 text-xs text-muted-foreground">暂无已加载工具</p>
      ) : null}
    </details>
  );
}

export function ToolManager() {
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

  // 内置工具源（来自 registry 而非 tool store）
  const builtinSource: ToolSource = useMemo(() => ({
    id: 'builtin', type: 'builtin', name: '内置工具', source: '', enabled: true,
  }), []);

  // 所有源：内置 + 用户添加的
  const allSources = useMemo(() => [builtinSource, ...sources], [builtinSource, sources]);

  // 按类型分组，每个源下挂载其工具
  const groups = useMemo(() => {
    const typeOrder: ToolSource['type'][] = ['builtin', 'code', 'http', 'mcp'];
    const map = new Map<ToolSource['type'], { source: ToolSource; tools: ITool[] }[]>();

    for (const t of typeOrder) map.set(t, []);

    for (const src of allSources) {
      const tools = toolRegistry.getToolsBySource(src);
      const list = map.get(src.type);
      if (list) list.push({ source: src, tools });
    }

    return typeOrder
      .map(type => ({ type, label: TYPE_LABELS[type], entries: map.get(type)! }))
      .filter(g => g.entries.length > 0);
  }, [allSources]);

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.type) {
      alert('请填写完整信息');
      return;
    }
    try {
      if (newSource.type === 'mcp') {
        if (!newSource.mcpUrl) { alert('请填写服务器地址'); return; }
        await addSource({
          type: 'mcp', name: newSource.name, source: '',
          enabled: true, metadata: { url: newSource.mcpUrl },
        });
      } else if (newSource.type === 'code') {
        if (!newSource.code?.trim()) { alert('请输入工具代码'); return; }
        await addSource({
          type: 'code', name: newSource.name, source: '',
          enabled: true, metadata: { code: newSource.code },
        });
      } else {
        if (!newSource.source) { alert('请填写完整信息'); return; }
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
    // 如果是 code 类型且没有代码，填入模板
    if (!newSource.code) {
      setNewSource(s => ({ ...s, code: CODE_TEMPLATE }));
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <h2 className="text-lg font-semibold">工具管理</h2>
        <Button onClick={resetDialog}>添加工具源</Button>
      </div>

      {error && (
        <div className="mx-4 mt-4">
          <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
        </div>
      )}

      {/* 分类列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          {groups.map(group => (
            <div key={group.type}>
              {/* 一级分类标题 */}
              <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                {group.label}
                <span className="text-xs font-normal text-muted-foreground">
                  ({group.entries.reduce((n, e) => n + e.tools.length, 0)} 个工具)
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

      {/* 添加工具源对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className={newSource.type === 'code' ? 'max-w-2xl' : 'max-w-md'}>
          <DialogHeader>
            <DialogTitle>添加工具源</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">类型</Label>
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
                  <SelectItem value="code">自定义代码</SelectItem>
                  <SelectItem value="http">HTTP URL</SelectItem>
                  <SelectItem value="mcp">MCP 服务器</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name" type="text" value={newSource.name}
                onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                placeholder="例如: 我的自定义工具"
              />
            </div>

            {newSource.type === 'code' && (
              <div className="space-y-2">
                <Label htmlFor="code">工具代码</Label>
                <textarea
                  id="code"
                  value={newSource.code || ''}
                  onChange={e => setNewSource({ ...newSource, code: e.target.value })}
                  className="w-full h-64 p-3 rounded-md border bg-muted/50 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                  spellCheck={false}
                  placeholder={CODE_TEMPLATE}
                />
                <p className="text-xs text-muted-foreground">
                  编写 JavaScript 模块，通过 export default 导出符合 ITool 接口的对象
                </p>
              </div>
            )}

            {newSource.type === 'mcp' && (
              <div className="space-y-2">
                <Label htmlFor="source">服务器地址</Label>
                <Input
                  id="source" type="text" value={newSource.mcpUrl || ''}
                  onChange={e => setNewSource({ ...newSource, mcpUrl: e.target.value })}
                  placeholder="ws://localhost:3000 或 https://example.com/sse"
                />
                <p className="text-xs text-muted-foreground">支持 WebSocket (ws://) 和 SSE (http/https) 协议</p>
              </div>
            )}

            {newSource.type === 'http' && (
              <div className="space-y-2">
                <Label htmlFor="source">URL</Label>
                <Input
                  id="source" type="text" value={newSource.source}
                  onChange={e => setNewSource({ ...newSource, source: e.target.value })}
                  placeholder="https://example.com/tool.js"
                />
                <p className="text-xs text-muted-foreground">工具定义的 HTTP URL</p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button onClick={() => setShowAddDialog(false)} variant="outline">取消</Button>
            <Button onClick={handleAddSource} disabled={loading}>添加</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
