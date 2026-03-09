import type { ReactNode } from 'react';

export type DashboardCardId =
  | 'welcome'
  | 'system-info'
  | 'bunny-mascot'
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
  /** Row height: 1 = standard, 2 = double height. Defaults to 1. */
  rowSpan?: 1 | 2;
  component: React.ComponentType;
  /** Hide card when condition returns false (e.g. non-Electron for system-info) */
  isAvailable?: () => boolean;
  onClick?: () => void;
}
