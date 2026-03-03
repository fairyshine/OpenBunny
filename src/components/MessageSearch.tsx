// 消息搜索组件
import { useState } from 'react';
import { Message } from '../types';
import { MessageHistoryManager } from '../utils/messageHistory';
import { Search, X } from './icons';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

interface MessageSearchProps {
  messages: Message[];
  isOpen: boolean;
  onClose: () => void;
  onSelectMessage: (messageId: string) => void;
}

export default function MessageSearch({
  messages,
  isOpen,
  onClose,
  onSelectMessage,
}: MessageSearchProps) {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [searchInToolOutput, setSearchInToolOutput] = useState(true);

  const results = query.trim()
    ? MessageHistoryManager.searchMessages(messages, query, {
        caseSensitive,
        searchInToolOutput,
      })
    : [];

  const handleSelectMessage = (messageId: string) => {
    onSelectMessage(messageId);
    onClose();
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
      caseSensitive ? 'g' : 'gi'
    );

    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-800">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>搜索消息</DialogTitle>
        </DialogHeader>

        {/* 搜索框 */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索消息内容..."
                className="pl-10"
                autoFocus
              />
              {query && (
                <Button
                  onClick={() => setQuery('')}
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* 选项 */}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded"
              />
              <span>区分大小写</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchInToolOutput}
                onChange={(e) => setSearchInToolOutput(e.target.checked)}
                className="rounded"
              />
              <span>搜索工具输出</span>
            </label>
          </div>

          {/* 结果统计 */}
          {query && (
            <div className="text-sm text-muted-foreground">
              找到 {results.length} 条消息
            </div>
          )}
        </div>

        {/* 搜索结果 */}
        <ScrollArea className="flex-1 -mx-6 px-6">
          {!query ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>输入关键词搜索消息</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>未找到匹配的消息</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((msg) => (
                <div
                  key={msg.id}
                  onClick={() => handleSelectMessage(msg.id)}
                  className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                >
                  {/* 消息头部 */}
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                      {msg.role === 'user' ? '用户' : 'AI'}
                    </Badge>
                    {msg.type && (
                      <Badge variant="outline" className="text-xs">
                        {msg.type === 'thought' && '💭 思考'}
                        {msg.type === 'tool_call' && '🔧 工具调用'}
                        {msg.type === 'tool_result' && '✅ 结果'}
                        {msg.type === 'response' && '💬 响应'}
                      </Badge>
                    )}
                    {msg.toolName && (
                      <Badge variant="outline" className="text-xs">
                        {msg.toolName}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>

                  {/* 消息内容 */}
                  <div className="text-sm line-clamp-3">
                    {highlightText(msg.content, query)}
                  </div>

                  {/* 工具输出 */}
                  {msg.toolOutput && searchInToolOutput && (
                    <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                      <span className="font-medium">工具输出: </span>
                      <span className="line-clamp-2">
                        {highlightText(msg.toolOutput, query)}
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
