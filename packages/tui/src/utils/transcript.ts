import type { Message, MessageFileAttachment, MessagePresentation, MessageSkillResource, Session } from '@openbunny/shared/types';
import {
  deriveMessagePresentation,
  formatFileSize,
  getMessageImageFiles,
} from '@openbunny/shared/utils/messagePresentation';
import { T } from '../theme.js';
import { getSessionSummary } from './sessionPresentation.js';
import { formatTime, truncate } from './formatting.js';

export interface TranscriptLine {
  key: string;
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  dimColor?: boolean;
  messageId?: string;
}

export interface TranscriptDocument {
  lines: TranscriptLine[];
  messageStartIndices: Map<string, number>;
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

function getBodyColor(message: Message, presentation: MessagePresentation): string {
  if (presentation.kind === 'process') return T.fgDim;
  if (presentation.kind === 'tool_result' && presentation.isError) return T.err;
  if (message.role === 'user') return T.fg;
  return T.fgDim;
}

function getCharWidth(char: string): number {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return 0;

  if (
    codePoint >= 0x1100 && (
      codePoint <= 0x115f ||
      codePoint === 0x2329 ||
      codePoint === 0x232a ||
      (codePoint >= 0x2e80 && codePoint <= 0xa4cf && codePoint !== 0x303f) ||
      (codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
      (codePoint >= 0xf900 && codePoint <= 0xfaff) ||
      (codePoint >= 0xfe10 && codePoint <= 0xfe19) ||
      (codePoint >= 0xfe30 && codePoint <= 0xfe6f) ||
      (codePoint >= 0xff00 && codePoint <= 0xff60) ||
      (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
      (codePoint >= 0x1f300 && codePoint <= 0x1f64f) ||
      (codePoint >= 0x1f900 && codePoint <= 0x1f9ff) ||
      (codePoint >= 0x20000 && codePoint <= 0x3fffd)
    )
  ) {
    return 2;
  }

  return 1;
}

function getDisplayWidth(text: string): number {
  let width = 0;

  for (const char of text) {
    width += getCharWidth(char);
  }

  return width;
}

function wrapPlainLine(text: string, width: number): string[] {
  const safeWidth = Math.max(1, width);
  const source = text.replace(/\t/g, '  ');

  if (!source) {
    return [''];
  }

  const result: string[] = [];
  let current = '';
  let currentWidth = 0;

  for (const char of source) {
    const charWidth = getCharWidth(char);

    if (currentWidth + charWidth > safeWidth) {
      result.push(current);
      current = char;
      currentWidth = charWidth;
      continue;
    }

    current += char;
    currentWidth += charWidth;
  }

  if (current || result.length === 0) {
    result.push(current);
  }

  return result;
}

function wrapWithPrefix(text: string, width: number, firstPrefix: string, restPrefix = firstPrefix): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const wrapped: string[] = [];

  lines.forEach((line, index) => {
    const prefix = index === 0 ? firstPrefix : restPrefix;
    const continuationPrefix = restPrefix;
    const prefixWidth = getDisplayWidth(prefix);
    const continuationWidth = getDisplayWidth(continuationPrefix);
    const chunks = wrapPlainLine(line, Math.max(1, width - prefixWidth));

    chunks.forEach((chunk, chunkIndex) => {
      const activePrefix = index === 0 && chunkIndex === 0 ? prefix : continuationPrefix;
      const maxWidth = Math.max(1, width - (chunkIndex === 0 && index === 0 ? prefixWidth : continuationWidth));
      const safeChunk = chunk || (maxWidth > 0 ? ' ' : '');
      wrapped.push(`${activePrefix}${safeChunk}`);
    });
  });

  return wrapped.length > 0 ? wrapped : [firstPrefix];
}

function pushLines(
  target: TranscriptLine[],
  lines: string[],
  options: Omit<TranscriptLine, 'key' | 'text'> & { keyBase: string },
) {
  lines.forEach((line, index) => {
    target.push({
      key: `${options.keyBase}-${index}`,
      text: line,
      color: options.color,
      bold: options.bold,
      italic: options.italic,
      dimColor: options.dimColor,
      messageId: options.messageId,
    });
  });
}

function buildMessageLines(
  message: Message,
  width: number,
  activeSearchMessageId: string | null,
): TranscriptLine[] {
  const presentation = deriveMessagePresentation(message);
  const heading = getMessageHeading(message);
  const meta = getMessageMeta(presentation);
  const timestamp = formatTime(message.timestamp);
  const body = compactText(getMessageBody(message)) || '(empty)';
  const imageFiles = getMessageImageFiles(message);
  const lines: TranscriptLine[] = [];
  const headingColor = message.id === activeSearchMessageId ? T.info : heading.color;
  const headerText = [
    `${heading.prefix} ${heading.label}`,
    meta || null,
    timestamp || null,
    message.id === activeSearchMessageId ? 'search hit' : null,
  ].filter(Boolean).join(' · ');

  pushLines(lines, wrapWithPrefix(headerText, width, '', '  '), {
    keyBase: `${message.id}-header`,
    color: headingColor,
    bold: true,
    messageId: message.id,
  });

  const bodyColor = getBodyColor(message, presentation);
  const pushSection = (
    keyBase: string,
    title: string,
    textLines: string[],
    color = bodyColor,
    prefix = '  ',
  ) => {
    pushLines(lines, wrapWithPrefix(title, width, '  ', '  '), {
      keyBase: `${message.id}-${keyBase}-title`,
      color: headingColor,
      bold: true,
      messageId: message.id,
    });
    pushLines(lines, textLines.flatMap((line) => wrapWithPrefix(line, width, prefix, prefix)), {
      keyBase: `${message.id}-${keyBase}`,
      color,
      dimColor: color === T.fgDim,
      messageId: message.id,
    });
  };

  if (presentation.kind === 'process') {
    if (presentation.toolDescription) {
      pushSection('tool', '  Tool', [presentation.toolDescription], T.fgDim);
    }

    pushSection(
      'details',
      presentation.toolInput ? '  Parameters' : '  Details',
      body.split('\n'),
      presentation.toolInput ? T.fgDim : T.fg,
    );
  } else if (presentation.kind === 'tool_result') {
    pushSection('output', '  Output', body.split('\n'), presentation.isError ? T.err : T.fgDim);

    const attachmentLines = formatAttachmentSummary(presentation.files);
    if (attachmentLines.length > 0) {
      pushSection('artifacts', '  Artifacts', attachmentLines, T.fgMuted);
    }
  } else if (
    presentation.kind === 'skill_activation' ||
    presentation.kind === 'skill_result_error' ||
    presentation.kind === 'skill_resource_result' ||
    presentation.kind === 'skill_activation_result'
  ) {
    pushSection(
      'skill-output',
      presentation.kind === 'skill_activation' ? '  Skill details' : '  Skill output',
      body.split('\n'),
      presentation.kind === 'skill_result_error' ? T.err : T.fgDim,
    );

    if (presentation.kind === 'skill_activation_result') {
      const resourceLines = formatSkillResources(presentation.resources);
      if (resourceLines.length > 0) {
        pushSection('resources', '  Resources', resourceLines, T.fgMuted);
      }
    }

    if (presentation.kind === 'skill_resource_result') {
      const attachmentLines = formatAttachmentSummary(presentation.files);
      if (attachmentLines.length > 0) {
        pushSection('artifacts', '  Artifacts', attachmentLines, T.fgMuted);
      }
    }
  } else {
    pushLines(lines, body.split('\n').flatMap((line) => wrapWithPrefix(line, width, '  ', '  ')), {
      keyBase: `${message.id}-body`,
      color: bodyColor,
      dimColor: bodyColor === T.fgDim,
      messageId: message.id,
    });

    const artifactLines = presentation.kind === 'markdown'
      ? [
          ...formatPlotSummary(presentation.plots),
          ...formatAttachmentSummary(imageFiles),
        ]
      : [];

    if (artifactLines.length > 0) {
      pushSection('artifacts', '  Artifacts', artifactLines, T.fgMuted);
    }
  }

  lines.push({
    key: `${message.id}-spacer`,
    text: ' ',
    color: T.fgSubtle,
    messageId: message.id,
  });

  return lines;
}

export function buildTranscriptDocument({
  session,
  messages,
  width,
  activeSearchMessageId,
}: {
  session: Session | null;
  messages: Message[];
  width: number;
  activeSearchMessageId: string | null;
}): TranscriptDocument {
  const safeWidth = Math.max(20, width);
  const lines: TranscriptLine[] = [];
  const messageStartIndices = new Map<string, number>();

  messages.forEach((message) => {
    messageStartIndices.set(message.id, lines.length);
    lines.push(...buildMessageLines(message, safeWidth, activeSearchMessageId));
  });

  const sessionSummary = getSessionSummary(session);
  if (sessionSummary) {
    pushLines(lines, wrapWithPrefix('Summary', safeWidth, '', ''), {
      keyBase: 'summary-header',
      color: T.assistant,
      bold: true,
    });
    pushLines(lines, wrapWithPrefix('Session summary mirrored from paired dialogue state.', safeWidth, '  ', '  '), {
      keyBase: 'summary-caption',
      color: T.fgSubtle,
    });
    pushLines(lines, sessionSummary
      .replace(/\r\n/g, '\n')
      .split('\n')
      .flatMap((line) => wrapWithPrefix(line || ' ', safeWidth, '  ', '  ')), {
      keyBase: 'summary-body',
      color: T.fgDim,
      dimColor: true,
    });
  }

  return {
    lines,
    messageStartIndices,
  };
}
