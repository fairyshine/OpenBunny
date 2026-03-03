import { useState, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Message } from '../../types';
import ReactMarkdown from '../ReactMarkdown';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Zap } from '../icons';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-4xl mx-auto py-6 md:py-8 px-4 md:px-6 space-y-4 md:space-y-6">
      {messages.length === 0 ? (
        <EmptyState />
      ) : (
        messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))
      )}
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

  if (!message.content) {
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
        </button>
        {expanded && (
          <div className="mt-2 px-4 py-3 rounded-2xl bg-muted/50 border-elegant text-sm text-muted-foreground animate-slide-in">
            <ReactMarkdown content={message.content} />
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
  const isError = message.content.startsWith('工具执行错误') || message.content.startsWith('工具 "') || message.content.startsWith('Tool execution error') || message.content.startsWith('Tool "');
  const previewText = message.content.split('\n')[0].slice(0, 80);

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
          </button>
          {expanded && (
            <div className="px-4 pb-3 border-t border-border/30 animate-slide-in">
              <pre className="mt-3 text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-64 overflow-y-auto border-elegant">
                {message.content}
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
