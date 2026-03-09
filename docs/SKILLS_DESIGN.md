# Skills 系统设计文档

> 基于 [AgentSkills.io](https://agentskills.io) 规范实现

## 概念定义

### Skills vs Tools

**Tools（工具）**：
- 单一功能的原子操作
- 直接执行具体任务（如 Python 执行、文件读写、网页搜索）
- 输入输出明确
- 无状态、可组合

**Skills（技能）**：
- 更高级的能力组合
- 包含详细的指令和工作流程
- 通过 SKILL.md 文件定义
- LLM 根据指令执行任务
- 可以调用多个 Tools 完成复杂任务

### 示例对比

**Tool 示例**：
- `python`: 执行 Python 代码
- `file_manager`: 文件管理（读取、写入、列表、创建目录、删除）
- `web_search`: 网页搜索

**Skill 示例**：
- `data-analysis`: 数据分析技能（读取文件 → Python 分析 → 生成图表 → 保存结果）
- `web-research`: 网页研究技能（搜索 → 提取内容 → 总结 → 保存笔记）

## SKILL.md 格式规范

### 文件结构

每个 Skill 是一个包含 `SKILL.md` 文件的目录：

```
skill-name/
├── SKILL.md          # Required: 指令和元数据
├── scripts/          # Optional: 可执行脚本
├── references/       # Optional: 参考文档
└── assets/           # Optional: 模板和资源
```

### SKILL.md 格式

```markdown
---
name: skill-name
description: 技能描述和使用场景
license: MIT
metadata:
  author: OpenBunny
  version: "1.0"
  category: data
allowed-tools: Read Write Bash(python:*)
---

# Skill Title

## When to use this skill
使用场景说明...

## How it works
工作流程说明...

## Examples
示例代码和用例...
```

### Frontmatter 字段

| 字段 | 必需 | 说明 |
|------|------|------|
| `name` | 是 | 1-64字符，小写字母、数字、连字符 |
| `description` | 是 | 1-1024字符，描述功能和使用场景 |
| `license` | 否 | 许可证名称 |
| `compatibility` | 否 | 环境要求说明 |
| `metadata` | 否 | 自定义元数据键值对 |
| `allowed-tools` | 否 | 预批准的工具列表 |

## 系统架构

### 1. 核心组件

```typescript
// SKILL.md 解析器
parseSkillMd(content: string): ParsedSkill

// Markdown Skill 实现
class MarkdownSkill implements ISkill {
  execute(input: string, context: SkillContext): Promise<SkillExecuteResult>
}

// Skill 加载器
interface ISkillLoader {
  readonly type: string;
  load(source: string): Promise<ISkill[]>;
}
```

### 2. 渐进式加载

Skills 使用渐进式加载策略以优化性能：

1. **启动时**: 只加载 `name` 和 `description` (~100 tokens)
2. **激活时**: 加载完整的 SKILL.md 内容 (<5000 tokens)
3. **按需加载**: 引用的文件（scripts/, references/, assets/）仅在需要时加载

### 3. Skill 注册表

```typescript
class SkillRegistry {
  private skills: Map<string, ISkill>;
  private sources: Map<string, SkillSource>;
  private loaders: Map<string, ISkillLoader>;

  // 加载 Skill 源
  async loadSource(source: SkillSource): Promise<void>

  // 卸载 Skill 源
  async unloadSource(sourceId: string): Promise<void>

  // 执行 Skill
  async execute(skillId: string, input: string): Promise<SkillExecuteResult>

  // 订阅变更
  subscribe(listener: () => void): () => void
}
}

// Skill 基类
abstract class BaseSkill implements ISkill {
  constructor(public readonly metadata: SkillMetadata) {}

  abstract execute(input: string, context: SkillContext): Promise<SkillExecuteResult>;

  async validate(_input: string): Promise<boolean> {
    return true;
  }

  // 辅助方法：调用工具
  protected async callTool(
    toolId: string,
    input: string,
    context: SkillContext
  ): Promise<ToolExecuteResult> {
    return context.tools.execute(toolId, input);
  }

  // 辅助方法：保存状态
  protected setState(key: string, value: any, context: SkillContext): void {
    context.state.set(key, value);
  }

  // 辅助方法：获取状态
  protected getState(key: string, context: SkillContext): any {
    return context.state.get(key);
  }
}
```

### 3. Skill 加载器

```typescript
interface ISkillLoader {
  readonly type: string;
  load(source: string): Promise<ISkill[]>;
  unload?(skillId: string): Promise<void>;
}

// Skill 源配置
interface SkillSource {
  id: string;
  type: 'builtin' | 'file' | 'http' | 'code';
  name: string;
  source: string;
  enabled: boolean;
  metadata?: Record<string, unknown>;
}
```

### 4. Skill 注册表

```typescript
class SkillRegistry {
  private skills: Map<string, ISkill>;
  private sources: Map<string, SkillSource>;
  private loaders: Map<string, ISkillLoader>;
  private listeners: Set<() => void>;

  // 加载 Skill 源
  async loadSource(source: SkillSource): Promise<void>;

  // 卸载 Skill 源
  async unloadSource(sourceId: string): Promise<void>;

  // 注册单个 Skill
  register(skill: ISkill): void;

  // 注销单个 Skill
  async unregister(skillId: string): Promise<void>;

  // 获取 Skill
  get(skillId: string): ISkill | undefined;

  // 获取所有 Skill
  getAll(): ISkill[];

  // 执行 Skill
  async execute(skillId: string, input: string, context: SkillContext): Promise<SkillExecuteResult>;

  // 订阅变更
  subscribe(listener: () => void): () => void;
}
```

## 目录结构

```
src/
├── services/
│   └── skills/
│       ├── base.ts              # Skill 基础类型和接口
│       ├── registry.ts          # Skill 注册表
│       ├── loaders/
│       │   ├── index.ts
│       │   ├── builtin.ts       # 内置 Skill 加载器
│       │   ├── file.ts          # 文件 Skill 加载器
│       │   ├── http.ts          # HTTP Skill 加载器
│       │   └── code.ts          # 代码 Skill 加载器
│       └── builtin/
│           ├── index.ts
│           ├── data-analysis.ts # 数据分析 Skill
│           └── web-research.ts  # 网页研究 Skill
├── stores/
│   └── skills.ts                # Skill 状态管理
└── components/
    └── settings/
        └── SkillManager.tsx     # Skill 管理界面
```

## 工作流程

### 1. Skill 加载流程

```
1. 应用启动
   ↓
2. SkillRegistry 初始化
   ↓
3. 自动加载内置 Skills (builtin/)
   ↓
4. 从持久化存储加载用户添加的 Skills
   ↓
5. 解析 SKILL.md 文件
   ↓
6. 创建 MarkdownSkill 实例
   ↓
7. 注册到 SkillRegistry
   ↓
8. 通知订阅者更新 UI
```

### 2. Skill 执行流程

```
1. 用户发送消息
   ↓
2. LLM 分析任务，决定使用哪个 Skill
   ↓
3. LLM 调用 Skill (通过 tool call)
   ↓
4. ChatContainer.executeTool() 识别为 Skill
   ↓
5. SkillRegistry.execute() 执行 Skill
   ↓
6. MarkdownSkill 返回指令内容给 LLM
   ↓
7. LLM 根据指令执行具体任务
   ↓
8. LLM 调用所需的 Tools
   ↓
9. 返回最终结果给用户
```

### 3. LLM 集成流程

```
1. 启动时加载所有 Skills 的 name + description
   ↓
2. 转换为 LLM 工具格式 (OpenAI/Anthropic)
   ↓
3. 合并到 LLM 的工具列表中
   ↓
4. 生成 Skills 系统提示
   ↓
5. LLM 看到可用的 Skills
   ↓
6. LLM 根据任务选择合适的 Skill
   ↓
7. 调用 Skill 获取详细指令
   ↓
8. 按照指令执行任务
```

## 内置 Skills

### 1. data-analysis

**功能**: 分析数据文件 (CSV, JSON, Excel)

**工作流程**:
1. 读取数据文件
2. 使用 Python/Pandas 进行统计分析
3. 生成可视化图表
4. 创建分析报告

**使用场景**:
- 数据统计分析
- 生成图表和可视化
- 数据清洗和转换
- 相关性分析

### 2. web-research

**功能**: 网页研究和信息收集

**工作流程**:
1. 使用 WebSearch 搜索相关信息
2. 使用 WebFetch 提取网页内容
3. 综合多个来源的信息
4. 生成研究报告

**使用场景**:
- 主题研究
- 事实核查
- 产品对比
- 信息汇总

## 扩展 Skills

### 从文件加载

```typescript
// 用户可以创建自己的 SKILL.md 文件
my-skill/
├── SKILL.md
├── scripts/
│   └── helper.py
└── references/
    └── REFERENCE.md
```

### 从 HTTP 加载

```typescript
// 从远程 URL 加载 Skills
{
  type: 'http',
  source: 'https://example.com/skills/my-skill.json',
  enabled: true
}
```

### 从代码加载

```typescript
// 直接从代码字符串加载
{
  type: 'code',
  source: `
---
name: custom-skill
description: My custom skill
---

# Custom Skill
...
  `,
  enabled: true
}
```

## 最佳实践

### 编写 SKILL.md

1. **清晰的描述**: description 应该包含使用场景和关键词
2. **结构化指令**: 使用标题和列表组织内容
3. **具体示例**: 提供代码示例和用例
4. **错误处理**: 说明常见错误和解决方法
5. **简洁明了**: 保持 SKILL.md 在 500 行以内

### 工具依赖

1. **明确声明**: 在 allowed-tools 中列出所需工具
2. **最小化依赖**: 只依赖必要的工具
3. **降级方案**: 如果工具不可用，提供替代方案

### 性能优化

1. **渐进式加载**: 只在需要时加载完整内容
2. **缓存结果**: 对于重复的操作缓存结果
3. **异步执行**: 使用异步操作避免阻塞

## 参考资源

- [AgentSkills.io 官方文档](https://agentskills.io)
- [AgentSkills.io 规范](https://agentskills.io/specification)
- [示例 Skills](https://github.com/anthropics/skills)
- [最佳实践](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
class DataAnalysisSkill extends BaseSkill {
  constructor() {
    super({
      id: 'data_analysis',
      name: '数据分析',
      description: '读取数据文件，进行分析并生成可视化图表',
      version: '1.0.0',
      requiredTools: ['file_manager', 'python'],
      parameters: [
        {
          name: 'file_path',
          type: 'string',
          description: '数据文件路径',
          required: true,
        },
        {
          name: 'analysis_type',
          type: 'string',
          description: '分析类型（统计/趋势/相关性）',
          required: false,
          default: '统计',
        },
      ],
    });
  }

  async execute(input: string, context: SkillContext): Promise<SkillExecuteResult> {
    const steps: SkillStep[] = [];

    try {
      // 步骤 1: 读取文件
      const fileResult = await this.callTool('file_manager', input, context);
      steps.push({
        name: '读取文件',
        tool: 'file_manager',
        input,
        output: fileResult.content,
        timestamp: Date.now(),
      });

      // 步骤 2: Python 分析
      const analysisCode = this.generateAnalysisCode(fileResult.content);
      const analysisResult = await this.callTool('python', analysisCode, context);
      steps.push({
        name: 'Python 分析',
        tool: 'python',
        input: analysisCode,
        output: analysisResult.content,
        timestamp: Date.now(),
      });

      return {
        success: true,
        output: analysisResult.content,
        steps,
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        steps,
      };
    }
  }

  private generateAnalysisCode(data: string): string {
    return `
import pandas as pd
import matplotlib.pyplot as plt

# 分析数据
data = """${data}"""
# ... 分析逻辑
    `;
  }
}
```

## UI 设计

### Settings Modal - Skills Tab

```
┌─────────────────────────────────────────────────────────┐
│ ⚙️ 设置                                                  │
├─────────────────────────────────────────────────────────┤
│ [LLM] [Tools] [Skills] [General]                        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 📦 已安装的 Skills                                       │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 🔬 数据分析                              [✓] [⚙️]  │   │
│ │ 读取数据文件，进行分析并生成可视化图表              │   │
│ │ 需要: file_manager, python                          │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ ┌──────────────────────────────────────────────────┐   │
│ │ 🔍 网页研究                              [✓] [⚙️]  │   │
│ │ 搜索网页内容，提取信息并生成研究报告                │   │
│ │ 需要: web_search, file_manager                      │   │
│ └──────────────────────────────────────────────────┘   │
│                                                          │
│ [+ 添加 Skill]                                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 实现优先级

1. **Phase 1: 基础架构**
   - ✅ 定义 Skill 接口和类型
   - ✅ 实现 SkillRegistry
   - ✅ 实现基础加载器

2. **Phase 2: 内置 Skills**
   - 实现 2-3 个示例 Skill
   - 测试 Skill 执行流程

3. **Phase 3: UI 集成**
   - 添加 Skills 标签页
   - 实现 SkillManager 组件
   - 集成到对话流程

4. **Phase 4: 高级功能**
   - Skill 市场/商店
   - Skill 编辑器
   - Skill 调试工具
