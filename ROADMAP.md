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

Status: In progress

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

Status: In progress

#### 2.1 Define explicit runtime dependencies for AI flows

- [x] Add a `RuntimeContext` / `AgentRuntimeContext` type in `shared`
- [ ] Pass agent, skill, MCP, timeout, and proxy dependencies into AI services
- [ ] Remove direct store reads from `services/ai/agent.ts`
- [ ] Remove direct store reads from `services/ai/mind.ts`
- [ ] Remove direct store reads from `services/ai/skills.ts`

#### 2.2 Centralize session orchestration

- [ ] Extract session/agent message persistence flows into app services or repositories
- [ ] Keep Zustand stores focused on state mutation and selectors
- [ ] Reuse the same orchestration layer from UI and non-UI clients

### Phase 3 — Tighten platform boundaries

Status: Planned

#### 3.1 Route environment access through platform context

- [ ] Replace `window`-based branching in `services/ai/provider.ts`
- [ ] Replace direct `localStorage` usage in `services/cron/index.ts`
- [ ] Review storage backends for a single initialization path per platform

#### 3.2 Normalize platform bootstrapping

- [ ] Create a shared bootstrap helper for React platforms
- [ ] Make platform initialization idempotent and easy to test
- [ ] Document required platform services for each client package

### Phase 4 — Package boundary hardening

Status: Planned

#### 4.1 Move workspace packages to built artifacts

- [ ] Build `@openbunny/shared` to `dist`
- [ ] Build `@openbunny/ui-web` to `dist`
- [ ] Update consumers to import compiled outputs instead of raw source
- [ ] Remove duplicated transitive dependency declarations where possible

#### 4.2 Add package contract checks

- [ ] Add typecheck/build verification for each package entrypoint
- [ ] Add a dependency-boundary rule or script for forbidden imports
- [ ] Ensure package exports reflect intended public APIs only

### Phase 5 — Test coverage for core flows

Status: Planned

- [ ] Add targeted tests around session orchestration and persistence
- [ ] Add targeted tests around AI runtime context assembly
- [ ] Add targeted tests around provider/proxy selection behavior
- [ ] Add targeted tests for platform initialization invariants

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

## Audit Notes

- Remaining same-name files such as `MessageList` and `ChatInput` are currently platform-specific and should not be force-merged.
- Shared extraction should focus on contracts, IDs, selectors, and runtime helpers rather than forcing identical component structures.
