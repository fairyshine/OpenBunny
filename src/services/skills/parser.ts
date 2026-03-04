/**
 * SKILL.md 文件解析器
 * 解析符合 AgentSkills.io 规范的 SKILL.md 文件
 */

/**
 * SKILL.md Frontmatter 定义
 */
export interface SkillFrontmatter {
  name: string;                    // Required: 1-64 chars, lowercase, hyphens only
  description: string;             // Required: 1-1024 chars
  license?: string;                // Optional: license name or reference
  compatibility?: string;          // Optional: max 500 chars
  metadata?: Record<string, string>; // Optional: arbitrary key-value pairs
  'allowed-tools'?: string;        // Optional: space-delimited tool list
}

/**
 * 解析后的 SKILL.md 内容
 */
export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;                    // Markdown instructions
}

/**
 * 验证 skill name 格式
 */
function validateSkillName(name: string): boolean {
  // 1-64 characters
  if (name.length < 1 || name.length > 64) {
    return false;
  }

  // Only lowercase letters, numbers, and hyphens
  if (!/^[a-z0-9-]+$/.test(name)) {
    return false;
  }

  // Must not start or end with hyphen
  if (name.startsWith('-') || name.endsWith('-')) {
    return false;
  }

  // Must not contain consecutive hyphens
  if (name.includes('--')) {
    return false;
  }

  return true;
}

/**
 * 验证 description 格式
 */
function validateDescription(description: string): boolean {
  return description.length >= 1 && description.length <= 1024;
}

/**
 * 验证 compatibility 格式
 */
function validateCompatibility(compatibility?: string): boolean {
  if (!compatibility) return true;
  return compatibility.length >= 1 && compatibility.length <= 500;
}

/**
 * 解析 YAML frontmatter
 */
function parseFrontmatter(yamlText: string): SkillFrontmatter {
  const lines = yamlText.trim().split('\n');
  const frontmatter: Partial<SkillFrontmatter> = {};
  let currentKey: string | null = null;
  let currentValue: string[] = [];

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Check if this is a key-value line
    const match = line.match(/^([a-z-]+):\s*(.*)$/);
    if (match) {
      // Save previous key-value if exists
      if (currentKey) {
        const value = currentValue.join('\n').trim();
        if (currentKey === 'metadata') {
          // Parse metadata as object
          try {
            frontmatter.metadata = JSON.parse(value);
          } catch {
            frontmatter.metadata = {};
          }
        } else {
          (frontmatter as any)[currentKey] = value;
        }
      }

      // Start new key-value
      currentKey = match[1];
      currentValue = [match[2]];
    } else if (currentKey) {
      // Continuation of previous value
      currentValue.push(line);
    }
  }

  // Save last key-value
  if (currentKey) {
    const value = currentValue.join('\n').trim();
    if (currentKey === 'metadata') {
      try {
        frontmatter.metadata = JSON.parse(value);
      } catch {
        frontmatter.metadata = {};
      }
    } else {
      (frontmatter as any)[currentKey] = value;
    }
  }

  // Validate required fields
  if (!frontmatter.name) {
    throw new Error('Missing required field: name');
  }
  if (!frontmatter.description) {
    throw new Error('Missing required field: description');
  }

  // Validate field formats
  if (!validateSkillName(frontmatter.name)) {
    throw new Error(`Invalid skill name: ${frontmatter.name}. Must be 1-64 chars, lowercase letters/numbers/hyphens only, no leading/trailing/consecutive hyphens.`);
  }
  if (!validateDescription(frontmatter.description)) {
    throw new Error(`Invalid description: must be 1-1024 characters`);
  }
  if (!validateCompatibility(frontmatter.compatibility)) {
    throw new Error(`Invalid compatibility: must be 1-500 characters`);
  }

  return frontmatter as SkillFrontmatter;
}

/**
 * 解析 SKILL.md 文件内容
 */
export function parseSkillMd(content: string): ParsedSkill {
  // Check for frontmatter delimiters
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md format: missing YAML frontmatter (---...---)');
  }

  const [, yamlText, body] = frontmatterMatch;

  // Parse frontmatter
  const frontmatter = parseFrontmatter(yamlText);

  // Return parsed skill
  return {
    frontmatter,
    body: body.trim(),
  };
}

/**
 * 从 SKILL.md 内容中提取 metadata (name + description)
 * 用于渐进式加载 - 只加载最少信息
 */
export function extractSkillMetadata(content: string): Pick<SkillFrontmatter, 'name' | 'description'> {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    throw new Error('Invalid SKILL.md format: missing YAML frontmatter');
  }

  const yamlText = frontmatterMatch[1];
  const lines = yamlText.split('\n');

  let name = '';
  let description = '';

  for (const line of lines) {
    const nameMatch = line.match(/^name:\s*(.+)$/);
    if (nameMatch) {
      name = nameMatch[1].trim();
    }

    const descMatch = line.match(/^description:\s*(.+)$/);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Early exit if we have both
    if (name && description) {
      break;
    }
  }

  if (!name || !description) {
    throw new Error('Missing required fields: name and description');
  }

  return { name, description };
}
