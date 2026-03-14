# OpenBunny Architecture Roadmap

Last updated: 2026-03-13

## Goals

- Reduce hidden coupling between `shared` services, Zustand stores, and platform globals
- Turn `shared` into a reusable core layer across Web / Desktop / Mobile / CLI / TUI
- Shrink duplicated code paths before they spread further
- Make future refactors incremental, testable, and low-risk

## Principles

- Prefer explicit dependency injection over `*.getState()` inside core services
- Keep platform access behind the platform abstraction layer
- Keep stores focused on state, not orchestration-heavy business logic
- Land changes in small, reversible steps with tests or typecheck validation

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
- [x] Mark temporary exceptions where `shared` still touches platform globals or stores

### Phase 2 — Introduce runtime context

Status: Completed

#### 2.1 Define explicit runtime dependencies for AI flows

- [x] Add a `RuntimeContext` / `AgentRuntimeContext` type in `shared`
- [x] Pass agent, skill, MCP, timeout, and proxy dependencies into AI services
- [x] Remove direct store reads from `services/ai/agent.ts`
- [x] Remove direct store reads from `services/ai/mind.ts`
- [x] Remove direct store reads from `services/ai/skills.ts`

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
  - Progress: `ui-web`, `web`, `desktop`, `cli`, `tui`, and `mobile` now resolve `@openbunny/shared` through package contracts/artifacts; `mobile` startup prebuilds `shared` so Expo runtime can consume the workspace package exports instead of source aliases
- [x] Remove duplicated transitive dependency declarations where possible
  - Progress: `web` and `desktop` now resolve `@openbunny/shared` / `@openbunny/ui-web` through workspace package manifests during build, so their app manifests only keep direct dependencies (`@openbunny/*`, `react`, `react-dom`)

#### 4.2 Add package contract checks

- [x] Add typecheck/build verification for each package entrypoint
- [x] Add a dependency-boundary rule or script for forbidden imports
- [x] Ensure package exports reflect intended public APIs only

### Phase 5 — Test coverage for core flows

Status: Completed

- [x] Add targeted tests around session orchestration and persistence
- [x] Add targeted tests around AI runtime context assembly
- [x] Add targeted tests around provider/proxy selection behavior
- [x] Add targeted tests for platform initialization invariants

## Execution order

1. Finish Phase 1 duplicate cleanup and architecture notes
2. Introduce runtime context in AI services without behavior changes
3. Move platform branching behind abstractions
4. Compile workspace packages to artifacts
5. Backfill tests around the newly stabilized boundaries

## Current increment

This change set starts with the safest item in Phase 1:

- Consolidate duplicated `useAgentConfig` into `packages/shared/src/hooks/useAgentConfig.ts`
- Consolidate duplicated React bootstrap into `packages/ui-web/src/bootstrap.tsx`
- Introduce `services/ai/runtimeContext.ts` and thread optional runtime context through `agent`, `mind`, `skills`, and prompt assembly.
- Extend `chat.ts` to consume the new runtime context path for agent resolution and toolset assembly.
- Make `skills.ts` a pure runtime-context consumer, leaving fallback resolution outside the module.
- Make prompt assembly prefer runtime-context agent data so the `agent.ts` path stays store-free.
- Move `mind` session meta persistence behind `sessionOps` so `mind.ts` stays orchestration-only.
- Route `chat` session lookup/delete/chat-meta persistence through `sessionOps` to consolidate workspace session storage access.
- Extract shared session mutation helpers so `session.ts` and `agent.ts` reuse the same pure message/meta update paths.
- Extract shared session message persistence helpers so `load*/flush*` flows no longer duplicate storage normalization in both stores.
- Extract shared session/agent state helpers so trash cleanup, stream interruption, and agent rehydrate flows live outside the Zustand store bodies.
- Introduce an injectable `sessionOwnerStore` facade so `chat` and `mind` orchestration can run on Zustand today and alternate clients later via the same `sessionOps` surface.
- Move provider-specific proxy fetch selection into platform APIs so `services/ai/provider.ts` no longer branches on browser globals.
- Route cron persistence through platform storage so scheduled jobs restore consistently without `localStorage` checks in shared services.
- Centralize message/statistics backend registration in `initializePlatformStorage()` so browser, desktop, mobile, CLI, and TUI each use one explicit startup path.
- Expand `packages/ui-web/src/bootstrap.tsx` so web and desktop share the same platform-init + root-mount bootstrap entry.
- Add `initializePlatformRuntime()` so browser, desktop, mobile, CLI, and TUI platform init paths are idempotent, return their context, and can be reset in tests.
- Document each client package's required platform services so new entrypoints can wire `storage`, `fs`, `api`, `sound`, and settings hooks consistently.
- Add explicit `build` pipelines for `@openbunny/shared` and `@openbunny/ui-web`, emitting ESM artifacts to `dist` with rewritten relative imports for runtime consumption.
- Make `web` dev resolve `shared`/`ui-web` against source aliases while production builds resolve through workspace package exports to the compiled artifacts.
- Make `desktop` dev resolve `shared`/`ui-web` against source aliases while production builds resolve through workspace package exports to the compiled artifacts.
- Move `cli` and `tui` imports onto `@openbunny/shared` public subpaths and compile them with build-only `tsconfig` files that resolve against `shared/dist` instead of `shared/src`.
- Expand `@openbunny/shared` package exports for `version`, platform subpaths, and locale bundles so non-web consumers can stay on package contracts instead of filesystem aliases.
- Add `scripts/check-package-boundaries.mjs` and `scripts/verify-package-contracts.mjs` so the artifact-consuming packages keep their new boundaries under automated verification.
- Add `scripts/check-package-exports.mjs` and replace wildcard `exports` with explicit package contracts for `shared` and `ui-web`.
- Add `scripts/check-app-runtime-deps.mjs` so `web` and `desktop` keep lean runtime manifests instead of re-declaring `shared` / `ui-web` transitive dependencies.
- Add `sessionOps.test.ts` and `sessionPersistence.test.ts` to cover orchestration delegation, persistence forwarding, and interrupted-stream session recovery helpers.
- Add `runtimeContext.test.ts` to verify skill/MCP/session/agent runtime context assembly, default store fallbacks, and override precedence.
- Add `provider.test.ts` plus small dependency-injection seams in `provider.ts` to verify proxy fetch wiring, provider SDK branch selection, openai-compatible model resolution, and connection probe behavior.
- Add `packages/mobile/tsconfig.contract.json` and `typecheck:contracts` so the Expo client validates `@openbunny/shared` package contracts against `shared/dist`, then remove Metro/Babel source aliases so runtime resolution also flows through the workspace package exports.
- Add `scripts/check-mobile-runtime-contracts.mjs` so Expo config and startup scripts cannot silently drift back to raw-source resolution.
- Add `scripts/dev-mobile.mjs` plus `@openbunny/shared` watch mode so Expo development can keep package-artifact resolution without manual rebuild steps.

## Audit Notes

- Remaining same-name files such as `MessageList` and `ChatInput` are currently platform-specific and should not be force-merged.
- Shared extraction should focus on contracts, IDs, selectors, and runtime helpers rather than forcing identical component structures.
