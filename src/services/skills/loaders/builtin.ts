// 内置 Skills 加载器
// 从 builtin/ 目录加载 SKILL.md 文件

import { ISkillLoader, ISkill } from '../base';
import { parseSkillMd } from '../parser';
import { MarkdownSkill } from '../markdown-skill';

// 导入内置 SKILL.md 文件内容
import dataAnalysisSkillMd from '../builtin/data-analysis/SKILL.md?raw';
import webResearchSkillMd from '../builtin/web-research/SKILL.md?raw';

export class BuiltinSkillLoader implements ISkillLoader {
  readonly type = 'builtin';

  async load(_source: string): Promise<ISkill[]> {
    const skills: ISkill[] = [];

    // 加载 data-analysis skill
    try {
      const parsed = parseSkillMd(dataAnalysisSkillMd);
      const skill = new MarkdownSkill(parsed, 'builtin/data-analysis');
      skills.push(skill);
    } catch (error) {
      console.error('Failed to load data-analysis skill:', error);
    }

    // 加载 web-research skill
    try {
      const parsed = parseSkillMd(webResearchSkillMd);
      const skill = new MarkdownSkill(parsed, 'builtin/web-research');
      skills.push(skill);
    } catch (error) {
      console.error('Failed to load web-research skill:', error);
    }

    return skills;
  }
}
