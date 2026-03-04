# 🐰CyberBunny - Personal AI Assistant

<div align="center">

**🐰 浏览器端 AI Agent 平台**

一个完全运行在浏览器中的智能代理系统，支持 Python 执行、文件管理、工具扩展和 MCP 集成。

[![React](https://img.shields.io/badge/React-19-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

</div>

## ✨ 核心特性

### 🤖 智能 Agent 系统
- **自主任务执行** - Agent 自动分析任务并执行
- **工具自动调用** - 智能选择和组合使用工具
- **流式响应** - 实时显示执行过程和结果
- **多轮对话** - 支持复杂任务的多步骤执行

### 🐍 Python 运行时
- **Pyodide 集成** - 完整的 Python 3.11 环境
- **科学计算** - 支持 NumPy、Pandas、Matplotlib
- **文件系统同步** - Python 与浏览器文件系统无缝集成
- **输出捕获** - 实时显示 stdout/stderr 和图表

### 📁 文件系统沙盒
- **IndexedDB 存储** - 持久化的浏览器端文件系统
- **POSIX 接口** - 熟悉的文件操作 API
- **拖拽上传** - 支持文件和文件夹拖拽
- **在线编辑** - 内置代码编辑器

### 🔧 可扩展工具系统
- **内置工具** - Python 执行、网页搜索、计算器、文件操作
- **动态加载** - 支持从文件、HTTP、MCP 加载工具
- **工具注册** - 简单的工具开发和注册机制
- **参数验证** - 自动验证工具输入参数

### ⚡ Skills 系统
- **高级能力** - 编排多个工具完成复杂任务
- **内置 Skills** - 数据分析、网页研究等
- **多步执行** - 支持有状态的多步骤工作流
- **动态扩展** - 支持从文件、HTTP、代码加载自定义 Skills

### 🔌 MCP 集成
- **Model Context Protocol** - 连接外部工具服务器
- **WebSocket/SSE** - 双协议支持
- **工具发现** - 自动发现和加载 MCP 工具
- **远程执行** - 调用远程工具和资源

### 💬 多 LLM 支持
- **OpenAI**
- **Anthropic**
- **自定义端点** - 支持 vLLM、Ollama 等本地部署
- **流式输出** - SSE 实时响应

### 🎨 现代化 UI
- **React 19** - 最新的 React 版本
- **shadcn/ui** - 精美的组件库
- **Tailwind CSS** - 响应式设计
- **深色模式** - 自动切换主题

## 🚀 快速开始

### 前置要求

- Node.js 18+ 或 Bun
- pnpm (推荐) 或 npm

### 安装

```bash
# 克隆仓库
git clone https://github.com/yourusername/cyberbunny.git
cd cyberbunny

# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev
```

访问 http://localhost:5173 开始使用。

### 配置 LLM

1. 点击右上角的设置按钮
2. 选择 "LLM 配置" 标签
3. 选择提供商 (OpenAI/Anthropic/自定义)
4. 输入 API Key
5. 点击 "测试连接" 验证配置

## 📖 使用示例

### Python 代码执行
```
用户: 计算斐波那契数列的前 10 项

Agent: 我来帮你计算斐波那契数列。

[执行 Python 代码]
def fibonacci(n):
    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib

print(fibonacci(10))

[输出] [0, 1, 1, 2, 3, 5, 8, 13, 21, 34]

斐波那契数列的前 10 项是：0, 1, 1, 2, 3, 5, 8, 13, 21, 34
```

### 文件操作
```
用户: 创建一个 hello.txt 文件，内容是 "Hello, World!"

Agent: 我来创建这个文件。

[写入文件] /workspace/hello.txt
✅ 文件已保存 (13 字符)

已成功创建 hello.txt 文件，内容为 "Hello, World!"
```

### Skills 使用
```
用户: 分析这个 CSV 文件的数据分布

Agent: 我将使用数据分析 Skill 来处理这个任务。

[调用 Skill: data-analysis]
步骤 1: 读取文件 data.csv
步骤 2: 使用 Pandas 分析数据
步骤 3: 生成可视化图表

[生成图表] distribution.png
✅ 分析完成

数据分析结果：
- 总行数: 1000
- 数值列均值: 45.2
- 已生成分布图表
```

## 🏗️ 项目结构

```
cyberbunny/
├── src/
│   ├── components/          # React 组件
│   │   ├── ui/             # shadcn/ui 基础组件
│   │   ├── chat/           # 聊天相关组件
│   │   ├── sidebar/        # 侧边栏组件
│   │   ├── settings/       # 设置相关组件
│   │   └── layout/         # 布局组件
│   ├── services/           # 核心服务层
│   │   ├── filesystem/     # 文件系统 (IndexedDB)
│   │   ├── python/         # Python 执行器 (Pyodide)
│   │   ├── mcp/           # MCP 客户端
│   │   ├── tools/         # 工具注册与加载
│   │   ├── skills/        # Skills 系统
│   │   ├── llm/           # LLM 对话管理
│   │   └── console/       # 日志系统
│   ├── stores/            # Zustand 状态管理
│   │   ├── session.ts     # 会话状态
│   │   ├── settings.ts    # 应用设置
│   │   ├── tools.ts       # 工具状态
│   │   └── skills.ts      # Skills 状态
│   ├── hooks/             # React Hooks
│   ├── utils/             # 工具函数
│   ├── lib/               # 库函数
│   └── types/             # TypeScript 类型定义
├── worker/                # Cloudflare Worker (CORS 代理)
├── docs/                  # 文档
└── package.json
```

## 🛠️ 技术栈

- **React 19** - UI 框架
- **TypeScript 5** - 类型安全
- **Vite 5** - 构建工具
- **shadcn/ui** - 组件库
- **Tailwind CSS** - 样式框架
- **Zustand** - 状态管理
- **Pyodide** - 浏览器端 Python
- **IndexedDB** - 本地存储

## 🔧 开发

```bash
# 开发服务器
pnpm dev

# 构建
pnpm build

# 类型检查
pnpm typecheck

# Lint
pnpm lint
```

## 📝 许可证

MIT License - 查看 [LICENSE](./LICENSE) 文件

## 🙏 致谢

- [Pyodide](https://pyodide.org/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Model Context Protocol](https://modelcontextprotocol.io/)

---

<div align="center">
Made with ❤️ by RadiCato
</div>
