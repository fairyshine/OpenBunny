import i18n from '../../i18n';
import { generateSkillsSystemPrompt } from './skills';
import type { AgentRuntimeContext, SkillRuntimeContext } from './runtimeContext';
import { findRuntimeAgent, resolveSkillRuntimeContext } from './runtimeContext';

export function buildBaseAssistantSystemPrompt(sessionSkillIds?: string[], runtimeContext?: Partial<SkillRuntimeContext>): string {
  const promptParts = [i18n.t('systemPrompt.assistant')];
  const resolvedRuntimeContext = resolveSkillRuntimeContext(runtimeContext);
  const skillsPrompt = generateSkillsSystemPrompt(sessionSkillIds, resolvedRuntimeContext);
  if (skillsPrompt) {
    promptParts.push(skillsPrompt);
  }
  return promptParts.join('');
}

export function buildAgentAssistantSystemPrompt(agentId: string, sessionSkillIds?: string[], runtimeContext?: Partial<AgentRuntimeContext>): string {
  const agent = findRuntimeAgent(agentId, runtimeContext);
  const customPrompt = agent?.systemPrompt?.trim();
  const promptParts = [buildBaseAssistantSystemPrompt(sessionSkillIds, runtimeContext)];

  if (customPrompt) {
    promptParts.push(`\n\n## Agent Persona\n${customPrompt}`);
  }

  return promptParts.join('');
}
