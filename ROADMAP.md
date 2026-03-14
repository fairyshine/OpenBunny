# OpenBunny Architecture Roadmap

Last updated: 2026-03-14

## Goals

- Reduce hidden coupling between `shared` services, Zustand stores, and platform globals
- Turn `shared` into a reusable core layer across Web / Desktop / Mobile / CLI / TUI
- Shrink duplicated code paths before they spread further
- Make future refactors incremental, testable, and low-risk
- Add packaging and bundle guardrails so architecture wins do not drift back

## Principles

- Prefer explicit dependency injection over `*.getState()` inside core services
- Keep platform access behind the platform abstraction layer
- Keep stores focused on state, not orchestration-heavy business logic
- Ship workspace packages through explicit package contracts and built artifacts
- Land changes in small, reversible steps with tests, typechecks, or build validation

## Roadmap

### Phase 1 — Stop architecture drift

Status: Completed

#### 1.1 Remove obvious duplicate implementations

- [x] Consolidate duplicated `useAgentConfig` hook into `shared`
- [x] Consolidate repeated React app bootstrap between `web` and `desktop`
- [x] Audit other near-identical hooks/helpers across `ui-web` and `mobile`
- [x] Consolidate shared sound effect identifiers across `ui-web` and `mobile`
- [x] Consolidate theme preference resolution helper across `ui-web` and `mobile`

#### 1.2 Document current boundaries

- [x] Write this roadmap
- [x] Add a short architecture overview describing current layers and intended dependencies
- [x] Mark temporary exceptions where `shared` still touches platform globals or store-backed adapters

### Phase 2 — Introduce runtime context

Status: Completed

#### 2.1 Define explicit runtime dependencies for AI flows

- [x] Add a `RuntimeContext` / `AgentRuntimeContext` type in `shared`
- [x] Pass agent, skill, MCP, timeout, and proxy dependencies into AI services
- [x] Remove direct store reads from the main AI execution paths in `agent.ts`, `mind.ts`, and `skills.ts`

#### 2.2 Centralize session orchestration

- [x] Extract session/agent message persistence flows into app services or repositories
- [x] Keep Zustand stores focused on state mutation and selectors
- [x] Reuse the same orchestration layer from UI and non-UI clients

### Phase 3 — Tighten platform boundaries

Status: Completed

#### 3.1 Route environment access through platform context

- [x] Replace `window`-based branching in `services/ai/provider.ts`
- [x] Replace direct `localStorage` usage in `services/cron/index.ts`
- [x] Review storage backends for a single initialization path per platform

#### 3.2 Normalize platform bootstrapping

- [x] Create a shared bootstrap helper for React platforms
- [x] Make platform initialization idempotent and easy to test
- [x] Document required platform services for each client package

### Phase 4 — Package boundary hardening

Status: Completed

#### 4.1 Move workspace packages to built artifacts

- [x] Build `@openbunny/shared` to `dist`
- [x] Build `@openbunny/ui-web` to `dist`
- [x] Update consumers to import compiled outputs instead of raw source
- [x] Remove duplicated transitive dependency declarations where possible
- [x] Align mobile runtime resolution with public package exports instead of `shared/src` aliases

#### 4.2 Add package contract checks

- [x] Add typecheck/build verification for each package entrypoint
- [x] Add a dependency-boundary rule or script for forbidden imports
- [x] Ensure package exports reflect intended public APIs only
- [x] Add dedicated mobile runtime contract checks for Expo config and startup flow

### Phase 5 — Test coverage for core flows

Status: Completed

- [x] Add targeted tests around session orchestration and persistence
- [x] Add targeted tests around AI runtime context assembly
- [x] Add targeted tests around provider/proxy selection behavior
- [x] Add targeted tests for platform initialization invariants

### Phase 6 — Runtime performance guardrails

Status: Completed

- [x] Share Vite manual chunk rules across `web` and `desktop`
- [x] Lazy-load heavy markdown/code-highlighting paths through `LazyShikiCodeBlock`
- [x] Lazy-load the agent graph surface and keep ELK behind a dynamic import
- [x] Use lightweight `circleLayout()` for first graph render when saved positions are absent
- [x] Reserve ELK auto-layout for explicit user-triggered relayouts
- [x] Add bundle budget checks for `web` and `desktop` entry chunks plus required async heavy chunks
- [x] Reduce remaining large async chunks such as `vendor-elk` and `vendor-shiki`
- [x] Improve Expo package-artifact development ergonomics so mobile no longer depends on a paired watch process

### Phase 7 — Isolate i18n bootstrap

Status: Completed

- [x] Remove React/browser-specific i18n bootstrap work from `@openbunny/shared`
- [x] Move initial language resolution to DOM and React Native platform bootstrap code
- [x] Reuse the same shared i18n resources and singleton across `ui-web` and `mobile`
- [x] Add tests and boundary checks so `shared` does not regress back to `react-i18next` or browser detector imports

## Execution order

1. Stop duplication and document intended boundaries
2. Introduce runtime context without behavior changes
3. Move platform branching behind abstractions
4. Compile workspace packages to artifacts and enforce public contracts
5. Backfill tests around the stabilized boundaries
6. Add build-time and bundle-time guardrails for performance-sensitive surfaces
7. Keep shared singletons platform-agnostic and register UI/runtime bindings at bootstrap time

## Current increment

This roadmap slice now includes the following completed work:

- Consolidate duplicated React/bootstrap/theme/sound helpers into shared entrypoints
- Introduce `services/ai/runtimeContext.ts` and thread runtime dependencies through AI execution paths
- Route session persistence and orchestration through `packages/shared/src/services/ai/sessionOps.ts`
- Move shared sound playback settings behind an app-injected resolver so `services/sound` no longer reads Zustand directly
- Move `services/ai/tools.ts` to injected runtime settings so built-in tools no longer read Zustand or `localStorage` directly
- Move default `sessionOwnerStore` selection behind an injected resolver so runtime context no longer hard-codes the Zustand adapter
- Move remaining AI runtime defaults behind `services/ai/runtimeDefaults.ts` so `runtimeContext.ts` resolves from an injected adapter instead of importing stores directly
- Normalize platform initialization with `initializePlatformRuntime()` and `initializePlatformStorage()`
- Build `@openbunny/shared` and `@openbunny/ui-web` as consumable package artifacts with explicit exports
- Move `cli`, `tui`, `web`, `desktop`, and `mobile` imports onto public `@openbunny/shared/*` contracts
- Add `scripts/check-package-boundaries.mjs`, `scripts/check-package-exports.mjs`, `scripts/check-app-runtime-deps.mjs`, and `scripts/check-mobile-runtime-contracts.mjs`
- Add `scripts/dev-mobile.mjs` plus `@openbunny/shared` watch mode so Expo can develop against package artifacts
- Replace the parallel `@openbunny/shared` watch worker in `scripts/dev-mobile.mjs` with a single-process supervisor that prebuilds once, watches shared inputs, and rebuilds on demand while Expo keeps running
- Add placeholder mobile sound assets and static native sound loading so `expo export` succeeds
- Trim MCP-heavy imports from shared/mobile entry paths and lazy-load MCP connection setup where appropriate
- Remove `react-i18next` and browser language detection from `@openbunny/shared/i18n`, leaving shared with a platform-agnostic singleton initializer
- Move DOM language resolution into `packages/ui-web/src/platform/i18n.ts` and reuse the same shared initializer from `packages/mobile/src/platform/i18n.ts`
- Add `packages/shared/src/i18n/index.test.ts` plus a boundary rule preventing `packages/shared/src` from importing `react-i18next` or `i18next-browser-languagedetector`
- Share Vite chunk strategy through `scripts/vite-chunks.mjs` for `web` and `desktop`
- Lazy-load Shiki rendering and the agent graph surface so the main `index-*.js` bundle stays materially smaller
- Split Shiki into finer async `core` / `langs` / `themes` chunks with the JavaScript regex engine so opening code blocks no longer pulls the full bundled payload at once
- Tighten `scripts/check-bundle-budgets.mjs` so initial JS payload plus Shiki `core` / `lang` / `theme` async chunks each stay under explicit size ceilings instead of only checking that they exist
- Replace ELK-based manual relayout with a lightweight built-in graph relaxation helper so graph editing no longer ships any ELK runtime or worker payload
- Change `packages/ui-web/src/components/agent-graph/AgentGraphDialog.tsx` to default to `circleLayout()` on first render and use a lightweight built-in relayout helper only on explicit user action
- Add `scripts/check-bundle-budgets.mjs` and wire it into `verify:packages` to keep `web`/`desktop` entry bundles, initial JS payload, and async heavy chunks under contract
- Rename `packages/desktop/postcss.config.mjs` to native ESM config naming so Vite builds stay warning-free

## Audit Notes

- Remaining same-name files such as `MessageList` and `ChatInput` are still platform-specific and should not be force-merged.
- Shared extraction should focus on contracts, IDs, selectors, runtime helpers, and platform seams rather than forcing identical component structures.
- The ELK payload has been removed from graph relayout entirely; the next performance work is now about incremental UI polish and keeping bundle contracts from regressing.
- Shared i18n now expects platform-owned bootstrap to provide environment-specific language resolution or UI bindings instead of reading browser globals directly.
