/**
 * Skills Store — manages built-in + user skills loaded from the virtual filesystem.
 * User skills are stored as folders under /root/.skills/<skill-name>/SKILL.md
 */

import { create } from 'zustand';
import {
  loadAllSkills,
  saveSkill,
  deleteSkill,
  readSkillMd,
  type LoadedSkill,
} from '../services/skills';
import { generateSkillTemplate } from '../services/skills';

// Built-in skills defined inline (always available)
const BUILTIN_SKILLS: LoadedSkill[] = [
  {
    id: 'data-analysis',
    name: 'data-analysis',
    description: 'Analyze data files (CSV, JSON, Excel) using Python. Performs statistical analysis, generates visualizations, and creates summary reports.',
    body: `# Data Analysis Skill

## When to use this skill
Use this skill when the user needs to:
- Analyze CSV, JSON, or Excel files
- Generate statistical summaries
- Create visualizations (charts, graphs, plots)
- Find patterns or correlations in data
- Clean or transform data

## How it works
This skill uses Python with pandas, numpy, and matplotlib to analyze data files.`,
    path: 'builtin://data-analysis',
    source: 'builtin',
    metadata: { author: 'system', version: '1.0' },
  },
  {
    id: 'web-research',
    name: 'web-research',
    description: 'Search the web, extract information from multiple sources, and generate comprehensive research reports.',
    body: `# Web Research Skill

## When to use this skill
Use this skill when the user needs to:
- Search for information on the internet
- Compare information from multiple sources
- Create research reports or summaries
- Verify facts across different websites

## How it works
This skill orchestrates web search and content extraction to create comprehensive research reports.`,
    path: 'builtin://web-research',
    source: 'builtin',
    metadata: { author: 'system', version: '1.0' },
  },
];

interface SkillState {
  skills: LoadedSkill[];
  loading: boolean;
  error: string | null;

  /** Load built-in + user skills from filesystem */
  loadSkills: () => Promise<void>;

  /** Create a new user skill from template */
  createSkill: (name: string, description: string) => Promise<LoadedSkill>;

  /** Save/update a skill's SKILL.md content */
  updateSkill: (name: string, skillMdContent: string) => Promise<LoadedSkill>;

  /** Remove a user skill */
  removeSkill: (name: string) => Promise<void>;

  /** Get raw SKILL.md content for editing */
  getSkillContent: (name: string) => Promise<string | null>;
}

export const useSkillStore = create<SkillState>()(
  (set, get) => ({
    skills: [],
    loading: false,
    error: null,

    loadSkills: async () => {
      set({ loading: true, error: null });
      try {
        const userSkills = await loadAllSkills();
        // Merge: built-ins first, then user skills (user can override by name)
        const builtinIds = new Set(BUILTIN_SKILLS.map(s => s.id));
        const filteredUser = userSkills.filter(s => !builtinIds.has(s.id));
        set({ skills: [...BUILTIN_SKILLS, ...filteredUser], loading: false });
      } catch (error) {
        console.error('[SkillStore] Failed to load skills:', error);
        // Fall back to built-in skills only
        set({ skills: [...BUILTIN_SKILLS], loading: false, error: String(error) });
      }
    },

    createSkill: async (name: string, description: string) => {
      const content = generateSkillTemplate(name, description);
      const skill = await saveSkill(name, content);
      // Reload all skills
      await get().loadSkills();
      return skill;
    },

    updateSkill: async (name: string, skillMdContent: string) => {
      const skill = await saveSkill(name, skillMdContent);
      await get().loadSkills();
      return skill;
    },

    removeSkill: async (name: string) => {
      const skill = get().skills.find(s => s.name === name);
      if (skill?.source === 'builtin') {
        throw new Error('Cannot delete built-in skills');
      }
      await deleteSkill(name);
      await get().loadSkills();
    },

    getSkillContent: async (name: string) => {
      const skill = get().skills.find(s => s.name === name);
      if (!skill) return null;
      if (skill.source === 'builtin') {
        // Generate content from built-in definition
        return `---\nname: ${skill.name}\ndescription: ${skill.description}\nmetadata:\n  author: system\n  version: "1.0"\n---\n\n${skill.body}`;
      }
      return readSkillMd(name);
    },
  })
);
