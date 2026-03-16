import type { LLMConfig } from '@openbunny/shared/types';

export type NoticeTone = 'info' | 'success' | 'warning' | 'error';

// Match the main TUI settings/navigation surfaces.
export type PanelSection = 'general' | 'llm' | 'tools' | 'skills' | 'network' | 'files' | 'about';

export type PanelItemStatus = 'connected' | 'disconnected' | 'connecting';

// Item types for richer rendering
export type PanelItemType = 'toggle' | 'cycle' | 'action' | 'info' | 'header' | 'input';

export interface PanelItem {
  key: string;
  label: string;
  meta?: string;
  active?: boolean;
  status?: PanelItemStatus;
  type?: PanelItemType;
  hint?: string;
}

export interface PanelEditorState {
  itemKey: string;
  label: string;
  value: string;
  placeholder?: string;
  help?: string;
  targetPath?: string;
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
