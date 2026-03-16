import { Box, Text } from 'ink';
import type { Message, MessageFileAttachment, MessagePresentation, MessageSkillResource } from '@openbunny/shared/types';
import {
  deriveMessagePresentation,
  formatFileSize,
  getMessageImageFiles,
} from '@openbunny/shared/utils/messagePresentation';
import { T, getNoticeColor } from '../../theme.js';
import type { NoticeTone } from '../../types.js';
import { formatTime, truncate } from '../../utils/formatting.js';

export const BUNNY_LOGO_LINES = [
  '   (\\_/)',
  "  (='.'=)",
  '  (")_(")',
];

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

function compactText(content: string): string {
  return content
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function simplifyMarkdown(content: string): string {
  const trimmed = compactText(content);
  if (!trimmed) return '';

  const fencedMatch = trimmed.match(/^```(?:[\w-]+)?\n?([\s\S]*?)\n?```$/);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }

  return trimmed
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, '• ')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
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

function formatPlotSummary(plots: string[]): string[] {
  if (plots.length === 0) return [];
  return plots.map((_, index) => `Plot ${index + 1} generated (render in WEB/Desktop).`);
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

  return presentation.toolName === 'exec'
    ? simplifyExecToolOutput(presentation.content || '')
    : (presentation.content || '(no output)');
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
    ].filter(Boolean).join('\n\n');
  }

  if (presentation.kind === 'skill_activation_result') {
    return presentation.skillBody || '(skill loaded)';
  }

  return '';
}

function getMessageHeading(message: Message): { prefix: string; label: string; color: string } {
  const presentation = deriveMessagePresentation(message);
  const speaker = typeof message.metadata?.speakerAgentName === 'string'
    ? message.metadata.speakerAgentName
    : undefined;

  if (message.role === 'system') return { prefix: '!', label: 'System', color: T.system };
  if (message.role === 'user') return { prefix: '>', label: 'You', color: T.user };

  if (presentation.kind === 'process') {
    if (presentation.stage === 'tool_call') {
      return { prefix: '+', label: presentation.toolName || 'Tool Call', color: T.tool };
    }
    return { prefix: '~', label: speaker || 'Thinking', color: T.thinking };
  }

  if (presentation.kind === 'tool_result') {
    return {
      prefix: presentation.isError ? 'x' : 'v',
      label: presentation.toolName || 'Tool Result',
      color: presentation.isError ? T.err : T.toolResult,
    };
  }

  if (presentation.kind === 'skill_activation') return { prefix: '*', label: presentation.skillName || 'Skill', color: T.skill };
  if (presentation.kind === 'skill_result_error') return { prefix: 'x', label: 'Skill Error', color: T.err };
  if (presentation.kind === 'skill_resource_result') return { prefix: '*', label: presentation.skillName || 'Skill Resource', color: T.skill };
  if (presentation.kind === 'skill_activation_result') return { prefix: '*', label: presentation.skillName || 'Skill Loaded', color: T.skill };

  return { prefix: '(\\_/)', label: speaker || 'Bunny', color: T.assistant };
}

function shouldRenderBoxed(presentation: MessagePresentation): boolean {
  switch (presentation.kind) {
    case 'process':
    case 'tool_result':
    case 'skill_activation':
    case 'skill_result_error':
    case 'skill_resource_result':
    case 'skill_activation_result':
    case 'system':
      return true;
    default:
      return false;
  }
}

function getBodyColor(message: Message, presentation: MessagePresentation): string {
  if (presentation.kind === 'process') return T.fgDim;
  if (presentation.kind === 'tool_result' && presentation.isError) return T.err;
  if (message.role === 'user') return T.fg;
  return T.fgDim;
}

function getMessageBody(message: Message): string {
  const presentation = deriveMessagePresentation(message);

  switch (presentation.kind) {
    case 'process':
      return presentation.toolInput ? prettyToolInput(presentation.toolInput) : (message.content || '(no content)');
    case 'tool_result':
      return getToolResultBody(message, presentation);
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

function getMessageMeta(presentation: MessagePresentation): string | undefined {
  if (presentation.kind === 'process') {
    return [
      presentation.stage === 'tool_call' ? 'call' : 'step',
      presentation.toolName ? truncate(presentation.toolName, 22) : null,
      presentation.isStreaming ? 'streaming' : null,
    ].filter(Boolean).join(' · ');
  }

  if (presentation.kind === 'tool_result') {
    return [
      presentation.toolName ? truncate(presentation.toolName, 22) : null,
      presentation.isError ? 'error' : 'ok',
      presentation.isStreaming ? 'streaming' : null,
    ].filter(Boolean).join(' · ');
  }

  if (presentation.kind === 'skill_activation') {
    return [
      presentation.skillName || 'unknown',
      presentation.resourcePath ? truncate(presentation.resourcePath, 24) : null,
      presentation.isStreaming ? 'streaming' : null,
    ].filter(Boolean).join(' · ');
  }

  if (presentation.kind === 'skill_resource_result') {
    return [
      presentation.skillName || 'resource',
      truncate(presentation.resourcePath, 24),
    ].filter(Boolean).join(' · ');
  }

  if (presentation.kind === 'skill_activation_result') {
    return [
      presentation.skillName || 'skill',
      presentation.resources.length > 0 ? `${presentation.resources.length} resource(s)` : null,
    ].filter(Boolean).join(' · ');
  }

  return undefined;
}

function getBodyLines(message: Message, presentation: MessagePresentation): string[] {
  const body = compactText(getMessageBody(message));
  const baseLines = body ? body.split('\n') : ['(empty)'];
  const imageFiles = getMessageImageFiles(message);

  if (presentation.kind === 'tool_result') {
    return [
      ...baseLines,
      ...formatAttachmentSummary(presentation.files),
    ];
  }

  if (presentation.kind === 'skill_resource_result') {
    return [
      ...baseLines,
      ...formatAttachmentSummary(presentation.files),
    ];
  }

  if (presentation.kind === 'skill_activation_result') {
    return [
      ...baseLines,
      ...formatSkillResources(presentation.resources),
    ];
  }

  if (presentation.kind === 'markdown') {
    return [
      ...baseLines,
      ...formatPlotSummary(presentation.plots),
      ...formatAttachmentSummary(imageFiles),
    ];
  }

  return baseLines;
}

export function isStreamingMessage(message: Message): boolean {
  const presentation = deriveMessagePresentation(message);

  switch (presentation.kind) {
    case 'process':
    case 'tool_result':
    case 'skill_activation':
      return presentation.isStreaming;
    default:
      return message.metadata?.streaming === true;
  }
}

export function TranscriptMessage({ message }: { message: Message }) {
  const presentation = deriveMessagePresentation(message);
  const heading = getMessageHeading(message);
  const meta = getMessageMeta(presentation);
  const timestamp = formatTime(message.timestamp);
  const bodyLines = getBodyLines(message, presentation);
  const boxed = shouldRenderBoxed(presentation);
  const bodyColor = getBodyColor(message, presentation);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text bold color={heading.color}>{heading.label.toUpperCase()}</Text>
        {meta && <Text color={T.fgMuted}> · {meta}</Text>}
        {timestamp && <Text color={T.fgSubtle}> · {timestamp}</Text>}
      </Box>
      {boxed ? (
        <Box borderStyle="round" borderColor={heading.color} paddingX={1} flexDirection="column">
          {bodyLines.map((line, index) => (
            <Text key={`${message.id}-${index}-${line}`} wrap="wrap" color={bodyColor}>
              {line || ' '}
            </Text>
          ))}
        </Box>
      ) : (
        <Box flexDirection="column">
          {bodyLines.map((line, index) => (
            <Box key={`${message.id}-${index}-${line}`}>
              <Text color={heading.color}>{message.role === 'user' ? '› ' : '│ '}</Text>
              <Text wrap="wrap" color={bodyColor}>{line || ' '}</Text>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

export function TranscriptNotice({
  content,
  tone = 'info',
  label,
}: {
  content: string;
  tone?: NoticeTone;
  label?: string;
}) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const color = getNoticeColor(tone);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={color}>{(label || tone).toUpperCase()}</Text>
      {lines.map((line, index) => (
        <Box key={`${label || tone}-${index}-${line}`}>
          <Text color={color}>· </Text>
          <Text wrap="wrap" color={T.fgDim}>{line || ' '}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function TranscriptBanner() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      {BUNNY_LOGO_LINES.map((line) => (
        <Text key={line} color={T.brandLight}>{line}</Text>
      ))}
      <Text bold color={T.brand}>OpenBunny TUI</Text>
    </Box>
  );
}
