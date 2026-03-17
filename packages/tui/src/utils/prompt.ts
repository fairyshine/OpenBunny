export interface PromptFileMention {
  raw: string;
  path: string;
  start: number;
  end: number;
}

export interface ResolvedPromptFileMention {
  raw: string;
  path: string;
  displayPath: string;
  content: string;
  size: number;
}

const FILE_MENTION_REGEX = /(^|\s)@(?:"([^"]+)"|'([^']+)'|([^\s"']+))/g;

export function parsePromptFileMentions(input: string): PromptFileMention[] {
  const mentions: PromptFileMention[] = [];

  for (const match of input.matchAll(FILE_MENTION_REGEX)) {
    const mentionPath = match[2] || match[3] || match[4];
    const prefix = match[1] || '';
    const atIndex = (match.index ?? 0) + prefix.length;

    if (!mentionPath) {
      continue;
    }

    mentions.push({
      raw: match[0].slice(prefix.length),
      path: mentionPath,
      start: atIndex,
      end: atIndex + match[0].slice(prefix.length).length,
    });
  }

  return mentions;
}

export function replacePromptMentions(
  input: string,
  resolvedMentions: ResolvedPromptFileMention[],
): string {
  if (resolvedMentions.length === 0) {
    return input;
  }

  const displayByRaw = new Map(resolvedMentions.map((mention) => [mention.raw, mention.displayPath]));
  return input.replace(FILE_MENTION_REGEX, (match, prefix = '', doubleQuoted, singleQuoted, barePath) => {
    const mentionPath = doubleQuoted || singleQuoted || barePath;
    const raw = `@${doubleQuoted ? `"${mentionPath}"` : singleQuoted ? `'${mentionPath}'` : mentionPath}`;
    const displayPath = displayByRaw.get(raw);

    if (!displayPath) {
      return match;
    }

    return `${prefix}@${displayPath}`;
  });
}

export async function resolvePromptFileMentions(
  input: string,
  loadFile: (inputPath: string) => Promise<{ displayPath: string; content: string; size: number }>,
): Promise<ResolvedPromptFileMention[]> {
  const mentions = parsePromptFileMentions(input);
  const uniqueMentions = new Map<string, PromptFileMention>();

  for (const mention of mentions) {
    if (!uniqueMentions.has(mention.raw)) {
      uniqueMentions.set(mention.raw, mention);
    }
  }

  const resolvedMentions: ResolvedPromptFileMention[] = [];
  for (const mention of uniqueMentions.values()) {
    const file = await loadFile(mention.path);
    resolvedMentions.push({
      raw: mention.raw,
      path: mention.path,
      displayPath: file.displayPath,
      content: file.content.replace(/\r\n/g, '\n'),
      size: file.size,
    });
  }

  return resolvedMentions;
}

export function buildPromptWithFileContext(
  input: string,
  resolvedMentions: ResolvedPromptFileMention[],
): string {
  if (resolvedMentions.length === 0) {
    return input;
  }

  const normalizedInput = replacePromptMentions(input, resolvedMentions);
  const fileBlocks = resolvedMentions.map((mention) => (
    `<file path="${mention.displayPath}" size="${mention.size}">\n${mention.content}\n</file>`
  ));

  return [
    normalizedInput,
    '',
    '<workspace_context>',
    ...fileBlocks,
    '</workspace_context>',
  ].join('\n');
}

export function getPromptModeLabel(input: string, mentionCount: number): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('/')) {
    return 'Slash command mode · Enter runs the command directly';
  }

  if (trimmed.startsWith('!')) {
    return 'Shell mode · Enter runs the command in the workspace';
  }

  if (mentionCount > 0) {
    return `Context mode · ${mentionCount} file reference(s) will be injected into the prompt`;
  }

  return 'Chat mode · Enter sends the prompt to the active session';
}
