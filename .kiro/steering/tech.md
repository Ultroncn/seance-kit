# Tech

- TypeScript strict. No `any` without a comment explaining why.
- pnpm workspaces. Use `pnpm --filter <pkg>` for per-package commands.
- React + Vite, Tailwind v4, Radix primitives, Motion for animation.
- zod defines every tool schema. JSON Schema and MCP tool definitions are derived, never hand-written.
- Storage goes through the `Storage` interface. Never call Dexie or IndexedDB directly from apps or tools.
- Search: MiniSearch. Email parsing: `postal-mime`.
- Providers sit behind `Provider`. API keys live only in IndexedDB and are only sent to the chosen endpoint. Never log keys or user content.
- Tools: names in snake_case, risk is one of `read | write | destructive`. Destructive tools soft-delete only and return an undo token.
- Prefer small pure functions for parsing and normalization so they are property-testable.
- Dependencies: add only when they save real work. Check license compatibility with MIT.
- Deploy: Cloudflare Workers static assets (`wrangler.jsonc`, `worker/index.js`). Output layout is `/`, `/archive/`, `/inbox/`. Do not use `_redirects` for SPA fallbacks: the platform rejects them (error 100324).
- Commits: small and conventional (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
