# OpenBunny Architecture Overview

Last updated: 2026-03-13

## Goals

This document describes the current package layering, the intended dependency directions, and the temporary exceptions that still need cleanup.

It is intentionally short: it should help contributors answer three questions quickly:

1. Where should new code go?
2. Which layers are allowed to depend on which?
3. Which current violations are temporary and already scheduled for cleanup?

## Package Layers

### 1. App Entrypoints

Packages:

- `packages/web`
- `packages/desktop`
- `packages/mobile`
- `packages/cli`
- `packages/tui`
- `worker`

Responsibilities:

- Initialize platform context
- Wire platform-specific storage / filesystem / sound / fetch behavior
- Start the UI or command runtime
- Keep platform-only APIs out of reusable core logic

### 2. UI Layer

Package:

- `packages/ui-web`

Responsibilities:

- Shared React UI for browser-like clients
- Presentational components, keyboard shortcuts, theming, rendering bootstrap
- UI-only hooks that compose store state for React screens

### 3. Shared App Layer

Package:

- `packages/shared`

Responsibilities:

- Domain types
- Zustand stores
- Core services for AI, skills, MCP, storage, filesystem, sound, stats, i18n
- Platform abstraction interfaces and platform context
- Shared hooks and utilities that do not require a specific client package

### 4. Edge Proxy

Package:

- `worker`

Responsibilities:

- CORS proxy and health endpoint for browser-based provider access
- Must stay isolated from UI and local persistence concerns

## Intended Dependency Directions

The preferred dependency graph is:

```text
app entrypoints -> ui-web -> shared
app entrypoints ------------> shared
worker (isolated)
```

Rules:

- `shared` must not depend on `ui-web`, app entrypoints, or `worker`
- `ui-web` may depend on `shared`, but not on app entrypoints
- App entrypoints may depend on `shared` and `ui-web`
- `worker` should remain independent from the client packages

## Placement Guide

Use this guide when adding code:

- Put platform bootstrapping in the app package for that platform
- Put reusable React rendering helpers in `ui-web`
- Put domain logic, storage abstractions, and cross-platform services in `shared`
- Put browser/Electron/mobile-only API calls behind the platform abstraction layer
- Put one-off deployment or proxy logic in `worker`

## Current Temporary Exceptions

These are known architecture leaks. They work today, but should be treated as cleanup targets rather than patterns to copy.

### `shared` directly reads Zustand stores inside core services

Examples:

- `packages/shared/src/services/ai/agent.ts`
- `packages/shared/src/services/ai/mind.ts`
- `packages/shared/src/services/ai/skills.ts`

Why this is temporary:

- It hides runtime dependencies inside core services
- It makes CLI / TUI / mobile reuse harder to reason about
- It makes testing and future extraction harder

Planned fix:

- Introduce an explicit runtime context and dependency injection for AI flows

### `shared` directly branches on browser globals

Examples:

- `packages/shared/src/services/ai/provider.ts`
- `packages/shared/src/services/cron/index.ts`
- `packages/shared/src/services/storage/messageStorage.ts`
- `packages/shared/src/services/storage/statsStorage.ts`

Why this is temporary:

- It bypasses the platform abstraction layer
- It scatters environment checks across services
- It increases the chance of browser-only assumptions leaking into other clients

Planned fix:

- Move environment decisions behind `getPlatformContext()` and explicit backend registration

### Workspace packages are consumed as source, not artifacts

Examples:

- `packages/shared/package.json`
- `packages/ui-web/package.json`

Why this is temporary:

- Consumers must redeclare transitive dependencies from source imports
- Package boundaries are softer than they look
- Build behavior depends on Vite aliasing and workspace layout details

Planned fix:

- Build `shared` and `ui-web` as artifacts and consume `dist` outputs
- Migration is now in progress: `web`, `desktop`, `cli`, and `tui` build against package artifacts, while `mobile` still uses source-level aliases pending follow-up cleanup

## Platform Service Contracts

Each client package should treat platform initialization as the place where required services are wired once.

### `packages/web`

Required services:

- `storage`: browser `localStorage` adapter for persisted Zustand state
- `api.fetch`: browser `fetch`
- `api.createExternalFetch`: browser-specific LLM proxy routing for localhost / Worker proxy
- `sound`: `WebSoundBackend`
- settings handlers: theme + language callbacks
- storage bootstrap: `initializePlatformStorage()` for IndexedDB-backed message/stats persistence

Optional services:

- `fs`: none

### `packages/desktop`

Required services:

- `storage`: renderer-side persisted storage adapter
- `fs`: Electron preload filesystem bridge
- `api.fetch`: renderer `fetch`
- `sound`: `WebSoundBackend`
- settings handlers: theme + language callbacks
- storage bootstrap: `initializePlatformStorage()` for IndexedDB-backed message/stats persistence

Optional services:

- `api.createExternalFetch`: not required because desktop can call providers directly

### `packages/mobile`

Required services:

- `storage`: AsyncStorage-backed adapter
- `fs`: native filesystem adapter
- `api.fetch`: React Native `fetch`
- `sound`: `MobileSoundBackend`
- settings handlers: language callback and theme no-op hook
- storage bootstrap: `initializePlatformStorage({ messageBackend, statsBackend })` with SQLite backends
- filesystem bootstrap: `setFileSystemInstance(mobileFileSystem)`

Optional services:

- `api.createExternalFetch`: not required today

### `packages/cli`

Required services:

- `storage`: injected `Conf` adapter
- `api.fetch`: Node `fetch`
- storage bootstrap: `initializePlatformStorage()` using no-op message/stats backends unless a node backend is introduced later

Optional services:

- `fs`: none today
- `sound`: none today
- settings handlers: none today

### `packages/tui`

Required services:

- `storage`: injected `Conf` adapter
- `api.fetch`: Node `fetch`
- storage bootstrap: `initializePlatformStorage()` using no-op message/stats backends unless a node backend is introduced later

Optional services:

- `fs`: none today
- `sound`: none today
- settings handlers: none today

### `worker`

- Does not consume the shared platform context
- Should stay isolated from client-side storage, sound, and filesystem contracts

## Current Good Patterns

These are safe patterns to continue:

- Platform initialization in entry packages before rendering or command startup, routed through idempotent initializers
- Re-exporting shared hooks or helpers instead of duplicating implementations
- Small cross-platform utilities living in `shared/src/utils`
- Shared React bootstrap utilities living in `ui-web`, including the common DOM app bootstrap used by `web` and `desktop`
- AI session orchestration flowing through `packages/shared/src/services/ai/sessionOps.ts` with an injectable `sessionOwnerStore` adapter
- Platform-owned external fetch policies for LLM providers, exposed through `IPlatformAPI.createExternalFetch()` instead of browser-global checks in shared services
- Platform-owned storage backend bootstrap via `initializePlatformStorage()` rather than per-service environment auto-detection

## Near-Term Refactor Priorities

1. Finish removing low-risk duplicate hooks and helpers
2. Introduce runtime context for AI services
3. Move platform branching behind platform abstractions
4. Harden package boundaries by shipping built artifacts
5. Add tests around the new boundaries
