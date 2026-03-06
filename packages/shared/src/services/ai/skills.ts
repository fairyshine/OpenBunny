/**
 * Skills — register loaded skills as callable tools (opencode pattern)
 * Each skill becomes a tool named `skills_{{name}}` that injects the SKILL.md body
 * as a synthetic instruction when invoked.
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { useSkillStore } from '../../stores/skills';
import type { LoadedSkill } from '../skills';

/**
 * Create a tool for a single skill (opencode pattern: lazy loading via tool invocation)
 */
function createSkillTool(skill: LoadedSkill): Tool {
  return tool({
    description: `[Skill] ${skill.description}`,
    inputSchema: z.object({
      input: z.string().describe('User request or context for this skill'),
    }),
    execute: async ({ input }) => {
      // Return the skill body as instructions for the model to follow
      return `## Skill: ${skill.name}\n\n${skill.body}\n\n---\n\n**User request:** ${input}`;
    },
  });
}

/**
 * Get all skills as tools (keyed as skills_{{name}})
 */
export function getSkillTools(): Record<string, Tool> {
  const skills = useSkillStore.getState().skills;
  const tools: Record<string, Tool> = {};

  for (const skill of skills) {
    const toolName = `skills_${skill.name.replace(/-/g, '_')}`;
    tools[toolName] = createSkillTool(skill);
  }

  return tools;
}

/**
 * Generate system prompt section describing available skills
 */
export function generateSkillsSystemPrompt(): string {
  const skills = useSkillStore.getState().skills;

  if (skills.length === 0) {
    return '';
  }

  const skillDescriptions = skills.map(skill => {
    const toolName = `skills_${skill.name.replace(/-/g, '_')}`;
    return `- **${skill.name}** (tool: \`${toolName}\`): ${skill.description}`;
  }).join('\n');

  return `

## Available Skills

You have access to the following skills as tools. Invoke a skill tool when you need its specialized workflow:

${skillDescriptions}

To use a skill, call its corresponding tool (e.g., \`skills_data_analysis\`) with a description of what you need.
`;
}

// Re-export for backward compatibility
export type { LoadedSkill as SkillInfo };
export function getBuiltinSkills(): LoadedSkill[] {
  return useSkillStore.getState().skills;
}
