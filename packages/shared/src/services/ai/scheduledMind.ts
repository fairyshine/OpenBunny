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

export function buildCronMindInput(job: CronJob, triggeredAt: number = Date.now()): string {
  return [
    'A scheduled cron task has fired.',
    `Triggered at: ${new Date(triggeredAt).toISOString()}`,
    `Job ID: ${job.id}`,
    `Cron expression: ${job.expression}`,
    `Run count: ${job.runCount}`,
    '',
    'Task to execute:',
    job.description,
    '',
    'Handle the task now. Use tools if they are necessary, and finish with a concrete result.',
  ].join('\n');
}

export function buildHeartbeatMindInput(items: HeartbeatItem[], triggeredAt: number = Date.now()): string {
  const lines = items.map((item, index) => (
    `${index + 1}. ${item.text} (created at ${new Date(item.createdAt).toISOString()}, id ${item.id})`
  ));

  return [
    'A heartbeat review has fired.',
    `Triggered at: ${new Date(triggeredAt).toISOString()}`,
    `Tracked items: ${items.length}`,
    '',
    'Review and act on the following watchlist items:',
    ...lines,
    '',
    'Process the list now. Use tools if needed, and finish with a concrete result.',
  ].join('\n');
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
  const groups = groupHeartbeatItemsByContext(items);

  for (const [groupKey, groupItems] of groups) {
    if (activeHeartbeatRuns.has(groupKey)) {
      logTool('warning', 'Heartbeat trigger skipped because the previous run is still active', {
        itemCount: groupItems.length,
        groupKey,
      });
      continue;
    }

    activeHeartbeatRuns.add(groupKey);

    try {
      const context = resolveScheduledMindExecutionContext(groupItems[0]?.taskContext);
      if (!context) {
        logTool('warning', 'Heartbeat trigger skipped because no runnable mind context is available', {
          itemCount: groupItems.length,
          groupKey,
        });
        continue;
      }

      logTool('info', 'Running heartbeat review through mind', {
        itemCount: groupItems.length,
        groupKey,
        agentId: context.currentAgentId,
      });

      const result = await runMindConversation(buildHeartbeatMindInput(groupItems), context);
      logTool('success', 'Heartbeat review completed through mind', {
        itemCount: groupItems.length,
        groupKey,
        sessionId: result.sessionId,
        summary: result.summary || result.finalAssistantReply,
      });
    } catch (error) {
      logTool('error', 'Heartbeat review failed through mind', getErrorMessage(error), {
        itemCount: groupItems.length,
        groupKey,
      });
    } finally {
      activeHeartbeatRuns.delete(groupKey);
    }
  }
}

function groupHeartbeatItemsByContext(items: HeartbeatItem[]): Map<string, HeartbeatItem[]> {
  const groups = new Map<string, HeartbeatItem[]>();

  for (const item of items) {
    const groupKey = buildTaskContextKey(item.taskContext);
    const current = groups.get(groupKey);
    if (current) {
      current.push(item);
      continue;
    }

    groups.set(groupKey, [item]);
  }

  return groups;
}

function buildTaskContextKey(taskContext?: ScheduledTaskContext): string {
  return JSON.stringify({
    sourceSessionId: taskContext?.sourceSessionId || '',
    currentAgentId: taskContext?.currentAgentId || '',
    projectId: taskContext?.projectId || '',
    enabledToolIds: dedupeStrings(taskContext?.enabledToolIds || []),
    sessionSkillIds: dedupeStrings(taskContext?.sessionSkillIds || []),
  });
}

function sanitizeBackgroundToolIds(toolIds: string[]): string[] {
  return dedupeStrings(toolIds.filter((toolId) => !DISABLED_BACKGROUND_TOOL_IDS.has(toolId)));
}

function dedupeStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}
