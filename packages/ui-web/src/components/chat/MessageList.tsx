import { useState, useMemo, memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Virtuoso } from 'react-virtuoso';
import { Message } from '@shared/types';
import ReactMarkdown from '../ReactMarkdown';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Zap } from '../icons';
import { Sparkles, FileCode, Folder, File } from 'lucide-react';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark, atomOneLight } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import { useSettingsStore } from '@shared/stores/settings';
import { useSkillStore } from '@shared/stores/skills';
import { getToolIcon } from '../ToolIcon';

SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('json', json);

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
          {t('status.badge.python')}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('status.badge.search')}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('status.badge.calc')}
        </Badge>
        <Badge variant="outline" className="text-xs font-normal border-elegant">
          {t('status.badge.file')}
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
        {message.content || ''}
      </div>
    );
  }

  // Intercept activate_skill tool calls and results
  if (message.toolName === 'activate_skill') {
    if (msgType === 'tool_call') {
      return <SkillActivationBubble message={message} />;
    }
    if (msgType === 'tool_result') {
      return <SkillResultBubble message={message} />;
    }
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
  const avatar = useSettingsStore(s => s.userProfile.avatar);
  return (
    <div className="flex gap-3 md:gap-4 flex-row-reverse animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-medium shadow-elegant">
        {avatar || 'U'}
      </div>
      <div className="flex-1 max-w-[85%] md:max-w-[75%] text-right">
        <div className="inline-block text-left rounded-2xl px-4 py-3 bg-foreground text-background shadow-elegant border-elegant selection:bg-background/30 selection:text-background">
          <ReactMarkdown content={message.content || ''} />
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
  const isToolCall = message.type === 'tool_call';
  const ToolIconComponent = isToolCall && message.toolName ? getToolIcon(message.toolName) : Zap;

  if (!message.content && !message.toolInput) {
    return (
      <div className="flex gap-3 md:gap-4 animate-fade-in">
        <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted flex items-center justify-center text-sm shadow-elegant">
          <ToolIconComponent className="w-4 h-4" />
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
        <ToolIconComponent className="w-4 h-4" />
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
            {isToolCall ? t('chat.toolCall') : t('chat.processStep')}
          </span>
          {isToolCall && message.toolName && (
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
            {isToolCall && message.toolName && !isStreaming && (
              <div className="px-4 py-3 border-b border-border/30 bg-muted/30">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ToolIconComponent className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <code className="text-sm font-mono font-semibold text-foreground">{message.toolName}</code>
                    {typeof message.metadata?.toolDescription === 'string' && (
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                        {message.metadata.toolDescription}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
            <div className="px-4 py-3">
              {isToolCall && message.toolInput ? (
                isStreaming ? (
                  <pre className="text-xs bg-background/50 rounded-md p-3 font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto border-elegant">
                    {message.toolInput}<span className="animate-pulse">|</span>
                  </pre>
                ) : (
                  <>
                    <div className="text-xs font-semibold text-muted-foreground mb-2">Parameters:</div>
                    <ToolInputDisplay input={message.toolInput} toolName={message.toolName} />
                  </>
                )
              ) : message.content ? (
                <ReactMarkdown content={message.content} />
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

const ToolResultBubble = memo(function ToolResultBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const rawContent = message.content || '';
  const isError = rawContent.startsWith('工具执行错误') || rawContent.startsWith('工具 "') || rawContent.startsWith('Tool execution error') || rawContent.startsWith('Tool "');
  const isStreaming = message.metadata?.streaming === true;

  // Strip "Output:\n```\n...\n```" wrapper from python tool results
  const content = message.toolName === 'python'
    ? rawContent.replace(/^Output:\n```\n?([\s\S]*?)\n?```\s*$/, '$1').trim()
    : rawContent;

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
              {(message.metadata?.files as Array<{ data: string; mediaType: string }> | undefined)
                ?.filter(f => f.mediaType?.startsWith('image/'))
                .map((file, i) => (
                  <img
                    key={i}
                    src={`data:${file.mediaType};base64,${file.data}`}
                    alt={`${message.toolName} result ${i + 1}`}
                    className="mt-3 max-w-full max-h-80 rounded-md border-elegant shadow-elegant object-contain"
                  />
                ))}
            </div>
          )}
        </div>
        <Timestamp time={message.timestamp} />
      </div>
    </div>
  );
});

/** Parse activate_skill toolInput JSON to extract name and resource_path */
function parseSkillInput(toolInput?: string): { skillName: string; resourcePath?: string } {
  if (!toolInput) return { skillName: '' };
  try {
    const parsed = JSON.parse(toolInput);
    return {
      skillName: parsed.name || '',
      resourcePath: parsed.resource_path || undefined,
    };
  } catch {
    return { skillName: '' };
  }
}

interface SkillResource {
  type: 'directory' | 'file';
  path: string;
  name: string;
  size?: number;
}

/** Parse resource directories and files from skill_content XML in tool result */
function parseSkillResources(content: string): SkillResource[] {
  const resources: SkillResource[] = [];
  const dirRegex = /<directory\s+path="([^"]+)"\s*\/>/g;
  const fileRegex = /<file\s+path="([^"]+)"(?:\s+size="(\d+)")?\s*\/>/g;
  let match;
  while ((match = dirRegex.exec(content)) !== null) {
    const p = match[1];
    resources.push({ type: 'directory', path: p, name: p.split('/').filter(Boolean).pop() || p });
  }
  while ((match = fileRegex.exec(content)) !== null) {
    const p = match[1];
    resources.push({
      type: 'file',
      path: p,
      name: p.split('/').pop() || p,
      size: match[2] ? Number(match[2]) : undefined,
    });
  }
  return resources;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Skill Activation Bubble — renders activate_skill tool_call messages.
 * Compact card with grayscale accent instead of generic tool call chrome.
 */
const SkillActivationBubble = memo(function SkillActivationBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const isStreaming = message.metadata?.streaming === true;
  const { skillName, resourcePath } = useMemo(
    () => parseSkillInput(message.toolInput),
    [message.toolInput],
  );
  const skillDescription = useSkillStore(s => s.skills.find(sk => sk.name === skillName)?.description || '');

  const isResource = !!resourcePath;
  const Icon = isResource ? FileCode : Sparkles;
  const label = isResource ? t('chat.skill.readingResource') : t('chat.skill.activating');

  return (
    <div className="flex gap-3 md:gap-4 animate-fade-in">
      <div className="flex-shrink-0 w-8 h-8 md:w-9 md:h-9 rounded-full bg-muted flex items-center justify-center shadow-elegant">
        <Icon className="w-4 h-4 text-foreground/50" />
      </div>
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <div className="rounded-2xl bg-muted/50 border border-border overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/70 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform text-foreground/50 ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            {skillName && (
              <Badge variant="outline" className="text-[10px] px-2 py-0 font-mono border-border text-foreground/60">
                {skillName}
              </Badge>
            )}
            {isResource && resourcePath && (
              <code className="text-[10px] font-mono text-muted-foreground truncate max-w-[200px]">
                {resourcePath}
              </code>
            )}
            {isStreaming && (
              <div className="flex gap-1 ml-1">
                <span className="w-1 h-1 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-1 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-1 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
          </button>
          {expanded && skillDescription && (
            <div className="px-4 py-3 border-t border-border/30 animate-slide-in">
              <p className="text-xs text-muted-foreground leading-relaxed">{skillDescription}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

/**
 * Skill Result Bubble — renders activate_skill tool_result messages.
 * Activation: shows confirmed badge + resource file listing.
 * Resource read: shows file content in collapsible block.
 */
const SkillResultBubble = memo(function SkillResultBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const content = message.content || '';
  const isError = content.startsWith('Error:');

  // Match single resource read (<skill_resource ...>) but NOT the resource listing (<skill_resources>)
  const isResourceResult = /<skill_resource[\s>]/.test(content) && !content.includes('<skill_resources>');

  const nameMatch = content.match(/name="([^"]+)"/);
  const skillName = nameMatch?.[1] || '';

  const pathMatch = isResourceResult ? content.match(/path="([^"]+)"/) : null;
  const resourcePath = pathMatch?.[1] || '';

  const resources = useMemo(
    () => isResourceResult ? [] : parseSkillResources(content),
    [content, isResourceResult],
  );

  if (isError) {
    return (
      <div className="flex gap-3 md:gap-4 animate-fade-in">
        <div className="w-8 md:w-9 flex-shrink-0" />
        <div className="flex-1 max-w-[95%] md:max-w-[85%]">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <span className="text-xs text-destructive">{content}</span>
          </div>
          <Timestamp time={message.timestamp} />
        </div>
      </div>
    );
  }

  // --- Resource file content ---
  if (isResourceResult) {
    const bodyMatch = content.match(/<skill_resource[^>]*>\n?([\s\S]*?)\n?<\/skill_resource>/);
    const fileContent = bodyMatch?.[1] || content;
    const isMarkdownResource = /\.md$/i.test(resourcePath);

    // AI SDK v6: image files are stored as file-data in metadata.files
    const files = (message.metadata?.files || []) as Array<{ data: string; mediaType: string }>;
    const imageFiles = files.filter(f => f.mediaType?.startsWith('image/'));
    const isImageResource = imageFiles.length > 0 || content.includes('type="image"');

    return (
      <div className="flex gap-3 md:gap-4 animate-fade-in">
        <div className="w-8 md:w-9 flex-shrink-0" />
        <div className="flex-1 max-w-[95%] md:max-w-[85%]">
          <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
            <button
              onClick={() => setExpanded(!expanded)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform text-foreground/50 ${expanded ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              <FileCode className="w-3.5 h-3.5 text-foreground/50" />
              <Badge variant="outline" className="text-[10px] px-2 py-0 font-medium border-border text-foreground/60">
                {t('chat.skill.resourceLoaded')}
              </Badge>
              <code className="text-[10px] font-mono text-muted-foreground truncate">
                {resourcePath}
              </code>
            </button>
            {expanded && (
              <div className="px-4 pb-3 border-t border-border/30 animate-slide-in">
                {isImageResource ? (
                  imageFiles.map((file, i) => (
                    <img
                      key={i}
                      src={`data:${file.mediaType};base64,${file.data}`}
                      alt={resourcePath}
                      className="mt-3 max-w-full max-h-80 rounded-md border-elegant shadow-elegant object-contain"
                    />
                  ))
                ) : isMarkdownResource ? (
                  <div className="mt-3 text-sm max-h-64 overflow-y-auto">
                    <ReactMarkdown content={fileContent} />
                  </div>
                ) : (
                  <pre className="mt-3 text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-64 overflow-y-auto border-elegant">
                    {fileContent}
                  </pre>
                )}
              </div>
            )}
          </div>
          <Timestamp time={message.timestamp} />
        </div>
      </div>
    );
  }

  // --- Skill activation result ---
  // Extract SKILL.md body from <skill_content> XML for markdown rendering
  const skillBodyMatch = content.match(/<skill_content[^>]*>\n?([\s\S]*?)(?:\nSkill directory:|<skill_resources>|<\/skill_content>)/);
  const skillBody = skillBodyMatch?.[1]?.trim() || '';

  return (
    <div className="flex gap-3 md:gap-4 animate-fade-in">
      <div className="w-8 md:w-9 flex-shrink-0" />
      <div className="flex-1 max-w-[95%] md:max-w-[85%]">
        <div className="rounded-2xl border border-border bg-muted/30 overflow-hidden">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-muted/50 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform text-foreground/50 ${expanded ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <Sparkles className="w-3.5 h-3.5 text-foreground/50" />
            <Badge variant="outline" className="text-[10px] px-2 py-0 font-medium border-border text-foreground/60">
              {t('chat.skill.activated')}
            </Badge>
            {skillName && (
              <span className="text-xs font-medium text-foreground/70">{skillName}</span>
            )}
            {resources.length > 0 && (
              <span className="text-[10px] text-muted-foreground ml-auto">
                {resources.length} {t('chat.skill.resources')}
              </span>
            )}
          </button>
          {expanded && (
            <div className="border-t border-border/30 animate-slide-in">
              {skillBody && (
                <div className="px-4 py-3 text-sm max-h-64 overflow-y-auto">
                  <ReactMarkdown content={skillBody} />
                </div>
              )}
              {resources.length > 0 && (
                <div className={`px-4 py-3 ${skillBody ? 'border-t border-border/30' : ''}`}>
                  <div className="text-[10px] font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    {t('chat.skill.resources')}
                  </div>
                  <div className="space-y-1">
                    {resources.map((res) => (
                      <div key={res.path} className="flex items-center gap-2 py-0.5">
                        {res.type === 'directory' ? (
                          <Folder className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0" />
                        ) : (
                          <File className="w-3.5 h-3.5 text-foreground/40 flex-shrink-0" />
                        )}
                        <span className="text-[11px] font-mono text-foreground/70 break-all">
                          {res.path}
                        </span>
                        {res.type === 'file' && res.size != null && (
                          <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">
                            {formatFileSize(res.size)}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <Timestamp time={message.timestamp} />
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

/** Map toolName + param key to a syntax highlight language, or undefined for plain text */
function getCodeLanguage(toolName?: string, paramKey?: string): string | undefined {
  if (toolName === 'python' && paramKey === 'code') return 'python';
  if (toolName === 'exec' && paramKey === 'command') return 'bash';
  if (toolName === 'file_manager' && paramKey === 'content') {
    // Could be any language — skip highlighting for now
    return undefined;
  }
  return undefined;
}

const ToolInputDisplay = memo(function ToolInputDisplay({ input, toolName }: { input: string; toolName?: string }) {
  const isDark = useSettingsStore(s => {
    if (s.theme === 'dark') return true;
    if (s.theme === 'light') return false;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  try {
    const params = JSON.parse(input);
    return (
      <div className="space-y-2">
        {Object.entries(params).map(([key, value]) => {
          const lang = typeof value === 'string' && value.includes('\n') ? getCodeLanguage(toolName, key) : undefined;
          return (
            <div key={key} className={lang ? '' : 'flex gap-3'}>
              <div className="text-xs font-mono text-primary font-semibold min-w-[80px]">{key}:</div>
              <div className="flex-1 text-xs font-mono text-foreground/80">
                {typeof value === 'string' ? (
                  lang ? (
                    <SyntaxHighlighter
                      language={lang}
                      style={isDark ? atomOneDark : atomOneLight}
                      customStyle={{ margin: 0, padding: '8px 10px', borderRadius: '6px', fontSize: '12px', maxHeight: '256px', overflow: 'auto' }}
                      wrapLongLines
                    >
                      {value}
                    </SyntaxHighlighter>
                  ) : value.includes('\n') ? (
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
          );
        })}
      </div>
    );
  } catch {
    // Fallback to raw text if parsing fails
    return (
      <pre className="text-xs bg-background/50 rounded-md p-3 overflow-x-auto font-mono text-foreground/80 whitespace-pre-wrap break-all max-h-48 overflow-y-auto border-elegant">
        {input}
      </pre>
    );
  }
});
