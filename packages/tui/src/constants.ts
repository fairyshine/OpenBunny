import type { PanelSection } from './types.js';

export const MAX_VISIBLE_MESSAGES = 20;
export const MAX_VISIBLE_NOTICES = 4;
export const MAX_VISIBLE_SESSIONS = 6;
export const MAX_VISIBLE_SECTION_ITEMS = 12;

export const PANEL_SECTIONS: readonly PanelSection[] = [
  'general', 'llm', 'tools', 'skills', 'network', 'files', 'about',
] as const;

export const SESSION_TYPE_FILTERS = ['all', 'user', 'agent', 'mind'] as const;

export const SEARCH_PROVIDER_ORDER = ['exa_free', 'exa', 'brave'] as const;
export const TOOL_TIMEOUT_PRESETS = [60000, 300000, 900000] as const;
export const TEMPERATURE_PRESETS = [0, 0.2, 0.5, 0.7, 1, 1.2] as const;
export const MAX_TOKEN_PRESETS = [1024, 2048, 4096, 8192, 16384, 32768] as const;

export const TOOL_DESCRIPTIONS: Record<string, string> = {
  python: 'Execute Python code in a sandboxed environment',
  web_search: 'Search the web for information',
  file_manager: 'Read, write, and manage files',
  memory: 'Persistent memory across sessions',
  mind: 'Internal reasoning and planning',
  chat: 'Multi-turn conversation management',
  exec: 'Execute shell commands in workspace',
  cron: 'Schedule recurring tasks',
  heartbeat: 'Keep-alive and health checks',
};
