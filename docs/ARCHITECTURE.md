# OpenBunny Architecture Overview

Last updated: 2026-03-14

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
- Lazy-load heavy visualization and rich-rendering surfaces when possible

### 3. Shared App Layer

Package:

- `packages/shared`

Responsibilities:

- Domain types
- Zustand stores
- Core services for AI, skills, MCP, storage, filesystem, sound, stats, and i18n
- Platform abstraction interfaces and platform context
- Shared hooks and utilities that do not require a specific client package
- Public package contracts consumed from built artifacts by all other apps

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

These are the remaining architecture leaks worth tracking in the current slice.

### Rich syntax highlighting still ships many optional async language/theme chunks

Examples:

- `packages/ui-web/src/lib/shiki.ts`
- `scripts/vite-chunks.mjs`

Why this is temporary:

- Main entry bundles are now much smaller, and graph relayout no longer ships ELK at all
- Rich syntax highlighting is lazy-loaded and fine-grained, but some common languages still produce medium-sized optional async chunks when opened
- The remaining work is now optimization polish rather than a structural blocker

Planned fix:

- Keep bundle budgets enforced with `scripts/check-bundle-budgets.mjs`, including explicit ceilings for initial JS payload and Shiki `core` / `lang` / `theme` async chunks
- Further shrink or offload ELK/Shiki via lighter defaults, workerization, or narrower language/theme sets

### Mobile Expo development now runs through a single supervisor process

Examples:

- `packages/mobile/package.json`
- `packages/mobile/metro.config.js`
- `packages/mobile/tsconfig.contract.json`
- `scripts/dev-mobile.mjs`

Why this is now acceptable:

- Expo runtime still resolves `@openbunny/shared` through workspace package exports, so `shared/dist` must stay fresh during development
- Root `dev:mobile` now performs a single shared prebuild, starts Expo, and watches shared inputs to trigger rebuilds on demand instead of requiring a paired watch terminal
- Package contract alignment remains guarded by `typecheck:contracts`, `scripts/check-package-exports.mjs`, `scripts/check-app-runtime-deps.mjs`, and `scripts/check-mobile-runtime-contracts.mjs`

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
- Built-in AI tools receiving timeout, search, and exec settings through runtime context instead of reading Zustand or `localStorage` directly
- Default AI session-owner behavior being registered during platform init instead of being hard-coded inside runtime-context resolution
- Platform-owned external fetch policies for LLM providers, exposed through `IPlatformAPI.createExternalFetch()` instead of browser-global checks in shared services
- Platform-owned storage backend bootstrap via `initializePlatformStorage()` rather than per-service environment auto-detection
- App-owned sound settings injection so `packages/shared/src/services/sound/index.ts` stays store-agnostic while platforms wire live preferences
- Platform-owned i18n bootstrap so `packages/shared/src/i18n/index.ts` stays React- and browser-agnostic while DOM and React Native clients register their own bindings and initial language resolution
- Shared Vite chunk rules in `scripts/vite-chunks.mjs` so `web` and `desktop` split heavy dependencies consistently
- Bundle budget verification in `scripts/check-bundle-budgets.mjs` so main entry chunks stay bounded while heavy features remain async
- Lightweight first-render graph layout via `circleLayout()` with a built-in relaxation relayout helper only on explicit relayout

## Near-Term Refactor Priorities

1. Keep package and bundle contracts enforced in verification/CI
2. Continue trimming optional UI feature chunks where it is low-risk
