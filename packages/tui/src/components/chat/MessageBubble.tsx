import { Box, Text } from 'ink';
import type { Message, MessageFileAttachment, MessagePresentation, MessageSkillResource } from '@openbunny/shared/types';
import {
  deriveMessagePresentation,
  formatFileSize,
} from '@openbunny/shared/utils/messagePresentation';
import { T } from '../../theme.js';
import { formatTime, truncate } from '../../utils/formatting.js';

interface MessageBubbleProps {
  message: Message;
}

interface LineWindow {
  lines: string[];
  hiddenLineCount: number;
}

function simplifyExecToolOutput(content: string): string {
  const match = content.match(/^Session: .*?\nExit Code: (\d+)\n\nOutput:\n```[\r\n]?([\s\S]*?)\n?```$/);
  if (!match) return content;

  const exitCode = Number.parseInt(match[1], 10);
  const output = match[2].trim();

  if (exitCode !== 0) {
    return output ? `Exit Code: ${exitCode}\n${output}` : `Exit Code: ${exitCode}`;
  }

  return output || '(no output)';
}

function simplifyMarkdown(content: string): string {
  const trimmed = content.trim();
  const fencedMatch = trimmed.match(/^```(?:[\w-]+)?\n?([\s\S]*?)\n?```$/);
  if (fencedMatch) return fencedMatch[1].trim();

  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .trim();
}

function prettyToolInput(toolInput?: string): string {
  if (!toolInput) return '';
  const trimmed = toolInput.trim();
  if (!trimmed) return '';

  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return trimmed;
  }
}

function compactText(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function sliceVisibleLines(content: string, maxLines: number): LineWindow {
  const normalized = compactText(content);
  if (!normalized) {
    return {
      lines: ['(empty)'],
      hiddenLineCount: 0,
    };
  }

  const lines = normalized.split('\n');
  if (lines.length <= maxLines) {
    return {
      lines,
      hiddenLineCount: 0,
    };
  }

  return {
    lines: lines.slice(0, maxLines),
    hiddenLineCount: lines.length - maxLines,
  };
}

function formatAttachmentSummary(files: MessageFileAttachment[]): string[] {
  if (files.length === 0) return [];

  return files.map((file, index) => (
    `Image ${index + 1}: ${file.filename || `attachment-${index + 1}`} (${file.mediaType})`
  ));
}

function formatSkillResources(resources: MessageSkillResource[]): string[] {
  if (resources.length === 0) return [];

  return resources.map((resource) => (
    resource.type === 'directory'
      ? `DIR  ${resource.path}`
      : `FILE ${resource.path}${typeof resource.size === 'number' ? ` (${formatFileSize(resource.size)})` : ''}`
  ));
}

function formatResponseBody(message: Message, presentation: MessagePresentation): string {
  const body = simplifyMarkdown(message.content || '(no content)');
  const plotCount = presentation.kind === 'markdown' ? presentation.plots.length : 0;

  if (plotCount === 0) {
    return body;
  }

  return `${body}\n\nGenerated plot(s): ${plotCount}`;
}

function getToolResultBody(message: Message, presentation: MessagePresentation): string {
  if (presentation.kind !== 'tool_result') {
    return message.content || '(no output)';
  }

  const content = presentation.toolName === 'exec'
    ? simplifyExecToolOutput(presentation.content || '')
    : (presentation.content || '(no output)');
  const attachments = formatAttachmentSummary(presentation.files);

  return attachments.length > 0
    ? `${content}\n\n${attachments.join('\n')}`
    : content;
}

function getSkillActivationBody(presentation: MessagePresentation): string {
  if (presentation.kind !== 'skill_activation') return '';

  return [
    presentation.resourcePath ? `Resource: ${presentation.resourcePath}` : null,
    presentation.skillDescription || null,
    presentation.isStreaming ? 'Loading skill metadata...' : null,
  ].filter(Boolean).join('\n');
}

function getSkillResultBody(presentation: MessagePresentation): string {
  if (presentation.kind === 'skill_result_error') {
    return presentation.content;
  }

  if (presentation.kind === 'skill_resource_result') {
    return [
      `Path: ${presentation.resourcePath}`,
      `Format: ${presentation.resourceFormat}`,
      presentation.fileContent,
      ...formatAttachmentSummary(presentation.files),
    ].filter(Boolean).join('\n\n');
  }

  if (presentation.kind === 'skill_activation_result') {
    return [
      presentation.skillBody,
      presentation.resources.length > 0
        ? ['Resources:', ...formatSkillResources(presentation.resources)].join('\n')
        : null,
    ].filter(Boolean).join('\n\n');
  }

  return '';
}

function MessageHeader({
  prefix,
  label,
  color,
  timestamp,
  meta,
}: {
  prefix: string;
  label: string;
  color: string;
  timestamp: string;
  meta?: string;
}) {
  return (
    <Box>
      <Text bold color={color}>{prefix} {label}</Text>
      {meta && <Text color={T.fgDim}>  {meta}</Text>}
      {timestamp && <Text color={T.fgSubtle}>  {timestamp}</Text>}
    </Box>
  );
}

function DetailBlock({
  title,
  lines,
  color = T.fg,
  borderColor = T.borderLight,
  footer,
}: {
  title?: string;
  lines: string[];
  color?: string;
  borderColor?: string;
  footer?: string;
}) {
  if (!title && lines.length === 0 && !footer) return null;

  return (
    <Box
      marginLeft={2}
      marginTop={1}
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      flexDirection="column"
    >
      {title && <Text color={T.fgSubtle}>{title}</Text>}
      {lines.map((line, index) => (
        <Text key={`${index}-${line}`} wrap="wrap" color={color}>
          {line || ' '}
        </Text>
      ))}
      {footer && <Text color={T.fgMuted} italic>{footer}</Text>}
    </Box>
  );
}

/* ── Gemini-style role prefixes ────────────────────────── */

function getMessageHeading(message: Message): { prefix: string; label: string; color: string } {
  const presentation = deriveMessagePresentation(message);

  if (message.role === 'system') return { prefix: '⚙', label: 'System', color: T.system };
  if (message.role === 'user') return { prefix: '>', label: 'You', color: T.user };

  if (presentation.kind === 'process') {
    if (presentation.stage === 'tool_call') {
      return { prefix: '⚡', label: presentation.toolName || 'Tool Call', color: T.tool };
    }
    return { prefix: '◌', label: 'Thinking', color: T.thinking };
  }

  if (presentation.kind === 'tool_result') {
    return {
      prefix: presentation.isError ? '✕' : '✓',
      label: presentation.toolName || 'Tool Result',
      color: presentation.isError ? T.err : T.toolResult,
    };
  }

  if (presentation.kind === 'skill_activation') return { prefix: '◈', label: presentation.skillName || 'Skill', color: T.skill };
  if (presentation.kind === 'skill_result_error') return { prefix: '✕', label: 'Skill Error', color: T.err };
  if (presentation.kind === 'skill_resource_result') return { prefix: '◈', label: presentation.skillName || 'Skill Resource', color: T.skill };
  if (presentation.kind === 'skill_activation_result') return { prefix: '◈', label: presentation.skillName || 'Skill Loaded', color: T.skill };

  return { prefix: '🐰', label: 'Bunny', color: T.assistant };
}

function getMessageBody(message: Message): string {
  const presentation = deriveMessagePresentation(message);

  switch (presentation.kind) {
    case 'process':
      return presentation.toolInput || message.content || '(no content)';
    case 'tool_result': {
      return getToolResultBody(message, presentation);
    }
    case 'skill_activation':
      return getSkillActivationBody(presentation) || 'Activating skill...';
    case 'skill_result_error':
    case 'skill_resource_result':
    case 'skill_activation_result':
      return getSkillResultBody(presentation);
    case 'system':
      return message.content;
    case 'markdown':
    default:
      return formatResponseBody(message, presentation);
  }
}

const TOOL_RESULT_MAX_LINES = 10;
const DETAIL_MAX_LINES = 14;

export function MessageBubble({ message }: MessageBubbleProps) {
  const presentation = deriveMessagePresentation(message);
  const heading = getMessageHeading(message);
  const rawBody = getMessageBody(message);
  const timestamp = formatTime(message.timestamp);
  const detailMeta = presentation.kind === 'process'
    ? [
        presentation.stage === 'tool_call' ? 'call' : 'step',
        presentation.toolName ? truncate(presentation.toolName, 22) : null,
        presentation.isStreaming ? 'streaming' : null,
      ].filter(Boolean).join(' · ')
    : presentation.kind === 'tool_result'
      ? [
          presentation.toolName ? truncate(presentation.toolName, 22) : null,
          presentation.isError ? 'error' : 'ok',
          presentation.isStreaming ? 'streaming' : null,
        ].filter(Boolean).join(' · ')
      : presentation.kind === 'skill_activation'
        ? [
            presentation.skillName || 'unknown',
            presentation.resourcePath ? truncate(presentation.resourcePath, 24) : null,
            presentation.isStreaming ? 'streaming' : null,
          ].filter(Boolean).join(' · ')
        : presentation.kind === 'skill_resource_result'
          ? [
              presentation.skillName || 'resource',
              truncate(presentation.resourcePath, 24),
            ].filter(Boolean).join(' · ')
          : presentation.kind === 'skill_activation_result'
            ? [
                presentation.skillName || 'skill',
                presentation.resources.length > 0 ? `${presentation.resources.length} resource(s)` : null,
              ].filter(Boolean).join(' · ')
            : undefined;

  if (presentation.kind === 'process') {
    const bodyLines = sliceVisibleLines(
      presentation.toolInput ? prettyToolInput(presentation.toolInput) : (compactText(rawBody) || '(no content)'),
      DETAIL_MAX_LINES,
    );

    return (
      <Box marginBottom={1} flexDirection="column">
        <MessageHeader
          prefix={heading.prefix}
          label={heading.label}
          color={heading.color}
          meta={detailMeta}
          timestamp={timestamp}
        />
        {presentation.toolDescription && (
          <DetailBlock
            title="Tool"
            lines={[presentation.toolDescription]}
            color={T.fgDim}
            borderColor={T.tool}
          />
        )}
        <DetailBlock
          title={presentation.toolInput ? 'Parameters' : 'Details'}
          lines={bodyLines.lines}
          color={presentation.toolInput ? T.fgDim : T.fg}
          borderColor={T.borderLight}
          footer={bodyLines.hiddenLineCount > 0 ? `... ${bodyLines.hiddenLineCount} more line(s)` : undefined}
        />
      </Box>
    );
  }

  if (presentation.kind === 'tool_result') {
    const bodyLines = sliceVisibleLines(rawBody, TOOL_RESULT_MAX_LINES);
    const footer = [
      bodyLines.hiddenLineCount > 0 ? `... ${bodyLines.hiddenLineCount} more line(s)` : null,
      presentation.files.length > 0 ? `${presentation.files.length} image attachment(s)` : null,
    ].filter(Boolean).join(' · ');

    return (
      <Box marginBottom={1} flexDirection="column">
        <MessageHeader
          prefix={heading.prefix}
          label={heading.label}
          color={heading.color}
          meta={detailMeta || truncate(presentation.previewText || '(no preview)', 42)}
          timestamp={timestamp}
        />
        <DetailBlock
          title="Output"
          lines={bodyLines.lines}
          color={presentation.isError ? T.err : T.fgDim}
          borderColor={presentation.isError ? T.err : T.toolResult}
          footer={footer || undefined}
        />
      </Box>
    );
  }

  if (presentation.kind === 'skill_activation' || presentation.kind === 'skill_result_error' || presentation.kind === 'skill_resource_result' || presentation.kind === 'skill_activation_result') {
    const bodyLines = sliceVisibleLines(
      rawBody || (presentation.kind === 'skill_activation' ? 'Activating skill...' : '(no content)'),
      presentation.kind === 'skill_activation' ? 8 : TOOL_RESULT_MAX_LINES,
    );

    return (
      <Box marginBottom={1} flexDirection="column">
        <MessageHeader
          prefix={heading.prefix}
          label={heading.label}
          color={heading.color}
          meta={detailMeta}
          timestamp={timestamp}
        />
        <DetailBlock
          title={presentation.kind === 'skill_activation' ? 'Skill details' : 'Skill output'}
          lines={bodyLines.lines}
          color={presentation.kind === 'skill_result_error' ? T.err : T.fgDim}
          borderColor={presentation.kind === 'skill_result_error' ? T.err : T.skill}
          footer={bodyLines.hiddenLineCount > 0 ? `... ${bodyLines.hiddenLineCount} more line(s)` : undefined}
        />
      </Box>
    );
  }

  if (message.role === 'user') {
    const bodyLines = sliceVisibleLines(rawBody, DETAIL_MAX_LINES);

    return (
      <Box marginBottom={1} flexDirection="column">
        <MessageHeader
          prefix={heading.prefix}
          label={heading.label}
          color={heading.color}
          timestamp={timestamp}
        />
        <DetailBlock
          lines={bodyLines.lines}
          borderColor={T.user}
          footer={bodyLines.hiddenLineCount > 0 ? `... ${bodyLines.hiddenLineCount} more line(s)` : undefined}
        />
      </Box>
    );
  }

  const responseLines = sliceVisibleLines(rawBody, DETAIL_MAX_LINES);

  return (
    <Box marginBottom={1} flexDirection="column">
      <MessageHeader
        prefix={heading.prefix}
        label={heading.label}
        color={heading.color}
        timestamp={timestamp}
      />
      <DetailBlock
        lines={responseLines.lines}
        borderColor={message.role === 'system' ? T.system : T.assistant}
        footer={responseLines.hiddenLineCount > 0 ? `... ${responseLines.hiddenLineCount} more line(s)` : undefined}
      />
    </Box>
  );
}
