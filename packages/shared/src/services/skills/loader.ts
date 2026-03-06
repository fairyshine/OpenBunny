/**
 * Skill Loader — load skills from the virtual filesystem
 * Skills are stored as folders under /root/.skills/<skill-name>/SKILL.md
 */

import { fileSystem } from '../filesystem';
import { parseSkillMd, type ParsedSkill } from './parser';

export const SKILLS_DIR = '/root/.skills';

export interface LoadedSkill {
  id: string;
  name: string;
  description: string;
  body: string;
  path: string;
  source: 'builtin' | 'user';
  license?: string;
  compatibility?: string;
  allowedTools?: string;
  metadata?: Record<string, string>;
}

/**
 * Ensure the skills directory exists
 */
export async function ensureSkillsDir(): Promise<void> {
  await fileSystem.initialize();
  if (!(await fileSystem.exists(SKILLS_DIR))) {
    await fileSystem.mkdir(SKILLS_DIR);
  }
}

/**
 * Load a single skill from a folder path
 */
export async function loadSkillFromPath(folderPath: string): Promise<LoadedSkill | null> {
  const skillMdPath = `${folderPath}/SKILL.md`;

  const content = await fileSystem.readFileText(skillMdPath);
  if (!content) return null;

  try {
    const parsed: ParsedSkill = parseSkillMd(content);
    return {
      id: parsed.frontmatter.name,
      name: parsed.frontmatter.name,
      description: parsed.frontmatter.description,
      body: parsed.body,
      path: folderPath,
      source: 'user',
      license: parsed.frontmatter.license,
      compatibility: parsed.frontmatter.compatibility,
      allowedTools: parsed.frontmatter.allowedTools,
      metadata: parsed.frontmatter.metadata,
    };
  } catch (error) {
    console.error(`[Skills] Failed to parse ${skillMdPath}:`, error);
    return null;
  }
}

/**
 * Scan the skills directory and load all skills
 */
export async function loadAllSkills(): Promise<LoadedSkill[]> {
  await ensureSkillsDir();

  const entries = await fileSystem.readdir(SKILLS_DIR);
  const folders = entries.filter(e => e.type === 'directory');
  const skills: LoadedSkill[] = [];

  for (const folder of folders) {
    const folderPath = `${SKILLS_DIR}/${folder.name}`;
    const skill = await loadSkillFromPath(folderPath);
    if (skill) {
      skills.push(skill);
    }
  }

  return skills;
}

/**
 * Save a skill to the filesystem (create or update)
 */
export async function saveSkill(skillName: string, skillMdContent: string): Promise<LoadedSkill> {
  await ensureSkillsDir();

  const folderPath = `${SKILLS_DIR}/${skillName}`;

  if (!(await fileSystem.exists(folderPath))) {
    await fileSystem.mkdir(folderPath);
  }

  await fileSystem.writeFile(`${folderPath}/SKILL.md`, skillMdContent);

  const skill = await loadSkillFromPath(folderPath);
  if (!skill) {
    throw new Error(`Failed to parse saved SKILL.md for "${skillName}"`);
  }

  return skill;
}

/**
 * Delete a skill folder from the filesystem
 */
export async function deleteSkill(skillName: string): Promise<void> {
  const folderPath = `${SKILLS_DIR}/${skillName}`;
  if (await fileSystem.exists(folderPath)) {
    await fileSystem.rm(folderPath, true);
  }
}

/**
 * Read the raw SKILL.md content for editing
 */
export async function readSkillMd(skillName: string): Promise<string | null> {
  const skillMdPath = `${SKILLS_DIR}/${skillName}/SKILL.md`;
  return await fileSystem.readFileText(skillMdPath);
}
