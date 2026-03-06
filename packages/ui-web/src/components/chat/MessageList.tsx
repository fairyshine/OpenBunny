import { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';
import { Message } from '@shared/types';
import ReactMarkdown from '../ReactMarkdown';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Zap } from '../icons';

interface MessageListProps {
  messages: Message[];
}

const VIRTUALIZATION_THRESHOLD = 50;

export default function MessageList({ messages }: MessageListProps) {
  const shouldVirtualize = messages.length > VIRTUALIZATION_THRESHOLD;

  if (messages.length === 0) {
    return (
      <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6">
        <EmptyState />
      </div>
    );
  }

  if (shouldVirtualize) {
    return (
      <Virtuoso
        data={messages}
        itemContent={(_index, message) => (
          <div className="max-w-4xl mx-auto px-4 md:px-6 py-2 md:py-3">
            <MessageItem message={message} />
          </div>
        )}
        className="h-full"
        initialTopMostItemIndex={messages.length - 1}
        followOutput="smooth"
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6 space-y-4 md:space-y-6">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}

const EmptyState = memo(function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="text-center py-20 text-muted-foreground animate-fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-muted mb-6">
        <span className="text-3xl">🐰</span>
      </div>
      <h2 className="text-xl font-semibold mb-3 text-foreground tracking-tight">CyberBunny</h2>
      <p className="text-sm mb-8 max-w-md mx-auto leading-relaxed">
        {t('chat.emptyState.desc')}
      </p>
      <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('welcome.badge.python')}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('welcome.badge.search')}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('welcome.badge.calc')}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('welcome.badge.file')}
        </Badge>
      </div>
    </div>
  );
});

const MessageItem = memo(function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const msgType = message.type || 'normal';

  if (message.role === 'system') {
    return (
      <div className="text-center text-xs text-muted-foreground py-2 font-medium">
        {message.content}
      </div>
    );
  }

  if (msgType === 'thought' || msgType === 'tool_call') {
    return <ProcessBubble message={message} />;
  }

  if (msgType === 'tool_result') {
    return <ToolResultBubble message={message} />;
  }

  if (isUser) {
    return <UserBubble message={message} />;
  }

  return <ResponseBubble message={message} />;
});

const UserBubble = memo(function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex gap-3 md:gap-4 flex-row-reverse animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium shadow-elegant">
        U
      </div>
      <div className="flex-1 max-w-[85%] md:max-w-[75%] text-right">
        <div className="inline-block text-left rounded-2xl px-4 py-3 bg-foreground text-background shadow-elegant border-elegant selection:bg-background/30 selection:text-background">
          <ReactMarkdown content={message.content} />
        </div>
        <Timestamp time={message.timestamp} align="right" />
      </div>
    </div>
  );
});

const ResponseBubble = memo(function ResponseBubble({ message }: { message: Message }) {
  if (!message.content) return null;
  return (
    <div className="flex gap-3 md:gap-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted flex items-center justify-center text-sm shadow-elegant">
        🐰
      </div>
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <Card className="rounded-2xl px-4 py-3 shadow-elegant border-elegant hover-lift">
          <ReactMarkdown content={message.content} />
          {message.metadata?.plots && Array.isArray(message.metadata.plots) && (
            <div className="mt-4 space-y-3">
              {(message.metadata.plots as string[]).map((plot: string, index: number) => (
                <img
                  key={index}
                  src={`data:image/png;base64,${plot}`}
                  alt={`Plot ${index + 1}`}
                  className="max-w-full rounded-md border-elegant shadow-elegant"
                />
              ))}
            </div>
          )}
        </Card>
        <Timestamp time={message.timestamp} />
      </div>
    </div>
  );
});

const ProcessBubble = memo(function ProcessBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const isStreaming = message.metadata?.streaming === true;

  if (!message.content && !message.toolInput) {
    return (
      <div className="flex gap-3 md:gap-4 animate-fade-in">
        <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted flex items-center justify-center text-sm shadow-elegant">
          <Zap className="w-4 h-4" />
        </div>
        <div className="flex-1 max-w-[95%] md:max-w-[85%]">
          <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-muted border-elegant">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-muted-foreground font-medium">{t('chat.processing')}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 md:gap-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted flex items-center justify-center text-sm shadow-elegant">
        <Zap className="w-4 h-4" />
      </div>
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-muted border-elegant hover:bg-accent transition-all duration-200"
        >
          <span className="text-xs text-foreground/60">
            {expanded ? '▼' : '▶'}
          </span>
          <span className="text-xs text-muted-foreground font-medium">
            {message.type === 'tool_call' ? t('chat.toolCall') : t('chat.processStep')}
          </span>
          {message.type === 'tool_call' && message.toolName && (
            <>
              <code className="text-xs font-mono text-foreground/50">{message.toolName}</code>
              {isStreaming && (
                <div className="flex gap-1 ml-1">
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              )}
            </>
          )}
        </button>
        {expanded && (
          <div className="mt-2 rounded-2xl bg-muted/50 border-elegant animate-slide-in overflow-hidden">
            {message.type === 'tool_call' && message.toolName && (
              <div className="px-4 py-3 border-b border-border/30 bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Zap className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-semibold text-foreground">{message.toolName}</code>
                      {isStreaming && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 animate-pulse">
                          {t('chat.streaming')}
                        </Badge>
                      )}
                    </div>
                    {typeof message.metadata?.toolDescription === 'string' && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {message.metadata.toolDescription}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="px-4 py-3">
              {message.type === 'tool_call' && message.toolInput ? (
                <>
                  <div className="text-xs font-semibold text-muted-foreground mb-2">Parameters:</div>
                  <ToolInputDisplay input={message.toolInput} isStreaming={isStreaming} />
                </>
              ) : (
                <ReactMarkdown content={message.content} />
              )}
            </div>
          </div>
        )}
        <Timestamp time={message.timestamp} />
      </div>
    </div>
  );
});

const ToolResultBubble = memo(function ToolResultBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const content = message.content || '';
  const isError = content.startsWith('工具执行错误') || content.startsWith('工具 "') || content.startsWith('Tool execution error') || content.startsWith('Tool "');
  const isStreaming = message.metadata?.streaming === true;
  const previewText = content.split('\n')[0].slice(0, 80);

  return (
    <div className="flex gap-3 md:gap-4 animate-fade-in">
      <div className="w-8 md:w-9 flex-shrink-0" />
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <div className={`rounded-2xl border overflow-hidden shadow-elegant ${
          isError ? 'border-destructive/30 bg-destructive/5' : 'border-foreground/10 bg-muted/30'
        }`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
              isError ? 'hover:bg-destructive/10' : 'hover:bg-muted/50'
            }`}
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''} ${
                isError ? 'text-destructive' : 'text-foreground/60'
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Badge
              variant={isError ? 'destructive' : 'outline'}
              className="text-[10px] px-2 py-0.5 font-medium"
            >
              {isError ? t('chat.toolResult.error') : t('chat.toolResult.result')}
            </Badge>
            {message.toolName && (
              <code className="text-xs font-mono text-muted-foreground">{message.toolName}</code>
            )}
            <span className="text-xs text-muted-foreground truncate flex-1 text-left">{previewText}</span>
            {isStreaming && (
              <div className="flex gap-1">
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </button>
          {expanded && (
            <div className="px-4 pb-3 border-t border-border/30 animate-slide-in">
              <pre className="mt-3 text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-64 overflow-y-auto border-elegant">
                {content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

const Timestamp = memo(function Timestamp({ time, align = 'left' }: { time: number; align?: 'left' | 'right' }) {
  return (
    <div className={`text-[10px] text-muted-foreground/50 mt-1.5 font-medium ${align === 'right' ? 'text-right' : ''}`}>
      {new Date(time).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
});

const ToolInputDisplay = memo(function ToolInputDisplay({ input, isStreaming }: { input: string; isStreaming?: boolean }) {
  try {
    const params = JSON.parse(input);
    return (
      <div className="space-y-2">
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="flex gap-3">
            <div className="text-xs font-mono text-primary font-semibold min-w-[80px]">{key}:</div>
            <div className="flex-1 text-xs font-mono text-foreground/80">
              {typeof value === 'string' ? (
                value.includes('\n') ? (
                  <pre className="text-xs text-green-600 dark:text-green-400 bg-background/50 rounded px-2 py-1 whitespace-pre-wrap break-all">{value}</pre>
                ) : (
                  <span className="text-green-600 dark:text-green-400">"{value}"</span>
                )
              ) : typeof value === 'number' ? (
                <span className="text-blue-600 dark:text-blue-400">{value}</span>
              ) : typeof value === 'boolean' ? (
                <span className="text-purple-600 dark:text-purple-400">{String(value)}</span>
              ) : value === null ? (
                <span className="text-muted-foreground">null</span>
              ) : Array.isArray(value) ? (
                <pre className="text-xs bg-background/50 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : typeof value === 'object' ? (
                <pre className="text-xs bg-background/50 rounded px-2 py-1 overflow-x-auto whitespace-pre-wrap break-all">
                  {JSON.stringify(value, null, 2)}
                </pre>
              ) : (
                String(value)
              )}
            </div>
          </div>
        ))}
      </div>
    );
  } catch {
    // Fallback to raw text if parsing fails (streaming or incomplete JSON)
    return (
      <pre className={`text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto border-elegant ${isStreaming ? 'animate-pulse' : ''}`}>
        {input || (isStreaming ? '...' : '')}
      </pre>
    );
  }
});
