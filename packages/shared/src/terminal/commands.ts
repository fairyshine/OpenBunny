/**
 * Pure command handlers for terminal slash commands.
 * Returns structured data — callers (CLI/TUI) handle rendering.
 */

import { useSessionStore, selectActiveSessions } from '../stores/session';
import { providerRegistry } from '../services/ai/providers';
import type { LLMConfig } from '../types';
import type { ProviderMeta, ProviderCategory } from '../services/ai/providers';

// --- Types ---

export interface HelpInfo {
  config: {
    provider: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    workspace?: string;
    configDir?: string;
    sessionId?: string;
  };
  commands: { name: string; description: string }[];
}

export interface SessionListItem {
  id: string;
  shortId: string;
  name: string;
  messageCount: number;
  createdAt: string;
}

export interface ProviderListGroup {
  category: ProviderCategory;
  providers: {
    id: string;
    name: string;
    requiresApiKey: boolean;
    sampleModels: string;
  }[];
}

export interface ResumeResult {
  sessionId: string;
  name: string;
  messageCount: number;
  history: import('ai').ModelMessage[];
  displayMessages: { role: 'user' | 'assistant'; content: string }[];
}

// --- Command parsing ---

export function parseCommand(input: string): { command: string; args: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('/')) return null;

  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) {
    return { command: trimmed.slice(1), args: '' };
  }
  return {
    command: trimmed.slice(1, spaceIndex),
    args: trimmed.slice(spaceIndex + 1).trim(),
  };
}

// --- Help ---

export function getHelpInfo(
  config: LLMConfig,
  options?: { workspace?: string; configDir?: string; sessionId?: string },
): HelpInfo {
  return {
    config: {
      provider: config.provider,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      workspace: options?.workspace,
      configDir: options?.configDir,
      sessionId: options?.sessionId,
    },
    commands: [
      { name: '/help', description: 'Show this help' },
      { name: '/clear', description: 'Clear conversation history' },
      { name: '/history', description: 'Show session info' },
      { name: '/sessions [filter]', description: 'List sessions by type' },
      { name: '/resume <id>', description: 'Resume a previous session' },
      { name: '/save', description: 'Force-flush messages to disk' },
      { name: '/scope [mode]', description: 'Show or switch global/session scope' },
      { name: '/tools', description: 'List enabled tools for the active scope' },
      { name: '/tool on|off <id>', description: 'Toggle a tool in the active scope' },
      { name: '/skills', description: 'List enabled skills for the active scope' },
      { name: '/skill on|off <id>', description: 'Toggle a skill in the active scope' },
      { name: '/search <query>', description: 'Search inside the current session' },
      { name: '/export [fmt]', description: 'Export the current session' },
      { name: '/files', description: 'List workspace files' },
      { name: '/touch <path>', description: 'Create an empty file in the workspace' },
      { name: '/mkdir <path>', description: 'Create a directory in the workspace' },
      { name: '/rename <a> <b>', description: 'Rename a workspace file or directory' },
      { name: '/rm <path>', description: 'Delete a workspace file or directory' },
      { name: '/write <p> <txt>', description: 'Overwrite a workspace file' },
      { name: '/cd <path>', description: 'Change the active file panel directory' },
      { name: '/open <path>', description: 'Preview a workspace file' },
      { name: '/providers', description: 'List supported providers' },
      { name: '/quit', description: 'Exit' },
    ],
  };
}

// --- Sessions ---

export function getSessionList(): SessionListItem[] {
  const sessions = selectActiveSessions(useSessionStore.getState());
  return sessions.map((s) => ({
    id: s.id,
    shortId: s.id.slice(0, 8),
    name: s.name,
    messageCount: s.messages.length,
    createdAt: new Date(s.createdAt).toLocaleString(),
  }));
}

// --- Providers ---

export function getProviderList(): ProviderListGroup[] {
  const groups = new Map<ProviderCategory, ProviderMeta[]>();

  for (const provider of providerRegistry) {
    const group = groups.get(provider.category) || [];
    group.push(provider);
    groups.set(provider.category, group);
  }

  const result: ProviderListGroup[] = [];
  for (const [category, providers] of groups.entries()) {
    result.push({
      category,
      providers: providers.map((p) => ({
        id: p.id,
        name: p.name,
        requiresApiKey: p.requiresApiKey,
        sampleModels: p.models.slice(0, 3).join(', ') || 'custom',
      })),
    });
  }
  return result;
}

// --- History ---

export function getHistoryInfo(sessionId: string, messageCount: number): string {
  return `Session ${sessionId.slice(0, 8)} — ${messageCount} message(s) in history.`;
}

// --- Resume ---

export async function resumeSession(
  idPrefix: string,
  systemPrompt?: string,
): Promise<ResumeResult | { error: string }> {
  const store = useSessionStore.getState();
  const match = store.sessions.find((s) => s.id.startsWith(idPrefix));
  if (!match) {
    return { error: `No session found matching "${idPrefix}"` };
  }

  if (match.messages.length === 0) {
    await store.loadSessionMessages(match.id);
  }

  const loaded = useSessionStore.getState().sessions.find((s) => s.id === match.id);
  const msgs = loaded?.messages ?? [];
  const resolvedSystemPrompt = systemPrompt ?? loaded?.systemPrompt ?? match.systemPrompt;

  const history: import('ai').ModelMessage[] = resolvedSystemPrompt
    ? [{ role: 'system', content: resolvedSystemPrompt }]
    : [];
  const displayMessages: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const msg of msgs) {
    if (msg.role === 'user' || msg.role === 'assistant') {
      history.push({ role: msg.role, content: msg.content });
      displayMessages.push({ role: msg.role, content: msg.content });
    }
  }

  return {
    sessionId: match.id,
    name: match.name,
    messageCount: msgs.length,
    history,
    displayMessages,
  };
}
