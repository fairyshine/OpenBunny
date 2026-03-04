/**
 * Skills Store — manages skill availability
 * Skills are now parsed from SKILL.md files and injected as system prompt.
 * This store is kept for backward compatibility but is greatly simplified.
 */

import { create } from 'zustand';
import { getBuiltinSkills, type SkillInfo } from '../services/ai/skills';

interface SkillState {
  skills: SkillInfo[];
  loadSkills: () => void;
}

export const useSkillStore = create<SkillState>()(
  (set) => ({
    skills: [],
    loadSkills: () => {
      set({ skills: getBuiltinSkills() });
    },
  })
);
