import type { LLMConfig } from '@openbunny/shared/types';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

// Match web settings sections: profile, general, llm, tools, skills, network(mcp+agents), about
export type PanelSection = 'general' | 'llm' | 'tools' | 'skills' | 'network' | 'about';

export type PanelItemStatus = 'connected' | 'disconnected' | 'connecting';

// Item types for richer rendering
export type PanelItemType = 'toggle' | 'cycle' | 'action' | 'info' | 'header';

export interface PanelItem {
  key: string;
  label: string;
  meta?: string;
  active?: boolean;
  status?: PanelItemStatus;
  type?: PanelItemType;
  hint?: string;
}

export interface Notice {
  id: string;
  content: string;
  tone: NoticeTone;
  createdAt: number;
}

export interface AppProps {
  config: LLMConfig;
  systemPrompt?: string;
  workspace?: string;
  configDir?: string;
  resumeIdPrefix?: string;
  startupNotice?: string;
}
