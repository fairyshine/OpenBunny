// 消息搜索组件
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '@openbunny/shared/types';
import { MessageHistoryManager } from '@openbunny/shared/utils/messageHistory';
import { getMessageDisplayType, getMessageToolName } from '@openbunny/shared/utils/messagePresentation';
import { Search, X } from './icons';
import { Brain, Wrench, CircleCheck, MessageCircle } from './icons';
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
  const { t } = useTranslation();
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
    return new Date(timestamp).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{t('search.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('search.placeholder')}
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

          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={caseSensitive}
                onChange={(e) => setCaseSensitive(e.target.checked)}
                className="rounded"
              />
              <span>{t('search.caseSensitive')}</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={searchInToolOutput}
                onChange={(e) => setSearchInToolOutput(e.target.checked)}
                className="rounded"
              />
              <span>{t('search.searchToolOutput')}</span>
            </label>
          </div>

          {query && (
            <div className="text-sm text-muted-foreground">
              {t('search.resultCount', { count: results.length })}
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 -mx-6 px-6">
          {!query ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mb-4 opacity-50" />
              <p>{t('search.hint')}</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p>{t('search.noResults')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((msg) => {
                const messageType = getMessageDisplayType(msg);
                const toolName = getMessageToolName(msg);
                const summary = MessageHistoryManager.getMessageSummary(msg);
                return (
                  <div
                    key={msg.id}
                    onClick={() => handleSelectMessage(msg.id)}
                    className="p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-2">
                    <Badge variant={msg.role === 'user' ? 'default' : 'secondary'}>
                      {msg.role === 'user' ? t('search.user') : t('search.ai')}
                    </Badge>
                    {messageType && (
                      <Badge variant="outline" className="text-xs flex items-center gap-1">
                        {messageType === 'thought' && <><Brain className="w-3 h-3" />{t('search.thought')}</>}
                        {messageType === 'tool_call' && <><Wrench className="w-3 h-3" />{t('search.toolCallBadge')}</>}
                        {messageType === 'tool_result' && <><CircleCheck className="w-3 h-3" />{t('search.resultBadge')}</>}
                        {messageType === 'response' && <><MessageCircle className="w-3 h-3" />{t('search.responseBadge')}</>}
                      </Badge>
                    )}
                    {toolName && (
                      <Badge variant="outline" className="text-xs">
                        {toolName}
                      </Badge>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>

                  <div className="text-sm line-clamp-3">
                    {highlightText(msg.content, query)}
                  </div>

                    {summary.searchableToolOutput && searchInToolOutput && (
                      <div className="mt-2 text-xs text-muted-foreground border-t pt-2">
                        <span className="font-medium">{t('search.toolOutput')}</span>
                        <span className="line-clamp-2">
                          {highlightText(summary.searchableToolOutput, query)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
