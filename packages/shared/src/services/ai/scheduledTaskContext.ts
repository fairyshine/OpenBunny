export interface ScheduledTaskContext {
  sourceSessionId?: string;
  currentAgentId?: string;
  projectId?: string;
  enabledToolIds?: string[];
  sessionSkillIds?: string[];
}

export function snapshotScheduledTaskContext(
  context?: ScheduledTaskContext | null,
): ScheduledTaskContext | undefined {
  if (!context) return undefined;

  return {
    sourceSessionId: context.sourceSessionId,
    currentAgentId: context.currentAgentId,
    projectId: context.projectId,
    enabledToolIds: context.enabledToolIds ? [...context.enabledToolIds] : undefined,
    sessionSkillIds: context.sessionSkillIds ? [...context.sessionSkillIds] : undefined,
  };
}
