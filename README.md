# 🐰 CyberBunny — Cross-platform OpenClaw

A cross-platform personal AI assistant that runs on multiple platforms (browser, desktop, mobile, CLI, terminal UI).

## 🚀 Quick Start

Visit [https://fairyshine.github.io/CyberBunny/](https://fairyshine.github.io/CyberBunny/) and enjoy !

Verified Provider: DeepSeek、OpenRouter

## ✨ Features

- 🌐 **Multi-platform** - Browser / Electron / React Native / CLI / TUI
- 🔧 **Tool System** - Built-in Python execution, shell command execution (Desktop), file management, web search, and more
- 🎯 **Skill System** - Extensible skills based on the AgentSkills.io format
- 🔌 **MCP Support** - Model Context Protocol integration
- 🌍 **i18n** - Chinese / English bilingual support
- 💾 **Local Storage** - All data stored locally for privacy
- 🎨 **Modern UI** - Built with React 19 + Tailwind CSS + shadcn/ui

## 📦 Monorepo Structure

```
cyberbunny/
├── packages/
│   ├── shared/          # Platform-agnostic core logic
│   ├── web/             # Browser (Vite + React)
│   ├── desktop/         # Desktop (Electron)
│   ├── mobile/          # Mobile (React Native)
│   ├── cli/             # CLI tool (Commander.js)
│   └── tui/             # Terminal UI (Ink - React for CLI)
└── worker/              # Cloudflare Worker (CORS proxy)
```

## 📚 Documentation

- [CLI Guide](./packages/cli/README.md)
- [Skill System Design](./docs/SKILLS_DESIGN.md)
- [Platform Abstraction Layer](./packages/shared/src/platform/)

## 🧪 Development

### Dependency Management (pnpm Strict Mode)

This project uses pnpm workspace in **strict mode**: each package can only access dependencies explicitly declared in its own `package.json`.

Since workspace packages like `shared` and `ui-web` are consumed as **source code** (`"main": "./src/index.ts"`, not compiled artifacts), Vite processes their source directly during builds. This means their `import` statements are resolved from the consumer's (e.g., `web`, `desktop`) `node_modules`.

**Therefore, `web` and `desktop` must explicitly declare transitive dependencies** from `shared` / `ui-web` (such as Radix UI, i18next, zustand, etc.), even if their own source code doesn't directly import them.

```
web/desktop source
  → import { Foo } from '@cyberbunny/ui-web'    # workspace source reference
    → ui-web source import '@radix-ui/react-dialog'  # transitive dependency
      → Vite resolves from web/desktop node_modules  # must be declared in strict mode
```

> **Note**: Do not remove seemingly "redundant" dependencies from `web`/`desktop`, or the build will fail. These can be removed if workspace packages are later published as compiled artifacts.

### Type Checking

```bash
pnpm typecheck
```

### Linting

```bash
pnpm lint
```

## 🔒 Privacy & Security

- ✅ All data stored locally
- ✅ No user data uploaded
- ✅ API keys stored locally with encryption
- ✅ Self-hosted CORS proxy supported

## 🤝 Contributing

Contributions, bug reports, and suggestions are welcome!

## 📄 License

MIT License

## 🙏 Acknowledgements

- friends from https://www.feedscription.com
- All open-source repo

---

**CyberBunny** - A truly cross-platform AI Agent 🐰
