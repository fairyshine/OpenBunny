// 工具管理组件
// 用于管理工具源和查看已加载的工具

import { useState } from 'react';
import { useToolStore } from '../stores/tools';
import { toolRegistry } from '../services/tools/registry';
import { ToolSource } from '../services/tools/base';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Badge } from './ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { ScrollArea } from './ui/scroll-area';

export function ToolManager() {
  const { sources, loading, error, addSource, removeSource, toggleSource, reloadSource } = useToolStore();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newSource, setNewSource] = useState<Partial<ToolSource>>({
    type: 'file',
    name: '',
    source: '',
  });

  const allTools = toolRegistry.getAll();

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.source || !newSource.type) {
      alert('请填写完整信息');
      return;
    }

    try {
      await addSource(newSource as Omit<ToolSource, 'id'>);
      setShowAddDialog(false);
      setNewSource({ type: 'file', name: '', source: '' });
    } catch (error) {
      console.error('Failed to add source:', error);
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* 头部 */}
      <div className="flex items-center justify-between p-4 bg-background border-b">
        <h2 className="text-lg font-semibold">工具管理</h2>
        <Button onClick={() => setShowAddDialog(true)}>
          添加工具源
        </Button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mt-4">
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      )}

      {/* 工具源列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div>
            <h3 className="text-sm font-semibold mb-3">工具源 ({sources.length})</h3>
            <div className="space-y-2">
              {sources.map(source => (
                <Card key={source.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{source.name}</span>
                          <Badge variant="secondary">{source.type}</Badge>
                          {source.enabled && (
                            <Badge variant="default">已启用</Badge>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground truncate">
                          {source.source}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          onClick={() => toggleSource(source.id)}
                          disabled={loading}
                          variant="outline"
                          size="sm"
                        >
                          {source.enabled ? '禁用' : '启用'}
                        </Button>
                        {source.enabled && (
                          <Button
                            onClick={() => reloadSource(source.id)}
                            disabled={loading}
                            variant="outline"
                            size="sm"
                          >
                            重载
                          </Button>
                        )}
                        {source.type !== 'builtin' && (
                          <Button
                            onClick={() => removeSource(source.id)}
                            disabled={loading}
                            variant="destructive"
                            size="sm"
                          >
                            删除
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* 已加载工具列表 */}
          <div>
            <h3 className="text-sm font-semibold mb-3">
              已加载工具 ({allTools.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {allTools.map(tool => (
                <Card key={tool.metadata.id}>
                  <CardHeader className="p-3">
                    <div className="flex items-start gap-2">
                      {tool.metadata.icon && (
                        <span className="text-2xl">{tool.metadata.icon}</span>
                      )}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm truncate">
                          {tool.metadata.name}
                        </CardTitle>
                        <CardDescription className="text-xs line-clamp-2 mt-1">
                          {tool.metadata.description}
                        </CardDescription>
                        {tool.metadata.tags && tool.metadata.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {tool.metadata.tags.map(tag => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                {tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </ScrollArea>

      {/* 添加工具源对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>添加工具源</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="type">类型</Label>
              <Select
                value={newSource.type}
                onValueChange={(value) => setNewSource({ ...newSource, type: value as ToolSource['type'] })}
              >
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="file">本地文件 (.ts)</SelectItem>
                  <SelectItem value="http">HTTP URL</SelectItem>
                  <SelectItem value="mcp">MCP 服务器</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">名称</Label>
              <Input
                id="name"
                type="text"
                value={newSource.name}
                onChange={e => setNewSource({ ...newSource, name: e.target.value })}
                placeholder="例如: 我的自定义工具"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="source">
                {newSource.type === 'file' && '文件路径'}
                {newSource.type === 'http' && 'URL'}
                {newSource.type === 'mcp' && 'MCP 服务器 ID'}
              </Label>
              <Input
                id="source"
                type="text"
                value={newSource.source}
                onChange={e => setNewSource({ ...newSource, source: e.target.value })}
                placeholder={
                  newSource.type === 'file' ? '/tools/my-tool.ts' :
                  newSource.type === 'http' ? 'https://example.com/tool.js' :
                  'server-id'
                }
              />
              <p className="text-xs text-muted-foreground">
                {newSource.type === 'file' && '相对于项目根目录的路径'}
                {newSource.type === 'http' && '工具定义的 HTTP URL'}
                {newSource.type === 'mcp' && '已配置的 MCP 服务器 ID'}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button
              onClick={() => setShowAddDialog(false)}
              variant="outline"
            >
              取消
            </Button>
            <Button
              onClick={handleAddSource}
              disabled={loading}
            >
              添加
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
