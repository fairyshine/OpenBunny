import type { ReactNode } from 'react';

export type DashboardCardId =
  | 'welcome'
  | 'system-info'
  | 'session-stats'
  | 'llm-config'
  | 'tool-status'
  | 'mcp-status'
  | 'recent-logs'
  | 'quick-start';

export interface DashboardCardDef {
  id: DashboardCardId;
  titleKey: string;
  icon: ReactNode;
  colSpan: 1 | 2 | 4;
  component: React.ComponentType;
  /** Hide card when condition returns false (e.g. non-Electron for system-info) */
  isAvailable?: () => boolean;
}
