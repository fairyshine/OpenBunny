import { Monitor, MessageSquare, Zap } from 'lucide-react';
import { Brain, Wrench, Lightbulb } from 'lucide-react';
import { Terminal } from '../icons';
import type { DashboardCardDef, DashboardCardId } from './types';
import WelcomeCard from './cards/WelcomeCard';
import SystemInfoCard from './cards/SystemInfoCard';
import BunnyMascotCard from './cards/BunnyMascotCard';
import SessionStatsCard from './cards/SessionStatsCard';
import LLMConfigCard from './cards/LLMConfigCard';
import ToolStatusCard from './cards/ToolStatusCard';
import MCPStatusCard from './cards/MCPStatusCard';
import RecentLogsCard from './cards/RecentLogsCard';
import QuickStartCard from './cards/QuickStartCard';
import { openSettingsModal } from '../settings/settingsModalEvents';
import { openConsolePanel } from '../layout/consolePanelEvents';

export const cardRegistry: Record<DashboardCardId, DashboardCardDef> = {
  welcome: {
    id: 'welcome',
    titleKey: 'dashboard.welcome',
    icon: <span className="text-lg">🐰</span>,
    colSpan: 4,
    rowSpan: 2,
    component: WelcomeCard,
  },
  'bunny-mascot': {
    id: 'bunny-mascot',
    titleKey: 'dashboard.bunnyMascot',
    icon: <span className="text-sm">🐰</span>,
    colSpan: 2,
    rowSpan: 2,
    component: BunnyMascotCard,
  },
  'system-info': {
    id: 'system-info',
    titleKey: 'dashboard.systemInfo',
    icon: <Monitor className="w-4 h-4" />,
    colSpan: 4,
    rowSpan: 1,
    component: SystemInfoCard,
    isAvailable: () =>
      typeof window !== 'undefined' && !!(window as any).electronAPI,
  },
  'llm-config': {
    id: 'llm-config',
    titleKey: 'dashboard.llmConfig',
    icon: <Brain className="w-4 h-4" />,
    colSpan: 1,
    rowSpan: 1,
    component: LLMConfigCard,
    onClick: () => openSettingsModal('llm'),
  },
  'session-stats': {
    id: 'session-stats',
    titleKey: 'dashboard.sessionStats',
    icon: <MessageSquare className="w-4 h-4" />,
    colSpan: 1,
    rowSpan: 1,
    component: SessionStatsCard,
  },
  'tool-status': {
    id: 'tool-status',
    titleKey: 'dashboard.toolStatus',
    icon: <Wrench className="w-4 h-4" />,
    colSpan: 1,
    rowSpan: 1,
    component: ToolStatusCard,
    onClick: () => openSettingsModal('tools'),
  },
  'mcp-status': {
    id: 'mcp-status',
    titleKey: 'dashboard.mcpStatus',
    icon: <Zap className="w-4 h-4" />,
    colSpan: 1,
    rowSpan: 1,
    component: MCPStatusCard,
  },
  'recent-logs': {
    id: 'recent-logs',
    titleKey: 'dashboard.recentLogs',
    icon: <Terminal className="w-4 h-4" />,
    colSpan: 2,
    rowSpan: 1,
    component: RecentLogsCard,
    onClick: () => openConsolePanel(),
  },
  'quick-start': {
    id: 'quick-start',
    titleKey: 'status.quickStart',
    icon: <Lightbulb className="w-4 h-4" />,
    colSpan: 2,
    rowSpan: 1,
    component: QuickStartCard,
  },
};

export const allCardIds = Object.keys(cardRegistry) as DashboardCardId[];
