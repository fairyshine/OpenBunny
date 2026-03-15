import type { LLMConfig } from '../../types';
import { logTool } from '../console/logger';
import { cronManager, type CronJob } from '../cron';
import { heartbeatManager, type HeartbeatItem } from '../heartbeat';
import { getErrorMessage } from '../../utils/errors';
import { runMindConversation } from './mind';
import { getDefaultAIRuntimeDefaultsResolver } from './runtimeDefaults';
import type { AgentRuntimeContext } from './runtimeContext';
import type { ScheduledTaskContext } from './scheduledTaskContext';

const DISABLED_BACKGROUND_TOOL_IDS = new Set(['cron', 'heartbeat']);

interface ScheduledMindExecutionContext {
  sourceSessionId: string;
  llmConfig: LLMConfig;
  enabledToolIds: string[];
  sessionSkillIds: string[];
  projectId?: string;
  currentAgentId: string;
  runtimeContext: Partial<AgentRuntimeContext>;
}

let scheduledMindBridgeInitialized = false;
const activeCronRuns = new Set<string>();
const activeHeartbeatRuns = new Set<string>();

export function initializeScheduledMindBridge(): void {
  if (scheduledMindBridgeInitialized) return;
  scheduledMindBridgeInitialized = true;

  cronManager.setTriggerHandler((job) => {
    void runCronMindJob(job);
  });
  heartbeatManager.setTickHandler((items) => {
    void runHeartbeatMindTick(items);
  });

  void cronManager.initialize();
  heartbeatManager.initialize();
}

export function resetScheduledMindBridgeForTests(): void {
  scheduledMindBridgeInitialized = false;
  activeCronRuns.clear();
  activeHeartbeatRuns.clear();
  cronManager.setTriggerHandler(null);
  heartbeatManager.setTickHandler(null);
}

export function buildCronMindInput(job: CronJob): string {
  return job.description;
}

export function buildHeartbeatMindInput(item: HeartbeatItem): string {
  return item.text;
}

export function resolveScheduledMindExecutionContext(
  taskContext?: ScheduledTaskContext,
): ScheduledMindExecutionContext | null {
  try {
    const defaults = getDefaultAIRuntimeDefaultsResolver().getDefaults();
    const requestedAgentId = taskContext?.currentAgentId || defaults.currentAgentId;
    const agent = defaults.agents.find((item) => item.id === requestedAgentId) || null;
    const usesDefaultAgent = !agent || agent.isDefault;
    const currentAgentId = agent?.id || defaults.currentAgentId;
    const llmConfig = usesDefaultAgent ? defaults.defaultLLMConfig : agent.llmConfig;

    if (!llmConfig?.apiKey || !llmConfig.model?.trim()) {
      return null;
    }

    const enabledToolIds = sanitizeBackgroundToolIds(
      taskContext?.enabledToolIds
      || (usesDefaultAgent ? defaults.defaultEnabledToolIds : agent.enabledTools),
    );
    const sessionSkillIds = dedupeStrings(
      taskContext?.sessionSkillIds
      || (usesDefaultAgent ? defaults.enabledSkillIds : agent.enabledSkills),
    );

    return {
      sourceSessionId: taskContext?.sourceSessionId || `scheduled:${currentAgentId}`,
      llmConfig,
      enabledToolIds,
      sessionSkillIds,
      projectId: taskContext?.projectId,
      currentAgentId,
      runtimeContext: {
        currentAgentId,
        agents: defaults.agents,
        defaultLLMConfig: defaults.defaultLLMConfig,
        defaultEnabledToolIds: defaults.defaultEnabledToolIds,
        defaultSkillIds: defaults.enabledSkillIds,
        proxyUrl: defaults.proxyUrl,
        toolExecutionTimeout: defaults.toolExecutionTimeout,
        execLoginShell: defaults.execLoginShell,
        searchProvider: defaults.searchProvider,
        exaApiKey: defaults.exaApiKey,
        braveApiKey: defaults.braveApiKey,
        skills: defaults.skills,
        enabledSkillIds: defaults.enabledSkillIds,
        markSkillActivated: defaults.markSkillActivated,
        mcpConnections: defaults.mcpConnections,
        onConnectionStatusChange: defaults.onConnectionStatusChange,
      },
    };
  } catch (error) {
    logTool('warning', 'Scheduled mind trigger skipped because runtime defaults are unavailable', getErrorMessage(error));
    return null;
  }
}

async function runCronMindJob(job: CronJob): Promise<void> {
  if (activeCronRuns.has(job.id)) {
    logTool('warning', 'Cron trigger skipped because the previous run is still active', {
      jobId: job.id,
      description: job.description,
    });
    return;
  }

  activeCronRuns.add(job.id);

  try {
    const context = resolveScheduledMindExecutionContext(job.taskContext);
    if (!context) {
      logTool('warning', 'Cron trigger skipped because no runnable mind context is available', {
        jobId: job.id,
        description: job.description,
      });
      return;
    }

    logTool('info', 'Running cron task through mind', {
      jobId: job.id,
      expression: job.expression,
      agentId: context.currentAgentId,
    });

    const result = await runMindConversation(buildCronMindInput(job), context);
    logTool('success', 'Cron task completed through mind', {
      jobId: job.id,
      sessionId: result.sessionId,
      summary: result.summary || result.finalAssistantReply,
    });
  } catch (error) {
    logTool('error', 'Cron task failed through mind', getErrorMessage(error), {
      jobId: job.id,
      description: job.description,
    });
  } finally {
    activeCronRuns.delete(job.id);
  }
}

async function runHeartbeatMindTick(items: HeartbeatItem[]): Promise<void> {
  for (const item of items) {
    if (activeHeartbeatRuns.has(item.id)) {
      logTool('warning', 'Heartbeat trigger skipped because the previous run is still active', {
        itemId: item.id,
        text: item.text,
      });
      continue;
    }

    activeHeartbeatRuns.add(item.id);

    try {
      const context = resolveScheduledMindExecutionContext(item.taskContext);
      if (!context) {
        logTool('warning', 'Heartbeat trigger skipped because no runnable mind context is available', {
          itemId: item.id,
          text: item.text,
        });
        continue;
      }

      logTool('info', 'Running heartbeat item through mind', {
        itemId: item.id,
        agentId: context.currentAgentId,
      });

      const result = await runMindConversation(buildHeartbeatMindInput(item), context);
      logTool('success', 'Heartbeat item completed through mind', {
        itemId: item.id,
        sessionId: result.sessionId,
        summary: result.summary || result.finalAssistantReply,
      });
    } catch (error) {
      logTool('error', 'Heartbeat item failed through mind', getErrorMessage(error), {
        itemId: item.id,
        text: item.text,
      });
    } finally {
      activeHeartbeatRuns.delete(item.id);
    }
  }
}

function sanitizeBackgroundToolIds(toolIds: string[]): string[] {
  return dedupeStrings(toolIds.filter((toolId) => !DISABLED_BACKGROUND_TOOL_IDS.has(toolId)));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
