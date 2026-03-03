import { useState } from 'react';
import { Message } from '../types';
import ReactMarkdown from './ReactMarkdown';
import { Card } from './ui/card';
import { Badge } from './ui/badge';

interface MessageListProps {
  messages: Message[];
}

export default function MessageList({ messages }: MessageListProps) {
  return (
    <div className="max-w-3xl mx-auto py-4 md:py-6 px-3 md:px-4 space-y-3 md:space-y-4">
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

function EmptyState() {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="text-4xl mb-4">🐰</div>
      <p className="text-lg font-medium mb-2">你好，我是 CyberBunny</p>
      <p className="text-sm">我可以帮你执行 Python 代码、搜索网页、进行计算等。</p>
      <div className="mt-6 space-y-2 text-xs">
        <p className="text-muted-foreground">试试以下命令：</p>
        <div className="flex flex-wrap gap-2 justify-center">
          <Badge variant="secondary">/python print("Hello")</Badge>
          <Badge variant="secondary">/calc 123 * 456</Badge>
          <Badge variant="secondary">/search Python教程</Badge>
        </div>
      </div>
    </div>
  );
}

function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const msgType = message.type || 'normal';

  if (message.role === 'system') {
    return (
      <div className="text-center text-xs text-muted-foreground py-2">
        {message.content}
      </div>
    );
  }

  // 工具调用过程消息（包括思考和工具调用）
  if (msgType === 'thought' || msgType === 'tool_call') {
    return <ProcessBubble message={message} />;
  }

  // 工具结果 bubble
  if (msgType === 'tool_result') {
    return <ToolResultBubble message={message} />;
  }

  // 用户消息
  if (isUser) {
    return <UserBubble message={message} />;
  }

  // 最终响应 / 普通 assistant 消息
  return <ResponseBubble message={message} />;
}

/* ─── 用户消息 ─── */
function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex gap-2 md:gap-3 flex-row-reverse">
      <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs md:text-sm font-medium">
        你
      </div>
      <div className="flex-1 max-w-[90%] md:max-w-[80%] text-right">
        <div className="inline-block text-left rounded-2xl rounded-tr-sm px-3 md:px-4 py-2 md:py-3 bg-primary text-primary-foreground shadow-sm">
          <ReactMarkdown content={message.content} />
        </div>
        <Timestamp time={message.timestamp} align="right" />
      </div>
    </div>
  );
}

/* ─── 最终响应 ─── */
function ResponseBubble({ message }: { message: Message }) {
  if (!message.content) return null;
  return (
    <div className="flex gap-2 md:gap-3">
      <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center text-xs md:text-sm">
        🐰
      </div>
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <Card className="rounded-2xl rounded-tl-sm px-3 md:px-4 py-2 md:py-3 shadow-sm border-border/60">
          <ReactMarkdown content={message.content} />
          {message.metadata?.plots && Array.isArray(message.metadata.plots) && (
            <div className="mt-3 space-y-2">
              {(message.metadata.plots as string[]).map((plot: string, index: number) => (
                <img key={index} src={`data:image/png;base64,${plot}`} alt={`Plot ${index + 1}`} className="max-w-full rounded-lg" />
              ))}
            </div>
          )}
        </Card>
        <Timestamp time={message.timestamp} />
      </div>
    </div>
  );
}

/* ─── 处理过程（思考/工具调用） ─── */
function ProcessBubble({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(true);

  if (!message.content) {
    // 正在处理中（流式还没内容）
    return (
      <div className="flex gap-2 md:gap-3">
        <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white flex items-center justify-center text-xs">
          💭
        </div>
        <div className="flex-1 max-w-[95%] md:max-w-[85%]">
          <div className="inline-flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-2xl rounded-tl-sm bg-muted/60 border border-border/40">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-muted-foreground">处理中...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 md:gap-3">
      <div className="flex-shrink-0 w-7 h-7 md:w-8 md:h-8 rounded-full bg-gradient-to-br from-violet-400 to-purple-500 text-white flex items-center justify-center text-xs">
        💭
      </div>
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <div
          onClick={() => setExpanded(!expanded)}
          className="cursor-pointer inline-flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 rounded-2xl rounded-tl-sm bg-muted/60 border border-border/40 hover:bg-muted/80 transition-colors"
        >
          <span className="text-xs text-muted-foreground">
            {expanded ? '▼' : '▶'} {message.type === 'tool_call' ? '工具调用' : '处理过程'}
          </span>
        </div>
        {expanded && (
          <div className="mt-2 px-3 md:px-4 py-2 md:py-3 rounded-lg bg-muted/40 border border-border/30 text-sm text-muted-foreground">
            <ReactMarkdown content={message.content} />
          </div>
        )}
        <Timestamp time={message.timestamp} />
      </div>
    </div>
  );
}

/* ─── 工具结果 ─── */
function ToolResultBubble({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const isError = message.content.startsWith('工具执行错误') || message.content.startsWith('工具 "');
  const previewText = message.content.split('\n')[0].slice(0, 80);

  return (
    <div className="flex gap-2 md:gap-3">
      <div className="w-7 md:w-8 flex-shrink-0" /> {/* spacer to align with tool call */}
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <div className={`rounded-2xl rounded-tl-sm border overflow-hidden ${
          isError
            ? 'border-destructive/20 bg-destructive/5'
            : 'border-emerald-500/20 bg-emerald-500/5'
        }`}>
          <button
            onClick={() => setExpanded(!expanded)}
            className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
              isError ? 'hover:bg-destructive/10' : 'hover:bg-emerald-500/10'
            }`}
          >
            <svg className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''} ${isError ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Badge variant={isError ? 'destructive' : 'default'} className={`text-[10px] px-1.5 py-0 ${
              isError ? '' : 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
            }`}>
              {isError ? '❌ 错误' : '✅ 结果'}
            </Badge>
            {message.toolName && (
              <code className="text-xs font-mono text-muted-foreground">{message.toolName}</code>
            )}
            <span className="text-xs text-muted-foreground truncate flex-1 text-left">{previewText}</span>
          </button>
          {expanded && (
            <div className="px-4 pb-3 border-t border-border/30">
              <pre className="mt-2 text-xs bg-background/80 rounded-lg p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                {message.content}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── 时间戳 ─── */
function Timestamp({ time, align = 'left' }: { time: number; align?: 'left' | 'right' }) {
  return (
    <div className={`text-[10px] text-muted-foreground/60 mt-1 ${align === 'right' ? 'text-right' : ''}`}>
      {new Date(time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
    </div>
  );
}
