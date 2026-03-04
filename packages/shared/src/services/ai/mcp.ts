/**
 * MCP Client integration using @ai-sdk/mcp
 */

import { createMCPClient } from '@ai-sdk/mcp';

export async function connectMCPServer(url: string) {
  const client = await createMCPClient({
    transport: { type: 'sse', url },
  });
  const tools = await client.tools();
  return { client, tools };
}

export type MCPClient = Awaited<ReturnType<typeof createMCPClient>>;
