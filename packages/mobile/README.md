# OpenBunny Mobile

React Native mobile application for OpenBunny, built with Expo SDK 52.

## Features

- **Chat Interface**: Full-featured chat with streaming LLM responses
- **Session Management**: Create, list, and manage chat sessions
- **Settings**: Configure LLM provider, API keys, theme, and language
- **Platform Integration**: Shares core logic with web/desktop via `@openbunny/shared`
- **Offline Storage**: AsyncStorage-based persistence for sessions and settings
- **i18n**: Multi-language support (zh-CN, en-US)
- **Theming**: Light/dark/system theme support via React Native Paper

## Tech Stack

- **Framework**: Expo SDK 52 (React Native 0.76.5)
- **UI Library**: React Native Paper (Material Design 3)
- **Navigation**: React Navigation v7 (Stack + Bottom Tabs)
- **State Management**: Zustand (shared with web/desktop)
- **Storage**: AsyncStorage + localStorage shim
- **i18n**: react-i18next + expo-localization

## Development

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start Expo dev server
pnpm dev:mobile

# Run on iOS simulator
pnpm mobile:ios

# Run on Android emulator
pnpm mobile:android

# Type check
pnpm --filter @openbunny/mobile typecheck
```

## Architecture

### Platform Adapters

The mobile app implements the platform abstraction layer defined in `@openbunny/shared`:

- **localStorage-shim.ts**: Synchronous localStorage API over AsyncStorage (for Zustand persist)
- **storage.ts**: IPlatformStorage implementation (AsyncStorage)
- **filesystem.ts**: IPlatformFS implementation (expo-file-system)
- **i18n.ts**: Mobile-specific i18n initialization (expo-localization)
- **theme.ts**: Theme resolution and system listener (RN Appearance API)
- **native.ts**: Platform context registration

### Key Implementation Details

1. **localStorage Shim**: Zustand's persist middleware expects synchronous `localStorage`. The shim preloads known keys from AsyncStorage into memory on startup, then provides sync getItem/setItem that read/write to memory while async persisting to AsyncStorage.

2. **Shared Package Compatibility**: Fixed `import.meta.env` references in shared code to work with Metro bundler (wrapped in try-catch, added ImportMeta type declaration).

3. **React 18/19 Type Conflict**: Resolved pnpm monorepo type conflicts by adding `pnpm.overrides` at workspace root to force `@types/react@18.2.79` for all packages.

4. **Navigation**: Bottom tabs with nested stack navigator for chat flow (SessionList → Chat).

## Limitations (v1)

The following features from web/desktop are intentionally excluded:

- Python executor (Pyodide is browser-only)
- File editor (complex on mobile)
- Console panel (dev feature)
- MCP server connections
- Tool/Skill source management UI

## Project Structure

```
packages/mobile/
├── App.tsx                    # Entry point (init platform → render)
├── index.js                   # registerRootComponent + shim import
├── app.json                   # Expo configuration
├── babel.config.js            # Expo Babel config
├── metro.config.js            # Metro monorepo config
├── assets/                    # App icons, splash, and sound assets
└── src/
    ├── components/
    │   ├── chat/              # MessageList, MessageBubble, ChatInput
    │   └── common/            # LoadingSpinner
    ├── hooks/
    │   └── useAppTheme.ts     # Paper theme + shared store bridge
    ├── navigation/
    │   ├── index.tsx          # RootNavigator (Tab + Stack)
    │   └── types.ts           # Navigation type definitions
    ├── platform/              # Platform adapters (see above)
    ├── screens/
    │   ├── ChatScreen.tsx     # Chat interface with streaming
    │   ├── SessionListScreen.tsx  # Session list + empty state
    │   └── SettingsScreen.tsx # LLM config + UI settings
    └── types/
        └── global.d.ts        # ImportMeta type extension
```

## Shared Package Notes

The mobile app now resolves `@openbunny/shared` through workspace package exports. `pnpm dev:mobile` keeps `shared/dist` fresh by running the shared watch build alongside Expo.

`expo export` smoke validation now passes after bundling local mobile sound assets. The remaining Metro warning comes from the upstream `@ai-sdk/mcp` → `pkce-challenge` conditional export path on iOS and does not currently block bundling.

The following compatibility fixes were made to `@openbunny/shared` for React Native:

1. **src/i18n/index.ts**: Added `typeof localStorage !== 'undefined'` and `typeof navigator !== 'undefined'` guards
2. **src/utils/api.ts**: Wrapped `import.meta.env` in try-catch blocks
3. **src/hooks/useLLM.ts**: Wrapped `import.meta.env.DEV` in try-catch
4. **src/services/tools/loaders/builtin.ts**: Added `typeof localStorage !== 'undefined'` guard

These changes are backward-compatible and don't affect web/desktop functionality.
