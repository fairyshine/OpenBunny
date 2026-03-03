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

### 🔌 MCP 集成
- **Model Context Protocol** - 连接外部工具服务器
- **WebSocket/SSE** - 双协议支持
- **工具发现** - 自动发现和加载 MCP 工具
- **远程执行** - 调用远程工具和资源

### 💬 多 LLM 支持
- **OpenAI** - GPT-3.5/GPT-4 系列
- **Anthropic** - Claude 系列
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
│   │   ├── llm/           # LLM 对话管理
│   │   └── console/       # 日志系统
│   ├── stores/            # Zustand 状态管理
│   │   ├── session.ts     # 会话状态
│   │   ├── settings.ts    # 应用设置
│   │   └── tools.ts       # 工具状态
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

## 🎯 架构优化建议

### 当前架构优势
- ✅ 清晰的分层架构 (组件/服务/状态)
- ✅ 类型安全的 TypeScript 实现
- ✅ 模块化的工具系统设计
- ✅ 响应式状态管理 (Zustand)

### 待优化项

#### 1. 代码组织
- **组件分组**: 将扁平的 components 目录按功能分组 (chat/sidebar/settings/layout)
- **类型去重**: 统一 `LLMMessage` 类型定义到 `types/index.ts`
- **移除死代码**: 清理未使用的 `messageConverter.ts` 和未初始化的快捷键系统

#### 2. 性能优化
- **组件记忆化**: 为 `MessageItem` 等高频渲染组件添加 `React.memo`
- **虚拟滚动**: 长对话列表使用虚拟化渲染
- **代码分割**: 懒加载设置面板、文件编辑器等非关键组件
- **Bundle 优化**: 配置 Vite 手动分包，分离 vendor 代码

#### 3. 状态管理
- **派生状态**: `currentSession` 应从 `sessions` 数组派生，避免状态不同步
- **工具状态响应**: 修复 `toolRegistry` 变更不触发 React 更新的问题
- **单一数据源**: 统一 `proxyWorkerUrl` 的存储位置

#### 4. 服务层改进
- **MCP 客户端**: 修复并发工具调用的消息处理竞态问题
- **文件系统**: 优化 `readdir` 使用 IndexedDB 范围查询，支持递归同步
- **错误处理**: 添加顶层 `ErrorBoundary`，统一错误消息格式化

#### 5. 类型安全
- **消除 `any`**: 为 `requestBody`、`fileSystem` 参数等添加明确类型
- **Provider 实现**: 完善 Anthropic provider 的 API 调用逻辑
- **依赖修正**: 将 Radix UI 包从 `devDependencies` 移至 `dependencies`

### 优先级建议
1. 🔴 **高优先级**: 修复 `currentSession` 状态同步 bug (数据完整性风险)
2. 🟡 **中优先级**: 添加 `React.memo` 和 ErrorBoundary (用户体验)
3. 🟢 **低优先级**: 代码重组和 Bundle 优化 (长期维护性)

详细的架构分析和重构指南请参考 [架构文档](./docs/ARCHITECTURE.md)。

## 🚢 部署

### GitHub Pages

```bash
export GITHUB_PAGES=true
pnpm build
# 部署 dist 目录到 gh-pages 分支
```

### Cloudflare Pages / Vercel

```bash
# 构建命令
pnpm build

# 输出目录
dist
```

## 📚 文档

- [架构文档](./docs/ARCHITECTURE.md)
- [开发指南](./docs/DEVELOPMENT.md)
- [工具开发](./docs/TOOL_DEVELOPMENT.md)
- [MCP 集成](./docs/MCP_INTEGRATION.md)

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](./CONTRIBUTING.md)。

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

