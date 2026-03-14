/**
 * MCP Client integration using @ai-sdk/mcp
 */

import type { Tool, ToolExecutionOptions } from 'ai';
import { logMCP } from '../console/logger';
import { getErrorMessage } from '../../utils/errors';
import type { MCPConnection, MCPToolDescriptor, MCPTransportType } from '../../stores/tools';
import { getMCPToolId, parseMCPToolId } from './mcpToolId';

type CreateMCPClient = (typeof import('@ai-sdk/mcp'))['createMCPClient'];
export type MCPClient = Awaited<ReturnType<CreateMCPClient>>;

interface MCPConnectionInput {
  id: string;
  name: string;
  url: string;
  transport?: MCPTransportType;
}

interface MCPConnectionOptions {
  proxyUrl?: string;
}

interface LoadEnabledMCPToolsOptions extends MCPConnectionOptions {
  reservedToolNames?: string[];
  timeoutMs?: number;
  abortSignal?: AbortSignal;
  onConnectionStatusChange?: (
    connectionId: string,
    status: MCPConnection['status'],
    error?: string | null,
  ) => void;
}

let createMCPClientPromise: Promise<CreateMCPClient> | null = null;

async function getCreateMCPClient(): Promise<CreateMCPClient> {
  createMCPClientPromise ??= import('@ai-sdk/mcp').then((module) => module.createMCPClient);
  return createMCPClientPromise;
}

function raceWithAbort<T>(promise: Promise<T>, abortSignal?: AbortSignal): Promise<T> {
  if (!abortSignal) return promise;
  if (abortSignal.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }

  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      abortSignal.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      }, { once: true });
    }),
  ]);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs?: number, message = 'MCP operation timed out'): Promise<T> {
  if (!timeoutMs || timeoutMs === -1) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(message)), timeoutMs)),
  ]);
}

function withAbortAndTimeout<T>(promise: Promise<T>, abortSignal?: AbortSignal, timeoutMs?: number, timeoutMessage?: string): Promise<T> {
  return raceWithAbort(withTimeout(promise, timeoutMs, timeoutMessage), abortSignal);
}

function wrapMCPTool(tool: Tool, timeoutMs?: number): Tool {
  if (!tool.execute) return tool;

  return {
    ...tool,
    execute: async (input: unknown, options: ToolExecutionOptions) => {
      options?.abortSignal?.throwIfAborted?.();
      return withAbortAndTimeout(
        Promise.resolve(tool.execute!(input as never, options)),
        options?.abortSignal,
        timeoutMs,
        `MCP tool execution timed out after ${timeoutMs}ms`,
      );
    },
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function isElectron(): boolean {
  return isBrowser() && typeof (window as any).electronAPI !== 'undefined';
}

function resolveProxyUrl(targetUrl: string, proxyUrl?: string): string {
  if (!isBrowser() || isElectron()) {
    return targetUrl;
  }

  const origin = window.location.origin;
  const isLocalhostApp = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocalhostApp) {
    return new URL(`/api/proxy?target=${encodeURIComponent(targetUrl)}`, origin).toString();
  }

  if (proxyUrl) {
    const workerBase = proxyUrl.replace(/\/+$/, '');
    return `${workerBase}/proxy?target=${encodeURIComponent(targetUrl)}`;
  }

  return targetUrl;
}

function resolveConnectionUrl(connection: Pick<MCPConnectionInput, 'url' | 'transport'>, proxyUrl?: string): string {
  const normalizedUrl = connection.url.trim();
  if ((connection.transport || 'http') !== 'http') {
    return normalizedUrl;
  }
  return resolveProxyUrl(normalizedUrl, proxyUrl);
}

function toTransportType(transport?: MCPTransportType): MCPTransportType {
  return transport || 'http';
}

function makeUniqueToolName(baseName: string, connectionName: string, usedNames: Set<string>): string {
  if (!usedNames.has(baseName)) {
    return baseName;
  }

  const connectionSlug = connectionName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'mcp';
  let candidate = `${connectionSlug}__${baseName}`;
  let counter = 2;

  while (usedNames.has(candidate)) {
    candidate = `${connectionSlug}_${counter}__${baseName}`;
    counter += 1;
  }

  return candidate;
}

export async function connectMCPServer(connection: string | MCPConnectionInput, options?: MCPConnectionOptions) {
  const normalized = typeof connection === 'string'
    ? {
        id: 'adhoc',
        name: 'MCP',
        url: connection,
        transport: 'http' as MCPTransportType,
      }
    : {
        ...connection,
        transport: toTransportType(connection.transport),
      };

  const createMCPClient = await getCreateMCPClient();
  const client = await createMCPClient({
    transport: {
      type: normalized.transport,
      url: resolveConnectionUrl(normalized, options?.proxyUrl),
    },
    onUncaughtError: (error) => {
      const message = getErrorMessage(error);
      if (message.includes('GET SSE failed: 400') || message.includes('GET SSE failed: 405')) {
        logMCP('warning', `MCP inbound SSE unavailable: ${normalized.name}`, message);
        return;
      }
      logMCP('error', `MCP uncaught error: ${normalized.name}`, message);
    },
  });

  return client;
}

export async function discoverMCPConnection(
  connection: MCPConnectionInput,
  options?: MCPConnectionOptions,
): Promise<{ client: MCPClient; tools: Record<string, Tool>; descriptors: MCPToolDescriptor[] }> {
  const client = await connectMCPServer(connection, options);
  const definitions = await client.listTools();
  const tools = client.toolsFromDefinitions(definitions) as Record<string, Tool>;
  const descriptors: MCPToolDescriptor[] = definitions.tools.map((toolDefinition) => ({
    id: getMCPToolId(connection.id, toolDefinition.name),
    name: toolDefinition.name,
    title: toolDefinition.title || toolDefinition.annotations?.title,
    description: toolDefinition.description,
  }));

  logMCP('success', `MCP discovered: ${connection.name}`, {
    url: connection.url,
    transport: toTransportType(connection.transport),
    tools: descriptors.map((tool) => tool.name),
  });

  return { client, tools, descriptors };
}

export async function loadEnabledMCPTools(
  enabledToolIds: string[],
  connections: MCPConnection[],
  options?: LoadEnabledMCPToolsOptions,
): Promise<Record<string, Tool>> {
  const selectedToolsByConnection = new Map<string, Set<string>>();

  for (const toolId of enabledToolIds) {
    const parsed = parseMCPToolId(toolId);
    if (!parsed) continue;

    const selectedTools = selectedToolsByConnection.get(parsed.connectionId) || new Set<string>();
    selectedTools.add(parsed.toolName);
    selectedToolsByConnection.set(parsed.connectionId, selectedTools);
  }

  if (selectedToolsByConnection.size === 0) {
    return {};
  }

  const resolvedTools: Record<string, Tool> = {};
  const usedNames = new Set(options?.reservedToolNames || []);

  for (const [connectionId, selectedToolNames] of selectedToolsByConnection.entries()) {
    const connection = connections.find((item) => item.id === connectionId);
    if (!connection) {
      logMCP('warning', `MCP connection missing for enabled tools`, { connectionId, selectedToolNames: [...selectedToolNames] });
      continue;
    }

    options?.onConnectionStatusChange?.(connection.id, 'connecting', null);

    try {
      const { tools } = await withAbortAndTimeout(
        discoverMCPConnection(connection, options),
        options?.abortSignal,
        options?.timeoutMs,
        `MCP discovery timed out after ${options?.timeoutMs}ms`,
      );

      for (const toolName of selectedToolNames) {
        const tool = tools[toolName];
        if (!tool) {
          logMCP('warning', `MCP tool not found: ${toolName}`, { connectionId: connection.id, connectionName: connection.name });
          continue;
        }

        const uniqueToolName = makeUniqueToolName(toolName, connection.name, usedNames);
        usedNames.add(uniqueToolName);
        resolvedTools[uniqueToolName] = wrapMCPTool(tool, options?.timeoutMs);
      }

      options?.onConnectionStatusChange?.(connection.id, 'connected', null);
    } catch (error) {
      const message = getErrorMessage(error);
      logMCP('error', `MCP connection failed: ${connection.name}`, message, {
        url: connection.url,
        transport: connection.transport,
      });
      options?.onConnectionStatusChange?.(connection.id, 'disconnected', message);
    }
  }

  return resolvedTools;
}
