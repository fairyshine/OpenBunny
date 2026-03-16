/**
 * Skills Store — manages built-in + user skills loaded from the virtual filesystem.
 * User skills are stored as folders under /root/.skills/<skill-name>/SKILL.md
 *
 * Follows agentskills.io progressive disclosure:
 * - enabledSkillIds: which skills appear in the catalog (Tier 1)
 * - activatedSkills: which skills have been loaded into context this session (Tier 2)
 */

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  loadAllSkills,
  saveSkill,
  deleteSkill,
  readSkillMd,
  type LoadedSkill,
} from '../services/skills';
import { generateSkillTemplate } from '../services/skills';

// Built-in skills defined inline (always available)
const BUILTIN_SKILLS: LoadedSkill[] = [];

interface SkillState {
  skills: LoadedSkill[];
  enabledSkillIds: string[];
  /** Skills activated (loaded into context) in the current session */
  activatedSkills: Set<string>;
  loading: boolean;
  error: string | null;

  /** Load built-in + user skills from filesystem */
  loadSkills: () => Promise<void>;

  /** Toggle a skill on/off in the catalog */
  toggleSkill: (skillId: string) => void;

  /** Mark a skill as activated in the current session (dedup guard) */
  markActivated: (skillName: string) => void;

  /** Check if a skill has already been activated this session */
  isActivated: (skillName: string) => boolean;

  /** Reset activation tracking (call on new session) */
  resetActivations: () => void;

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
  persist(
    (set, get) => ({
      skills: [],
      enabledSkillIds: BUILTIN_SKILLS.map((skill) => skill.id),
      activatedSkills: new Set<string>(),
      loading: false,
      error: null,

      loadSkills: async () => {
        set({ loading: true, error: null });
        try {
          const userSkills = await loadAllSkills();
          const builtinIds = new Set(BUILTIN_SKILLS.map(s => s.id));
          const filteredUser = userSkills.filter(s => !builtinIds.has(s.id));
          const allSkills = [...BUILTIN_SKILLS, ...filteredUser];
          const { enabledSkillIds } = get();
          const knownIds = new Set(allSkills.map((skill) => skill.id));
          const cleaned = enabledSkillIds.filter((id) => knownIds.has(id));
          set({ skills: allSkills, enabledSkillIds: cleaned, loading: false });
        } catch (error) {
          console.error('[SkillStore] Failed to load skills:', error);
          set({ skills: [...BUILTIN_SKILLS], loading: false, error: String(error) });
        }
      },

      toggleSkill: (skillId: string) => {
        const { enabledSkillIds } = get();
        const next = enabledSkillIds.includes(skillId)
          ? enabledSkillIds.filter(id => id !== skillId)
          : [...enabledSkillIds, skillId];
        set({ enabledSkillIds: next });
      },

      markActivated: (skillName: string) => {
        const { activatedSkills } = get();
        const next = new Set(activatedSkills);
        next.add(skillName);
        set({ activatedSkills: next });
      },

      isActivated: (skillName: string) => {
        return get().activatedSkills.has(skillName);
      },

      resetActivations: () => {
        set({ activatedSkills: new Set<string>() });
      },

      createSkill: async (name: string, description: string) => {
        const content = generateSkillTemplate(name, description);
        const skill = await saveSkill(name, content);
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
          return `---\nname: "${skill.name}"\ndescription: ${skill.description}\nmetadata:\n  author: system\n  version: "1.0"\n---\n\n${skill.body}`;
        }
        return readSkillMd(name);
      },
    }),
    {
      name: 'openbunny-skills',
      storage: createJSONStorage(() =>
        typeof localStorage !== 'undefined'
          ? localStorage
          : { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      ),
      partialize: (state) => ({
        enabledSkillIds: state.enabledSkillIds,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SkillState>),
        activatedSkills: new Set<string>(),
      }),
    },
  )
);
