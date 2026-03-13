import { parseMCPToolId } from '@openbunny/shared/services/ai/mcp';
import type { MCPConnection } from '@openbunny/shared/stores/tools';
import { toolDisplayInfo } from '../components/ToolIcon';

export interface ResolvedToolDisplay {
  name: string;
  description: string;
  icon: string;
  isMCP: boolean;
  rawId: string;
}

export function resolveToolDisplay(toolId: string, mcpConnections: MCPConnection[]): ResolvedToolDisplay {
  const builtinInfo = toolDisplayInfo[toolId];
  if (builtinInfo) {
    return {
      ...builtinInfo,
      isMCP: false,
      rawId: toolId,
    };
  }

  const parsed = parseMCPToolId(toolId);
  if (!parsed) {
    return {
      name: toolId,
      description: toolId,
      icon: 'wrench',
      isMCP: false,
      rawId: toolId,
    };
  }

  const connection = mcpConnections.find((item) => item.id === parsed.connectionId);
  const descriptor = connection?.tools.find((tool) => tool.id === toolId || tool.name === parsed.toolName);
  const connectionName = connection?.name || 'MCP';
  const toolName = descriptor?.title || descriptor?.name || parsed.toolName;

  return {
    name: `${connectionName} / ${toolName}`,
    description: descriptor?.description || `${connectionName} / ${toolName}`,
    icon: 'plug',
    isMCP: true,
    rawId: toolId,
  };
}
