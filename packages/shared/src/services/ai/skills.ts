/**
 * Skills — Progressive Disclosure following agentskills.io specification
 *
 * Tier 1 (Catalog):    Skill name + description injected into system prompt (~50-100 tokens each)
 * Tier 2 (Activation): `activate_skill` tool loads full SKILL.md body + resource listing on demand
 * Tier 3 (Resources):  `activate_skill` with resource_path reads a specific bundled file
 *
 * This replaces the previous "skills-as-tools" pattern where each skill was registered
 * as a separate tool (skills_{{slug}}). Now skills and tools are clearly separated:
 * - Tools = atomic operations (python, file_manager, web_search, etc.)
 * - Skills = specialized instruction sets loaded on demand
 */

import { tool, type Tool } from 'ai';
import { z } from 'zod';
import { useSkillStore } from '../../stores/skills';
import type { LoadedSkill } from '../skills';
import { listSkillResources, readSkillResource } from '../skills';

/**
 * Build the skill catalog for system prompt injection (Tier 1).
 * Lists enabled skills with name + description so the model knows what's available.
 * Returns empty string if no skills are enabled.
 * @param sessionSkillIds - Optional session-level skill overrides. If provided, uses these instead of global enabledSkillIds.
 */
export function generateSkillsSystemPrompt(sessionSkillIds?: string[]): string {
  const { skills, enabledSkillIds } = useSkillStore.getState();
  const activeIds = sessionSkillIds ?? enabledSkillIds;
  const enabled = skills.filter(s => activeIds.includes(s.id));

  if (enabled.length === 0) {
    return '';
  }

  const catalog = enabled.map(skill => {
    const locationLine = skill.path.startsWith('builtin://')
      ? ''
      : `\n    <location>${skill.path}/SKILL.md</location>`;
    return `  <skill>
    <name>${skill.name}</name>
    <description>${skill.description}</description>${locationLine}
  </skill>`;
  }).join('\n');

  return `

## Available Skills

<available_skills>
${catalog}
</available_skills>

The skills listed above provide specialized instructions for specific tasks.
When a task matches a skill's description, call the \`activate_skill\` tool with the skill's name to load its full instructions before proceeding.
To read a skill's bundled resource file, call \`activate_skill\` again with both the skill name and the resource_path from the resource listing.
Do not guess or fabricate skill instructions — always activate first.
`;
}

/**
 * Create the single `activate_skill` tool (Tier 2 + Tier 3).
 *
 * Two modes:
 * - Activate:  { name: "skill-name" }                          → returns SKILL.md body + resource listing
 * - Resource:  { name: "skill-name", resource_path: "scripts/extract.py" } → returns file content
 *
 * Constrained to enabled skill names via enum to prevent hallucination.
 * Returns empty object if no skills are enabled (don't register a useless tool).
 * @param sessionSkillIds - Optional session-level skill overrides. If provided, uses these instead of global enabledSkillIds.
 */
export function getActivateSkillTool(sessionSkillIds?: string[]): Record<string, Tool> {
  const { skills, enabledSkillIds, markActivated } = useSkillStore.getState();
  const activeIds = sessionSkillIds ?? enabledSkillIds;
  const enabled = skills.filter(s => activeIds.includes(s.id));

  if (enabled.length === 0) {
    return {};
  }

  const nameToSkill = new Map<string, LoadedSkill>();
  for (const skill of enabled) {
    nameToSkill.set(skill.name, skill);
  }

  const skillNames = enabled.map(s => s.name);

  const activateTool = tool({
    description: [
      'Activate a skill or read its bundled resource files.',
      'Call with just `name` to load the skill\'s full instructions and see its available resources.',
      'Call with `name` + `resource_path` to read a specific resource file listed in <skill_resources>.',
    ].join(' '),
    inputSchema: z.object({
      name: z.enum(skillNames as [string, ...string[]])
        .describe('Name of the skill to activate or read resources from'),
      resource_path: z.string().optional()
        .describe('Relative path of a bundled resource file to read (from <skill_resources> listing). Omit to activate the skill.'),
    }),
    execute: async ({ name, resource_path }) => {
      const skill = nameToSkill.get(name);
      if (!skill) {
        return `Error: Skill "${name}" not found. Available skills: ${skillNames.join(', ')}`;
      }

      const isBuiltin = skill.path.startsWith('builtin://');

      // --- Tier 3: Read a specific resource file ---
      if (resource_path) {
        if (isBuiltin) {
          return `Error: Built-in skill "${name}" has no bundled resource files.`;
        }

        const result = await readSkillResource(skill.path, resource_path);
        if (!result) {
          return `Error: Resource "${resource_path}" not found in skill "${name}". Call activate_skill with just the name to see available resources.`;
        }

        // Image resource: return as multi-part content with file-data (AI SDK v6 ToolResultOutput)
        if (result.type === 'image') {
          return {
            type: 'content' as const,
            value: [
              { type: 'text' as const, text: `<skill_resource name="${name}" path="${resource_path}" type="image" />` },
              { type: 'file-data' as const, data: result.content, mediaType: result.mimeType! },
            ],
          } as any;
        }

        return `<skill_resource name="${name}" path="${resource_path}">
${result.content}
</skill_resource>`;
      }

      // --- Tier 2: Activate skill — load instructions + list resources ---
      markActivated(name);

      let resourcesXml = '';
      if (!isBuiltin) {
        const { resources, truncated } = await listSkillResources(skill.path);
        if (resources.length > 0) {
          const entries = resources.map(r => {
            if (r.type === 'directory') {
              return `    <directory path="${r.relativePath}" />`;
            }
            return `    <file path="${r.relativePath}" size="${r.size}" />`;
          }).join('\n');
          const truncatedNote = truncated
            ? '\n    <!-- listing truncated, more files may exist -->'
            : '';
          resourcesXml = `\n<skill_resources>\n${entries}${truncatedNote}
</skill_resources>`;
        }
      }

      const skillDir = isBuiltin
        ? ''
        : `\nSkill directory: ${skill.path}\nTo read a resource, call activate_skill with name="${name}" and resource_path set to the file path from the listing above.\n`;

      return `<skill_content name="${skill.name}">
${skill.body}
${skillDir}${resourcesXml}
</skill_content>`;
    },
  });

  return { activate_skill: activateTool };
}

// --- Backward compatibility exports ---

export type { LoadedSkill as SkillInfo };

export function getBuiltinSkills(): LoadedSkill[] {
  return useSkillStore.getState().skills;
}

/**
 * @deprecated Use getActivateSkillTool() instead.
 */
export function getSkillTools(): Record<string, Tool> {
  return getActivateSkillTool();
}
