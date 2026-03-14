# OpenBunny Architecture Roadmap

Last updated: 2026-03-15

## Status

This architecture refactor slice is near completion.

Most of the intended cleanup is already landed:

- `shared` AI flows now resolve through explicit runtime context and platform-registered adapters
- core AI service files no longer directly depend on Zustand store hooks
- Node / Web / Desktop / Mobile platform wiring is more explicit and less duplicated
- `ui-web` component-side store orchestration has been reduced to explicit action/selector usage
- package boundary, export, and targeted runtime checks are in place

## Remaining work

This slice should take about `1-2` more small iterations to close.

1. Final UI/app orchestration audit
   Focus on any remaining high-coupling `ui-web` or app-entry flows that still deserve extraction into explicit helpers or app services.
2. Full closeout verification
   Run the full workspace verification pass, fix any contract regressions, and then mark this slice complete.

## Done criteria

This slice is done when:

- no remaining high-signal architecture leaks are left in the current refactor scope
- app/platform wiring stays explicit without reintroducing hidden store coupling
- workspace verification passes cleanly for the stabilized package boundaries
