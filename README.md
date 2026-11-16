# Séance Kit

A local-first template for building AI agent apps in an afternoon, plus two apps built with it.
Kiroween 2026 entry, category Skeleton Crew.

**Live demo:** https://seance-kit.mask988888888.workers.dev/

- **[Archive Séance](https://seance-kit.mask988888888.workers.dev/archive/)** (`apps/archive-seance`): import ChatGPT, Claude and Markdown chats, then search, summarize, tag, banish and resurrect them.
- **[Inbox Exorcist](https://seance-kit.mask988888888.workers.dev/inbox/)** (`apps/inbox-exorcist`): import `.mbox` / `.eml` mail, then sort, label, draft replies and banish newsletters. It can never send mail.
- **[UI kit](https://seance-kit.mask988888888.workers.dev/kit/)**: the shared components, live.

Your data stays in your browser (IndexedDB). There is no backend and no account. The demo runs on a scripted provider and shows a **Demo mode** badge while it does. Open Settings and add your own Anthropic, OpenAI-compatible or Ollama key to use a real model. The key is stored only in this browser and never exported.

## What the kit gives you

- **An agent loop** (`packages/core`) with a step budget, schema-validated tools, and an approval gate. Every tool that writes or hides data waits for your Allow.
- **Typed tools.** One zod schema per tool drives validation, the JSON Schema sent to models, and the MCP definition.
- **Soft deletes with undo** (Banish), local full-text search, and storage adapters for IndexedDB, memory and files.
- **A polished dark UI** (`packages/ui`): app shell, séance timeline, approval cards, ⌘K palette, settings, Demo badge. Reduced motion is respected, and axe checks run in CI.
- **Bring your own model, many vendors.** Save several providers (OpenAI, Anthropic, DeepSeek, Qwen, Doubao, SiliconFlow, OpenRouter, Ollama and more, or any compatible URL) and switch between them from the header, like CC Switch.
- **Several mailboxes in one inbox.** Import Gmail, Outlook, iCloud, QQ or 163 exports side by side; each mail remembers its mailbox, and a filter separates them.
- **English and Chinese** with a typed, dependency-free i18n layer. A missing translation is a type error.
- **An MCP server** (`packages/mcp-server`) that serves any app's tools to Kiro or another MCP client.
- **Property-based tests** (fast-check) for importers, storage, search, the agent loop and approvals.

## Build your own agent app in an afternoon

1. `pnpm install`
2. `pnpm new:app recipe-ghost` copies `templates/app` to `apps/recipe-ghost`.
3. `pnpm install` again to link the new app.
4. `pnpm --filter @seance/recipe-ghost dev` opens it at `http://localhost:5173/recipe-ghost/`.
5. Describe your data in `src/tools/shared.ts`.
6. Add tools, one file each. Each has a zod input, a zod output, and a risk of `read`, `write` or `destructive`. Register them in `src/tools/index.ts`.
7. Script two or three demo prompts in `src/demo/scripts.ts`, so the app works without a key.
8. Replace the content pane in `src/App.tsx` with your view of the data.
9. Keep `pnpm test` green. The template ships tests for its tools and scripts.

CI generates an app from the template on every push and checks that it installs, typechecks, passes its tests and builds.

## Use the apps from Kiro (MCP)

Copy `docs/kiro-mcp.json` to `.kiro/settings/mcp.json`. Kiro starts both servers on the sample data. Then ask, for example: _"Use archive-seance to find my Lisbon chats."_ Read tools are auto-approved, and Kiro asks before every change.

To use your own data, change the `--import` paths to a Séance export (Settings → Export all data) or a raw `conversations.json`, `.zip` or `.mbox`. Re-importing the same file adds nothing.

## Develop

Requires Node 20+ and pnpm 9.

```
pnpm install
pnpm --filter @seance/archive-seance dev   # or @seance/inbox-exorcist, @seance/site
pnpm typecheck && pnpm lint && pnpm test   # unit and property tests
pnpm build                                  # assembles dist/: /, /archive/, /inbox/, /kit/
pnpm e2e                                    # Playwright and axe against dist/
pnpm --filter @seance/archive-seance mcp -- --data .local-data/archive --import <file>
```

Deployed on Cloudflare Workers static assets (`wrangler.jsonc`). A small Worker (`worker/index.js`) gives each app its own SPA fallback.

## Repository

- `.kiro/`: the spec (requirements, design, tasks, submission plan) and steering docs. See `KIRO_USAGE.md` for how Kiro was used.
- `apps/`: the two apps. `templates/app`: the starter. `packages/`: core, react, llm, storage, ui, mcp-server. `site/`: landing page and UI kit.

## License

MIT
