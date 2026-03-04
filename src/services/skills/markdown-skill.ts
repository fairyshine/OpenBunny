/**
 * 基于 SKILL.md 文件的 Skill 实现
 * 符合 AgentSkills.io 规范
 */

import { ISkill, SkillMetadata, SkillContext, SkillExecuteResult } from './base';
import { ParsedSkill } from './parser';

/**
 * MarkdownSkill - 从 SKILL.md 文件加载的 Skill
 *
 * 这个类将 SKILL.md 的内容作为 LLM 的指令,让 LLM 按照指令执行任务
 */
export class MarkdownSkill implements ISkill {
  readonly metadata: SkillMetadata;
  private readonly instructions: string;
  private readonly skillPath: string;
  private fullContent: string | null = null;

  constructor(
    parsedSkill: ParsedSkill,
    skillPath: string
  ) {
    const { frontmatter, body } = parsedSkill;

    // 构建 metadata
    this.metadata = {
      id: frontmatter.name,
      name: frontmatter.name,
      description: frontmatter.description,
      version: frontmatter.metadata?.version,
      author: frontmatter.metadata?.author,
      tags: frontmatter.metadata?.category ? [frontmatter.metadata.category] : undefined,
      requiredTools: frontmatter['allowed-tools']?.split(/\s+/).filter(Boolean),
    };

    this.instructions = body;
    this.skillPath = skillPath;
  }

  /**
   * 执行 Skill
   *
   * 对于 SKILL.md 格式的 skill,执行意味着:
   * 1. 将 SKILL.md 的指令内容返回给 LLM
   * 2. LLM 会根据指令内容来执行具体的任务
   * 3. LLM 可以调用 allowed-tools 中列出的工具
   */
  async execute(input: string, _context: SkillContext): Promise<SkillExecuteResult> {
    try {
      // 构建完整的指令内容
      const fullInstructions = this.buildInstructions(input);

      // 返回指令给 LLM
      // LLM 会根据这些指令来执行任务
      return {
        success: true,
        output: fullInstructions,
        data: {
          skillPath: this.skillPath,
          requiredTools: this.metadata.requiredTools,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * 构建完整的指令内容
   */
  private buildInstructions(userInput: string): string {
    return `# Skill: ${this.metadata.name}

## User Request
${userInput}

## Instructions
${this.instructions}

## Available Tools
${this.metadata.requiredTools?.join(', ') || 'All enabled tools'}

---

Please follow the instructions above to complete the user's request. Use the available tools as needed.`;
  }

  /**
   * 验证输入
   */
  async validate(_input: string): Promise<boolean> {
    // SKILL.md 格式的 skill 不需要特殊验证
    return true;
  }

  /**
   * 加载完整内容 (渐进式加载)
   */
  async loadFullContent(): Promise<void> {
    if (this.fullContent) return;
    this.fullContent = this.instructions;
  }

  /**
   * 获取 Skill 路径
   */
  getSkillPath(): string {
    return this.skillPath;
  }
}
