# 🐰 CyberBunny — Cross-platform OpenClaw

A cross-platform personal AI assistant that runs on multiple platforms (browser, desktop, mobile, CLI, terminal UI).

## 🚀 Quick Start

1. Visit [https://fairyshine.github.io/CyberBunny/](https://fairyshine.github.io/CyberBunny/)
2. Enter your LLM API Key in Settings > LLM
3. Deploy a CORS proxy Worker in Settings > General and fill in the proxy URL
4. Enjoy!

## ✨ Features

- 🌐 **Multi-platform** - Browser / Electron / React Native / CLI / TUI
- 🔧 **Tool System** - Built-in Python execution, file management, web search, and more
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

### Adding a New Platform

1. Create `packages/your-platform/`
2. Implement the platform adapter in `src/platform/adapter.ts`
3. Initialize the platform context with `setPlatformContext()`
4. Update `packages/shared/src/platform/types.ts`

## 📝 Available Commands

```bash
# Development
pnpm dev              # Web dev server
pnpm dev:desktop      # Electron dev
pnpm dev:tui          # TUI dev

# Build
pnpm build            # Build Web
pnpm build:desktop    # Build Electron
pnpm build:cli        # Build CLI
pnpm build:tui        # Build TUI

# Package
pnpm package:desktop  # Package desktop app

# Tools
pnpm typecheck        # Type check all packages
pnpm lint             # Lint code
pnpm preview          # Preview Web build
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

- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [Pyodide](https://pyodide.org/) - In-browser Python
- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [Commander.js](https://github.com/tj/commander.js) - CLI framework

---

**CyberBunny** - A truly cross-platform AI Agent 🐰
