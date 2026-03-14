const MCP_TOOL_ID_PREFIX = 'mcp:';

export function isMCPToolId(toolId: string): boolean {
  return toolId.startsWith(MCP_TOOL_ID_PREFIX);
}

export function getMCPToolId(connectionId: string, toolName: string): string {
  return `${MCP_TOOL_ID_PREFIX}${connectionId}:${encodeURIComponent(toolName)}`;
}

export function parseMCPToolId(toolId: string): { connectionId: string; toolName: string } | null {
  if (!isMCPToolId(toolId)) {
    return null;
  }

  const payload = toolId.slice(MCP_TOOL_ID_PREFIX.length);
  const separatorIndex = payload.indexOf(':');
  if (separatorIndex === -1) {
    return null;
  }

  return {
    connectionId: payload.slice(0, separatorIndex),
    toolName: decodeURIComponent(payload.slice(separatorIndex + 1)),
  };
}
