import { useState } from 'react';
import { useSessionStore } from '../stores/session';
import { useSettingsStore } from '../stores/settings';
import { Plus, Trash } from './icons';
import { toolRegistry } from '../services/tools/registry';
import { ToolManager } from './ToolManager';
import ConnectionTest from './ConnectionTest';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Separator } from './ui/separator';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { llmConfig, setLLMConfig } = useSessionStore();
  const {
    initializePython,
    setInitializePython,
    enabledTools,
    toggleTool,
    mcpServers,
    addMCPServer,
    removeMCPServer,
    proxyWorkerUrl,
    setProxyWorkerUrl
  } = useSettingsStore();

  const [newMCPServer, setNewMCPServer] = useState({ name: '', url: '' });

  const handleAddMCPServer = () => {
    if (newMCPServer.name.trim() && newMCPServer.url.trim()) {
      addMCPServer({
        name: newMCPServer.name.trim(),
        url: newMCPServer.url.trim(),
      });
      setNewMCPServer({ name: '', url: '' });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] md:max-w-4xl max-h-[95vh] md:max-h-[85vh] p-0 gap-0">
        <DialogHeader className="px-4 md:px-6 pt-4 md:pt-6 pb-3 md:pb-4 border-b">
          <DialogTitle className="text-lg md:text-xl">⚙️ 设置</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="llm" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 md:px-6 pt-3 md:pt-4">
            <TabsList className="grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1">
              <TabsTrigger value="llm" className="text-xs sm:text-sm px-2">LLM</TabsTrigger>
              <TabsTrigger value="test" className="text-xs sm:text-sm px-2">测试</TabsTrigger>
              <TabsTrigger value="tools" className="text-xs sm:text-sm px-2">工具</TabsTrigger>
              <TabsTrigger value="toolmanager" className="text-xs sm:text-sm px-2">管理</TabsTrigger>
              <TabsTrigger value="mcp" className="text-xs sm:text-sm px-2">MCP</TabsTrigger>
              <TabsTrigger value="general" className="text-xs sm:text-sm px-2">通用</TabsTrigger>
            </TabsList>
          </div>

          <ScrollArea className="flex-1 px-4 md:px-6 pb-4 md:pb-6">
            <TabsContent value="llm" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="provider" className="text-sm font-medium">提供商</Label>
                  <Select
                    value={llmConfig.provider}
                    onValueChange={(value) => setLLMConfig({ provider: value as any })}
                  >
                    <SelectTrigger id="provider" className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="custom">自定义</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="apiKey" className="text-sm font-medium">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={llmConfig.apiKey}
                    onChange={(e) => setLLMConfig({ apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="h-10"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model" className="text-sm font-medium">模型</Label>
                  <Input
                    id="model"
                    type="text"
                    value={llmConfig.model}
                    onChange={(e) => setLLMConfig({ model: e.target.value })}
                    placeholder="gpt-4"
                    className="h-10"
                  />
                </div>

                {llmConfig.provider === 'custom' && (
                  <div className="space-y-2">
                    <Label htmlFor="baseUrl" className="text-sm font-medium">Base URL</Label>
                    <Input
                      id="baseUrl"
                      type="text"
                      value={llmConfig.baseUrl || ''}
                      onChange={(e) => setLLMConfig({ baseUrl: e.target.value })}
                      placeholder="https://api.openai.com/v1"
                      className="h-10"
                    />
                  </div>
                )}

                <Separator />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="temperature" className="text-sm font-medium">
                      温度: <span className="text-primary font-semibold">{llmConfig.temperature}</span>
                    </Label>
                    <input
                      id="temperature"
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={llmConfig.temperature}
                      onChange={(e) => setLLMConfig({ temperature: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>精确 (0)</span>
                      <span>创造 (2)</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxTokens" className="text-sm font-medium">最大 Token</Label>
                    <Input
                      id="maxTokens"
                      type="number"
                      value={llmConfig.maxTokens}
                      onChange={(e) => setLLMConfig({ maxTokens: parseInt(e.target.value) || 4096 })}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="test" className="mt-4">
              <ConnectionTest />
            </TabsContent>

            <TabsContent value="tools" className="space-y-4 mt-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  💡 启用或禁用可用的工具。工具可以在对话中通过命令或自动触发。
                </p>
              </div>

              <div className="space-y-3">
                {toolRegistry.getAll().map((tool) => (
                  <div
                    key={tool.metadata.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-3xl flex-shrink-0">{tool.metadata.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{tool.metadata.name}</p>
                        <p className="text-sm text-muted-foreground line-clamp-2">{tool.metadata.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabledTools.includes(tool.metadata.id)}
                      onCheckedChange={() => toggleTool(tool.metadata.id)}
                      className="flex-shrink-0 ml-4"
                    />
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="toolmanager" className="mt-4 -mx-6">
              <div className="h-[calc(85vh-200px)]">
                <ToolManager />
              </div>
            </TabsContent>

            <TabsContent value="mcp" className="space-y-4 mt-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground">
                  🔌 配置 MCP (Model Context Protocol) 服务器以扩展 Agent 能力。
                </p>
              </div>

              {mcpServers.length > 0 && (
                <div className="space-y-2">
                  {mcpServers.map((server) => (
                    <div
                      key={server.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{server.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{server.url}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMCPServer(server.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0 ml-4"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Separator />

              <div className="space-y-3">
                <Label className="text-sm font-medium">添加新服务器</Label>
                <div className="grid grid-cols-1 gap-2">
                  <Input
                    value={newMCPServer.name}
                    onChange={(e) => setNewMCPServer({ ...newMCPServer, name: e.target.value })}
                    placeholder="服务器名称"
                    className="h-10"
                  />
                  <div className="grid grid-cols-[1fr_auto] gap-2">
                    <Input
                      value={newMCPServer.url}
                      onChange={(e) => setNewMCPServer({ ...newMCPServer, url: e.target.value })}
                      placeholder="ws://localhost:3000"
                      className="h-10"
                    />
                    <Button onClick={handleAddMCPServer} size="icon" className="h-10 w-10">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="general" className="space-y-6 mt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proxyUrl" className="text-sm font-medium">CORS 代理 Worker URL</Label>
                  <Input
                    id="proxyUrl"
                    type="text"
                    value={proxyWorkerUrl}
                    onChange={(e) => setProxyWorkerUrl(e.target.value)}
                    placeholder="https://cyberbunny-proxy.your-account.workers.dev"
                    className="h-10"
                  />
                  <p className="text-xs text-muted-foreground">
                    💡 部署 Cloudflare Worker 后填入 URL，解决生产环境 CORS 问题。留空则使用开发代理。
                  </p>
                </div>

                <Separator />

                <div className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                  <div className="space-y-1 flex-1">
                    <Label className="text-sm font-medium">启动时预加载 Python 环境</Label>
                    <p className="text-sm text-muted-foreground">
                      启动时自动初始化 Pyodide，加快首次执行速度
                    </p>
                  </div>
                  <Switch
                    checked={initializePython}
                    onCheckedChange={setInitializePython}
                    className="flex-shrink-0 ml-4"
                  />
                </div>

                <Separator />

                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">🐰</span>
                    <div className="space-y-2 flex-1">
                      <p className="font-semibold text-sm">关于 CyberBunny</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        这是一个浏览器端的 AI Agent，支持 MCP 协议、技能系统和 Python 代码执行。
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded">版本 0.1.0</span>
                        <span>•</span>
                        <span>React 19 + shadcn/ui</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
