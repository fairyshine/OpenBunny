/**
 * Skills Service — main entry point
 * Combines built-in skills with user-created skills from the virtual filesystem.
 * Each skill becomes a callable tool following the opencode pattern (skills_{{name}}).
 */

export { parseSkillMd, generateSkillTemplate } from './parser';
export type { ParsedSkill, SkillMetadata } from './parser';
export {
  loadAllSkills,
  loadSkillFromPath,
  saveSkill,
  deleteSkill,
  readSkillMd,
  ensureSkillsDir,
  SKILLS_DIR,
} from './loader';
export type { LoadedSkill } from './loader';
