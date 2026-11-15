# Structure

```
.kiro/                 specs, steering, hooks, settings (committed)
apps/archive-seance/   app 1
apps/inbox-exorcist/   app 2
site/                  landing page (served at `/`), not part of apps/
packages/core/         agent loop, tool registry, approvals, events
packages/llm/          providers incl. Mock
packages/storage/      Storage interface + IndexedDB, memory, file adapters
packages/ui/           tokens, components, timeline, palette, DemoBadge
packages/mcp-server/   stdio MCP server over a registry
templates/app/         starter used by `pnpm new:app`
scripts/               repo scripts
```

`apps/` holds exactly the two app folders.

## Dependency rules

- `apps/*` may import `core`, `llm`, `storage`, `ui`.
- `site` imports only `ui`.
- `core` imports only the `Storage` interface type. No React, no DOM.
- `llm`, `storage`, `ui` do not import `core` internals.
- `mcp-server` imports `core` and `storage`.
- Apps never import from each other.
- Tools and importers for an app live inside that app folder.

## Conventions

- Each package has `src/`, `test/`, and a public `src/index.ts`. Import through the package name only.
- Fixtures go in `test/fixtures` and must be small and sanitized. No real personal data.
- One tool per file, named after the tool.
