import type { Message, Session } from '@openbunny/shared/types';
import { MessageHistoryManager } from '@openbunny/shared/utils/messageHistory';
import { getMessageDisplayType, getMessageToolName } from '@openbunny/shared/utils/messagePresentation';
import { truncate } from './formatting.js';

export type ExportFormat = 'json' | 'markdown' | 'text';

export interface SearchCommandArgs {
  query: string;
  caseSensitive: boolean;
  searchInToolOutput: boolean;
}

export function parseExportArgs(rawArgs: string): { format: ExportFormat; outputPath?: string } {
  const trimmed = rawArgs.trim();
  if (!trimmed) return { format: 'markdown' };

  const [firstToken, ...restTokens] = trimmed.split(/\s+/);
  if (firstToken === 'json' || firstToken === 'markdown' || firstToken === 'text') {
    return {
      format: firstToken,
      outputPath: restTokens.join(' ').trim() || undefined,
    };
  }

  return {
    format: 'markdown',
    outputPath: trimmed,
  };
}

export function buildDefaultExportName(session: Session, format: ExportFormat): string {
  const extension = format === 'json' ? 'json' : format === 'text' ? 'txt' : 'md';
  const safeSessionName = (session.name || 'conversation')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    || 'conversation';
  return `${safeSessionName}-${session.id.slice(0, 8)}.${extension}`;
}

function stripLeadingFlag(value: string, flags: string[]): { matched: boolean; rest: string } {
  for (const flag of flags) {
    const pattern = new RegExp(`^${flag}(?:\\s+|$)`);
    if (pattern.test(value)) {
      return {
        matched: true,
        rest: value.replace(pattern, '').trimStart(),
      };
    }
  }

  return { matched: false, rest: value };
}

export function parseSearchArgs(rawArgs: string): SearchCommandArgs {
  let rest = rawArgs.trim();
  let caseSensitive = false;
  let searchInToolOutput = true;

  while (rest.startsWith('-')) {
    if (/^--(?:\s+|$)/.test(rest)) {
      rest = rest.replace(/^--(?:\s+|$)/, '').trimStart();
      break;
    }

    const caseFlag = stripLeadingFlag(rest, ['--case-sensitive', '-c']);
    if (caseFlag.matched) {
      caseSensitive = true;
      rest = caseFlag.rest;
      continue;
    }

    const contentOnlyFlag = stripLeadingFlag(rest, ['--content-only']);
    if (contentOnlyFlag.matched) {
      searchInToolOutput = false;
      rest = contentOnlyFlag.rest;
      continue;
    }

    const toolOutputFlag = stripLeadingFlag(rest, ['--tool-output']);
    if (toolOutputFlag.matched) {
      searchInToolOutput = true;
      rest = toolOutputFlag.rest;
      continue;
    }

    break;
  }

  return {
    query: rest.trim(),
    caseSensitive,
    searchInToolOutput,
  };
}

export function describeSearchArgs(options: Pick<SearchCommandArgs, 'caseSensitive' | 'searchInToolOutput'>): string {
  return [
    options.caseSensitive ? 'case-sensitive' : 'case-insensitive',
    options.searchInToolOutput ? 'content + tool output' : 'content only',
  ].join(' · ');
}

export function formatSearchResult(match: Message): string {
  const type = getMessageDisplayType(match) || match.role;
  const toolName = getMessageToolName(match);
  const summary = MessageHistoryManager.getMessageSummary(match);
  const rawText = summary.searchableToolOutput || match.content || '(no content)';
  const snippet = truncate(rawText.replace(/\s+/g, ' ').trim() || '(no content)', 96);
  const meta = toolName ? ` ${toolName}` : '';
  return `  ${new Date(match.timestamp).toLocaleTimeString()}  ${type}${meta}  ${snippet}`;
}
