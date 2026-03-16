import { Box, Text } from 'ink';
import type { Message } from '@openbunny/shared/types';
import {
  deriveMessagePresentation,
  formatFileSize,
} from '@openbunny/shared/utils/messagePresentation';
import { T } from '../../theme.js';
import { formatTime } from '../../utils/formatting.js';

interface MessageBubbleProps {
  message: Message;
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
      const content = presentation.toolName === 'exec'
        ? simplifyExecToolOutput(presentation.content || '')
        : (presentation.content || '(no output)');
      const imageSummary = presentation.files.length > 0
        ? `\n\nAttached files:\n${presentation.files.map((file, i) => (
            `  ${i + 1}. ${file.filename || 'image'} (${file.mediaType})`
          )).join('\n')}`
        : '';
      return `${content}${imageSummary}`;
    }
    case 'skill_activation':
      return [
        presentation.resourcePath ? `Resource: ${presentation.resourcePath}` : null,
        presentation.skillDescription || null,
      ].filter(Boolean).join('\n') || 'Activating skill...';
    case 'skill_result_error':
      return presentation.content;
    case 'skill_resource_result':
      return [
        `Path: ${presentation.resourcePath}`,
        presentation.files.length > 0
          ? `Attachments: ${presentation.files.map((f) => `${f.filename || 'file'} (${f.mediaType})`).join(', ')}`
          : null,
        presentation.fileContent,
      ].filter(Boolean).join('\n');
    case 'skill_activation_result':
      return [
        presentation.skillBody,
        presentation.resources.length > 0
          ? `Resources:\n${presentation.resources.map((r) => (
              `  - ${r.type.toUpperCase()} ${r.path}${typeof r.size === 'number' ? ` (${formatFileSize(r.size)})` : ''}`
            )).join('\n')}`
          : null,
      ].filter(Boolean).join('\n\n');
    case 'system':
    case 'markdown':
    default:
      return message.content;
  }
}

const TOOL_RESULT_MAX_LINES = 8;

function isToolMessage(message: Message): boolean {
  const p = deriveMessagePresentation(message);
  return p.kind === 'process' || p.kind === 'tool_result';
}

function collapseToolResult(body: string, message: Message): { text: string; collapsed: boolean; totalLines: number } {
  const p = deriveMessagePresentation(message);
  if (p.kind !== 'tool_result') return { text: body, collapsed: false, totalLines: 0 };
  const lines = body.split('\n');
  if (lines.length <= TOOL_RESULT_MAX_LINES) return { text: body, collapsed: false, totalLines: lines.length };
  return {
    text: lines.slice(0, TOOL_RESULT_MAX_LINES).join('\n'),
    collapsed: true,
    totalLines: lines.length,
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const heading = getMessageHeading(message);
  const rawBody = getMessageBody(message);
  const isTool = isToolMessage(message);
  const { text: body, collapsed, totalLines } = collapseToolResult(rawBody, message);
  const timestamp = formatTime(message.timestamp);

  if (isTool) {
    return (
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color={heading.color}>{heading.prefix} {heading.label}</Text>
          {timestamp && <Text color={T.fgSubtle}>  {timestamp}</Text>}
        </Box>
        <Box
          marginLeft={2}
          borderStyle="single"
          borderLeft
          borderRight={false}
          borderTop={false}
          borderBottom={false}
          borderColor={T.borderLight}
          paddingLeft={1}
          flexDirection="column"
        >
          <Text wrap="wrap" color={T.fgDim}>{body}</Text>
          {collapsed && (
            <Text color={T.fgMuted} italic>... {totalLines - TOOL_RESULT_MAX_LINES} more lines</Text>
          )}
        </Box>
      </Box>
    );
  }

  /* User messages: prefix with > in accent color */
  if (message.role === 'user') {
    return (
      <Box marginBottom={1} flexDirection="column">
        <Box>
          <Text bold color={heading.color}>{heading.prefix} </Text>
          <Text wrap="wrap" color={T.fg}>{body}</Text>
          {timestamp && <Text color={T.fgSubtle}>  {timestamp}</Text>}
        </Box>
      </Box>
    );
  }

  return (
    <Box marginBottom={1} flexDirection="column">
      <Box>
        <Text bold color={heading.color}>{heading.prefix} {heading.label}</Text>
        {timestamp && <Text color={T.fgSubtle}>  {timestamp}</Text>}
      </Box>
      <Box marginLeft={2} flexDirection="column">
        <Text wrap="wrap" color={T.fg}>{body}</Text>
      </Box>
    </Box>
  );
}
