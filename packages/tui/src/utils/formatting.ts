import type { LLMConfig } from '@openbunny/shared/types';

export function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 1) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 1)}...`;
}

export function encodeEscapedText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

export function decodeEscapedText(value: string): string {
  return value
    .replace(/\\\\/g, '\u0000')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\u0000/g, '\\');
}

export function formatTimeout(timeoutMs: number): string {
  if (timeoutMs % 60000 === 0) return `${timeoutMs / 60000}m`;
  if (timeoutMs % 1000 === 0) return `${timeoutMs / 1000}s`;
  return `${timeoutMs}ms`;
}

export function formatConfigSummary(
  config: LLMConfig,
  options?: { workspace?: string; configDir?: string; sessionId?: string },
): string {
  const lines = [
    '',
    '  Runtime Configuration',
    `    Provider:    ${config.provider}`,
    `    Model:       ${config.model}`,
    `    Temperature: ${config.temperature}`,
    `    Max tokens:  ${config.maxTokens}`,
    `    Base URL:    ${config.baseUrl ?? '(default)'}`,
    `    API key:     ${config.apiKey ? `${config.apiKey.slice(0, 8)}...` : '(not set)'}`,
    ...(options?.workspace ? [`    Workspace:   ${options.workspace}`] : []),
    ...(options?.configDir ? [`    Config dir:  ${options.configDir}`] : []),
    ...(options?.sessionId ? [`    Session:     ${options.sessionId}`] : []),
    '',
    '  Runtime Commands',
    '    /config                 Show current runtime config',
    '    /model <name>           Set model for this TUI session',
    '    /provider <id>          Set provider for this TUI session',
    '    /temperature <value>    Set temperature',
    '    /max-tokens <value>     Set max tokens',
    '    /base-url <url>         Set custom base URL',
    '    /api-key <key>          Set API key',
    '    /save-config            Persist current runtime config',
    '    /agents                 Show available agents',
    '    /agent <id>             Switch current agent',
    '    /agent-new <name>       Create a new agent',
    '    /sessions [filter]      List sessions by type',
    '    /tabs                   List workspace tabs',
    '    /tab <op>               Switch or close a tab',
    '    /delete <id>            Move a workspace session to trash',
    '    /trash                  Show workspace trash',
    '    /restore <id>           Restore a trashed session',
    '    /purge <id>             Permanently delete a session',
    '    /empty-trash            Permanently clear workspace trash',
    '    /tools                  Show enabled tools',
    '    /tool on|off <id>       Toggle a tool',
    '    /skills                 Show enabled skills',
    '    /skill on|off <id>      Toggle a skill',
    '    /search [flags]         Search the current session',
    '    /stats                  Show persisted usage statistics',
    '    /conn-test              Run an LLM connection test',
    '    /files                  List workspace files',
    '    /cd <path>              Change current workspace directory',
    '    /open <path>            Preview a workspace file',
    '    /write <p> <txt>        Overwrite a workspace file using escaped text',
    '    /mcp                    List MCP connections',
    '    /mcp add <n> <u> [t]    Add and sync an MCP connection',
    '    /mcp sync <id>          Refresh an MCP connection',
    '    /mcp remove <id>        Remove an MCP connection',
    '    /stop                   Stop the current response',
    '    /shell <command>        Run a shell command in the workspace',
    '    /new                    Create a new chat session',
    '',
  ];
  return lines.join('\n');
}

export function getSlidingWindow<T>(items: T[], selectedIndex: number, maxVisible: number) {
  if (items.length <= maxVisible) {
    return { items, startIndex: 0, hiddenBefore: 0, hiddenAfter: 0 };
  }
  const half = Math.floor(maxVisible / 2);
  const startIndex = Math.max(0, Math.min(selectedIndex - half, items.length - maxVisible));
  const endIndex = startIndex + maxVisible;
  return {
    items: items.slice(startIndex, endIndex),
    startIndex,
    hiddenBefore: startIndex,
    hiddenAfter: Math.max(0, items.length - endIndex),
  };
}

export function formatTime(timestamp?: number): string {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
