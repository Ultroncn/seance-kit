# Structure

```
.kiro/                 specs, steering, hooks, settings (committed)
apps/archive-seance/   app 1
apps/inbox-exorcist/   app 2
site/                  landing page (served at `/`), not part of apps/
packages/core/         agent loop, tool registry, approvals, events, search, timeline reducer
packages/react/        React bindings for core (useAgentRun)
packages/llm/          providers incl. Mock
packages/storage/      Storage interface + IndexedDB, memory, file adapters
packages/ui/           tokens, components, timeline, palette, DemoBadge
packages/mcp-server/   stdio MCP server over a registry
templates/app/         starter used by `pnpm new:app` (a workspace package, so CI type-checks and tests it)
scripts/               repo scripts
worker/                Cloudflare Worker: per-app SPA fallback (JS, no build step)
```

`apps/` holds exactly the two app folders.

## Dependency rules

- `apps/*` may import `core`, `react`, `llm`, `storage`, `ui`.
- `react` imports `core`, `llm`, `storage`. It holds no UI. `ui` stays presentational and never imports `core` or `react`.
- `site` imports only `ui`.
- `core` imports the `Storage` interface type and the `Provider`/message types from `llm` (types only, plus `zod`). No React, no DOM.
- `llm`, `storage`, `ui` never import `core`. `llm` owns the provider and chat-message types.
- `ui` may import `llm` and `storage` (provider settings, `useProviderMode`, Settings dialog). `llm` may import `storage` types.
- `mcp-server` imports `core` and `storage`.
- Apps never import from each other.
- Tools and importers for an app live inside that app folder.

## Conventions

- Each package has `src/`, `test/`, and a public `src/index.ts`. Import through the package name only.
- Fixtures go in `test/fixtures` and must be small and sanitized. No real personal data.
- One tool per file, named after the tool.
