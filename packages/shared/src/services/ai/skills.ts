/**
 * Skills — parse SKILL.md files and generate system prompts
 * Skills are not AI SDK tools; they are instructions injected into the system prompt.
 */

export interface SkillInfo {
  id: string;
  name: string;
  description: string;
  body: string;
}

/**
 * Built-in skills defined inline (previously loaded from SKILL.md files)
 */
const builtinSkillDefs: SkillInfo[] = [
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
  },
];

export function getBuiltinSkills(): SkillInfo[] {
  return builtinSkillDefs;
}

/**
 * Generate system prompt section describing available skills
 */
export function generateSkillsSystemPrompt(): string {
  const skills = getBuiltinSkills();

  if (skills.length === 0) {
    return '';
  }

  const skillDescriptions = skills.map(skill =>
    `- **${skill.name}** (${skill.id}): ${skill.description}`
  ).join('\n');

  return `

## Available Skills

You have access to the following high-level skills that orchestrate multiple tools:

${skillDescriptions}

Skills are more powerful than individual tools - they can execute multi-step workflows and maintain state across operations. Use skills when you need to perform complex tasks that involve multiple steps.
`;
}
