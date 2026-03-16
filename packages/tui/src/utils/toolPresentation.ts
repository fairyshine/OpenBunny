import { parseMCPToolId } from '@openbunny/shared/services/ai/mcpToolId';
import type { MCPConnection } from '@openbunny/shared/stores/tools';
import { TOOL_DESCRIPTIONS } from '../constants.js';

const BUILTIN_TOOL_LABELS: Record<string, string> = {
  python: 'Python',
  web_search: 'Web Search',
  file_manager: 'File Manager',
  memory: 'Memory',
  mind: 'Mind',
  chat: 'Chat',
  exec: 'Shell Exec',
  cron: 'Cron',
  heartbeat: 'Heartbeat',
};

export interface ToolEntry {
  id: string;
  label: string;
  description: string;
  isMcp: boolean;
  connectionId?: string;
  connectionName?: string;
  connectionStatus?: MCPConnection['status'];
}

function getBuiltinToolLabel(toolId: string): string {
  return BUILTIN_TOOL_LABELS[toolId] || toolId;
}

function getMcpToolLabel(connectionName: string, toolName: string, title?: string): string {
  return `${connectionName} / ${title || toolName}`;
}

function normalizeCandidate(value: string | undefined): string | null {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}

export function getAvailableToolEntries(
  builtinToolIds: string[],
  mcpConnections: MCPConnection[],
): ToolEntry[] {
  const builtinEntries = builtinToolIds
    .filter((toolId) => toolId !== 'file_manager')
    .map((toolId) => ({
      id: toolId,
      label: getBuiltinToolLabel(toolId),
      description: TOOL_DESCRIPTIONS[toolId] || toolId,
      isMcp: false,
    }));

  const mcpEntries = mcpConnections.flatMap((connection) => (
    connection.tools.map((tool) => ({
      id: tool.id,
      label: getMcpToolLabel(connection.name, tool.name, tool.title),
      description: tool.description || `${connection.name} / ${tool.title || tool.name}`,
      isMcp: true,
      connectionId: connection.id,
      connectionName: connection.name,
      connectionStatus: connection.status,
    }))
  ));

  return [...builtinEntries, ...mcpEntries];
}

export function resolveToolEntry(
  toolId: string,
  entries: ToolEntry[],
): ToolEntry {
  const existing = entries.find((entry) => entry.id === toolId);
  if (existing) {
    return existing;
  }

  const parsed = parseMCPToolId(toolId);
  if (!parsed) {
    return {
      id: toolId,
      label: getBuiltinToolLabel(toolId),
      description: TOOL_DESCRIPTIONS[toolId] || toolId,
      isMcp: false,
    };
  }

  return {
    id: toolId,
    label: `${parsed.connectionId} / ${parsed.toolName}`,
    description: toolId,
    isMcp: true,
    connectionId: parsed.connectionId,
  };
}

export function findToolEntries(query: string, entries: ToolEntry[]): ToolEntry[] {
  const normalizedQuery = normalizeCandidate(query);
  if (!normalizedQuery) {
    return [];
  }

  const exactMatches = entries.filter((entry) => {
    const candidates = [
      entry.id,
      entry.label,
      entry.connectionName,
      parseMCPToolId(entry.id)?.toolName,
    ];

    return candidates.some((candidate) => normalizeCandidate(candidate) === normalizedQuery);
  });

  if (exactMatches.length > 0) {
    return exactMatches;
  }

  return entries.filter((entry) => {
    const candidates = [
      entry.id,
      entry.label,
      entry.connectionName,
      parseMCPToolId(entry.id)?.toolName,
    ];

    return candidates.some((candidate) => normalizeCandidate(candidate)?.includes(normalizedQuery));
  });
}
