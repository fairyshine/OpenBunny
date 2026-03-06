import { Monitor, MessageSquare, Zap } from 'lucide-react';
import { Brain, Wrench, Lightbulb } from 'lucide-react';
import { Terminal } from '../icons';
import type { DashboardCardDef, DashboardCardId } from './types';
import WelcomeCard from './cards/WelcomeCard';
import SystemInfoCard from './cards/SystemInfoCard';
import SessionStatsCard from './cards/SessionStatsCard';
import LLMConfigCard from './cards/LLMConfigCard';
import ToolStatusCard from './cards/ToolStatusCard';
import MCPStatusCard from './cards/MCPStatusCard';
import RecentLogsCard from './cards/RecentLogsCard';
import QuickStartCard from './cards/QuickStartCard';

export const cardRegistry: Record<DashboardCardId, DashboardCardDef> = {
  welcome: {
    id: 'welcome',
    titleKey: 'dashboard.welcome',
    icon: <span className="text-lg">🐰</span>,
    colSpan: 4,
    component: WelcomeCard,
  },
  'system-info': {
    id: 'system-info',
    titleKey: 'dashboard.systemInfo',
    icon: <Monitor className="w-4 h-4" />,
    colSpan: 4,
    component: SystemInfoCard,
    isAvailable: () =>
      typeof window !== 'undefined' && !!(window as any).electronAPI,
  },
  'session-stats': {
    id: 'session-stats',
    titleKey: 'dashboard.sessionStats',
    icon: <MessageSquare className="w-4 h-4" />,
    colSpan: 1,
    component: SessionStatsCard,
  },
  'llm-config': {
    id: 'llm-config',
    titleKey: 'dashboard.llmConfig',
    icon: <Brain className="w-4 h-4" />,
    colSpan: 1,
    component: LLMConfigCard,
  },
  'tool-status': {
    id: 'tool-status',
    titleKey: 'dashboard.toolStatus',
    icon: <Wrench className="w-4 h-4" />,
    colSpan: 1,
    component: ToolStatusCard,
  },
  'mcp-status': {
    id: 'mcp-status',
    titleKey: 'dashboard.mcpStatus',
    icon: <Zap className="w-4 h-4" />,
    colSpan: 1,
    component: MCPStatusCard,
  },
  'recent-logs': {
    id: 'recent-logs',
    titleKey: 'dashboard.recentLogs',
    icon: <Terminal className="w-4 h-4" />,
    colSpan: 2,
    component: RecentLogsCard,
  },
  'quick-start': {
    id: 'quick-start',
    titleKey: 'status.quickStart',
    icon: <Lightbulb className="w-4 h-4" />,
    colSpan: 2,
    component: QuickStartCard,
  },
};

export const allCardIds = Object.keys(cardRegistry) as DashboardCardId[];
