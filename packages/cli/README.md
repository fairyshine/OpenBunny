# OpenBunny CLI & TUI

OpenBunny 提供了两种命令行使用方式：

## CLI - 命令行工具

基于 Commander.js 的传统 CLI 工具。

### 安装

```bash
# 开发模式
cd packages/cli
pnpm install
pnpm dev -- --help

# 构建后使用
pnpm build
./dist/index.js --help
```

### 命令

#### 0. 查看支持的 Provider

```bash
openbunny providers
```

#### 1. 一次性问答

```bash
# 基本用法
openbunny ask "什么是 TypeScript?"

# 指定模型和 provider
openbunny ask "解释 monorepo" -m gpt-5-mini -p openai -k YOUR_API_KEY

# 使用本地 Ollama（无需 API Key）
openbunny ask "解释 monorepo" -p ollama -b http://127.0.0.1:11434/v1 -m qwen3

# 使用系统提示
openbunny ask "写一个排序算法" --system "你是一个 Python 专家"

# 禁用流式输出
openbunny ask "Hello" --no-stream
```

#### 2. 交互式对话

```bash
# 启动聊天会话
openbunny chat -k YOUR_API_KEY

# 指定模型
openbunny chat -m gpt-5-mini -p openai

# 使用自定义 API
openbunny chat -b http://localhost:8000 -k local-key

# 会话内命令
> /quit      # 退出
> /exit      # 退出
> /clear     # 清空历史
> /history   # 查看消息数量
> /help      # 查看命令
```

#### 3. 配置管理

```bash
# 设置 API Key
openbunny config set apiKey sk-xxx

# 设置默认模型
openbunny config set model gpt-4

# 查看配置
openbunny config list

# 获取单个配置
openbunny config get apiKey

# 删除配置
openbunny config delete apiKey

# 清空所有配置
openbunny config clear
```

### 环境变量

```bash
# API Key
export OPENBUNNY_API_KEY=sk-xxx

# 使用环境变量
openbunny ask "Hello"
```

### 选项

所有命令支持的通用选项：

- `-m, --model <model>` - 模型名称（默认：gpt-4）
- `-p, --provider <provider>` - Provider ID，可通过 `openbunny providers` 查看
- `-k, --api-key <key>` - API Key
- `-b, --base-url <url>` - 自定义 API 地址
- `-t, --temperature <temp>` - 温度参数（默认：0.7）
- `--max-tokens <tokens>` - 最大 token 数（默认：4096）
- `--system <prompt>` - 系统提示

---

## TUI - 终端界面

基于 Ink (React for CLI) 的全屏交互式界面。

### 安装

```bash
# 开发模式
cd packages/tui
pnpm install
pnpm dev -- -k YOUR_API_KEY

# 构建后使用
pnpm build
./dist/index.js -k YOUR_API_KEY
```

### 使用

```bash
# 基本用法
openbunny-tui -k YOUR_API_KEY

# 指定模型
openbunny-tui -m gpt-4-turbo -p openai -k YOUR_API_KEY

# 使用系统提示
openbunny-tui -s "你是一个代码助手" -k YOUR_API_KEY

# 使用自定义 API
openbunny-tui -b http://localhost:8000 -k local-key
```

### 界面说明

```
┌─────────────────────────────────────────────────┐
│ OpenBunny TUI | gpt-4 | openai | /quit to exit│
├─────────────────────────────────────────────────┤
│ > 你好                                          │
│   你好！有什么我可以帮助你的吗？                │
│                                                 │
│ 🐰 [流式响应实时显示...]                        │
│                                                 │
│ > [输入框]                                      │
└─────────────────────────────────────────────────┘
```

### TUI 内命令

- `/quit` 或 `/exit` - 退出程序
- `/clear` - 清空对话历史

### 特性

- ✅ 实时流式响应
- ✅ 消息历史管理
- ✅ 加载动画
- ✅ 错误提示
- ✅ 彩色输出
- ✅ 自动换行

---

## 配置优先级

1. 命令行参数（最高优先级）
2. 环境变量（如 `OPENBUNNY_API_KEY`、`OPENBUNNY_MODEL`）
3. 配置文件（`openbunny config set`）

---

## 示例场景

### 场景 1: 快速问答

```bash
# 设置一次 API Key
openbunny config set apiKey sk-xxx

# 之后直接使用
openbunny ask "什么是 Docker?"
openbunny ask "解释 Kubernetes"
```

### 场景 2: 代码助手

```bash
# 启动代码助手会话
openbunny chat --system "你是一个 TypeScript 专家，帮我解答代码问题"

> 如何在 TypeScript 中定义泛型约束？
> 什么是 mapped types？
> /quit
```

### 场景 3: 使用本地模型

```bash
# 连接本地 vLLM 服务
openbunny-tui -b http://localhost:8000/v1 -m llama-3 -k local
```

### 场景 4: 脚本集成

```bash
#!/bin/bash
# 批量翻译文件

for file in *.txt; do
  content=$(cat "$file")
  openbunny ask "翻译成英文: $content" --no-stream > "${file%.txt}.en.txt"
done
```

---

## 开发

### 添加新命令

在 `packages/cli/src/commands/` 创建新文件：

```typescript
import { Command } from 'commander';

export const myCommand = new Command('my-command')
  .description('My custom command')
  .action(async () => {
    console.log('Hello from my command!');
  });
```

在 `packages/cli/src/index.ts` 注册：

```typescript
import { myCommand } from './commands/my-command';
program.addCommand(myCommand);
```

### 添加 TUI 组件

在 `packages/tui/src/components/` 创建 React 组件：

```typescript
import { Box, Text } from 'ink';

export function MyComponent() {
  return (
    <Box>
      <Text color="cyan">Hello from TUI!</Text>
    </Box>
  );
}
```

---

## 故障排除

### 问题：找不到 @shared 模块

确保从包目录运行：

```bash
cd packages/cli
pnpm dev -- ask "test"
```

### 问题：API Key 未配置

设置环境变量或配置：

```bash
export OPENBUNNY_API_KEY=sk-xxx
# 或
openbunny config set apiKey sk-xxx
```

### 问题：连接失败

检查网络和 API 地址：

```bash
# 测试连接
curl https://api.openai.com/v1/models -H "Authorization: Bearer $OPENBUNNY_API_KEY"
```

---

## 构建和发布

### 构建可执行文件

```bash
# 构建 CLI
cd packages/cli
pnpm build

# 构建 TUI
cd packages/tui
pnpm build
```

### 本地安装

```bash
# 链接到全局
cd packages/cli
npm link

# 现在可以全局使用
openbunny ask "test"
```

### 发布到 npm

```bash
# 在仓库根目录统一更新版本
pnpm version:set 0.2.0

# 先 dry-run 检查打包内容
pnpm publish:npm:dry-run

# 正式发布
pnpm publish:npm --access public
```
