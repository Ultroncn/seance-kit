# Séance Kit: Requirements

Kiroween 2026, category **Skeleton Crew**. Solo entry. Repo: `Ultroncn/seance-kit`.
Submission target: **Dec 3, 2026** (deadline Dec 4, 2026, 2:00 PM PT).

## Product summary

Séance Kit is a local-first template for building AI agent workspaces. It ships with two apps built on it:

1. **Archive Séance**: import, search, summarize and "resurrect" old AI chat archives.
2. **Inbox Exorcist**: triage an email archive (`.mbox` / `.eml`) with an agent.

The edge over rivals is UI polish and a reusable, tested agent core. We do not build a dead-code tool.

## Glossary

- **Core**: `packages/core`, the agent loop, tool registry and approval gates.
- **Tool**: a typed function the agent may call, with a risk level of `read`, `write` or `destructive`.
- **Provider**: an LLM adapter (Anthropic, OpenAI-compatible, Ollama, Mock).
- **Mock provider**: a deterministic provider that replays scripted tool-call traces. Used for the live demo and tests.
- **Banish**: soft-delete. Items move to a recoverable "Banished" state.

## Requirements (EARS)

### R1. Repository and submission rules
1. The repository SHALL be public, contain a root `/.kiro` directory, and SHALL NOT list `.kiro` (or any file in it) in `.gitignore`.
2. The repository SHALL contain two separate app folders: `apps/archive-seance` and `apps/inbox-exorcist`.
3. The repository SHALL include an OSI-approved open-source license (MIT) at the root.
4. A working public app URL SHALL be served from Cloudflare (Workers static assets; first planned as Pages, see design.md section 12).
5. A demo video under 3:00 and a Kiro-usage write-up (`KIRO_USAGE.md`) SHALL exist before submission.
6. CI SHALL fail if `.kiro` is gitignored or missing.

### R2. Reusable agent core
1. The Core SHALL provide an agent loop that accepts a provider, a tool registry and a storage adapter.
2. WHEN a tool is registered, the registry SHALL require a zod input schema, a zod output schema, a description and a risk level.
3. WHEN the model requests a tool call, the Core SHALL validate the input against the schema before running it. Invalid input SHALL produce a typed error returned to the model, not a crash.
4. The agent loop SHALL enforce a configurable maximum step count and SHALL never exceed it.
5. WHEN a tool with risk `write` or `destructive` is requested, the Core SHALL pause and require explicit user approval before running it.
6. The Core SHALL emit a typed event stream (step started, tool called, tool result, approval requested, message, error) that any UI can render.
7. Destructive tools SHALL only soft-delete (Banish) and SHALL support undo.
8. The Core SHALL NOT contain app-specific code. App logic SHALL live in `apps/*`.

### R3. Providers and Demo mode
1. The system SHALL support these providers: Anthropic, OpenAI-compatible endpoint, Ollama, Mock.
2. API keys SHALL be stored only in the browser's IndexedDB and SHALL NOT be sent anywhere except the chosen provider endpoint.
3. The live demo SHALL default to the Mock provider with seeded data.
4. WHILE the Mock provider is active, the UI SHALL show a persistent, clearly visible "Demo mode" badge on every screen that runs the agent.
5. The user SHALL be able to switch to a real provider through a "bring your own key" settings panel. WHEN switched, the badge SHALL disappear.
6. The demo video SHALL show the real-provider path at least once.
7. The project SHALL NOT include a hosted LLM proxy.

### R4. Local-first storage
1. All user data SHALL be stored in IndexedDB through a `Storage` interface.
2. The `Storage` interface SHALL have IndexedDB, in-memory and file-backed implementations that pass one shared contract test suite.
3. The apps SHALL work offline after the first load for everything except real-provider calls.
4. The user SHALL be able to export and wipe all local data.
5. Full-text search SHALL run locally and the index SHALL persist across reloads.

### R5. Archive Séance
1. The app SHALL import ChatGPT `conversations.json`, Claude export JSON, and Markdown/plain-text chats.
2. Importing the same file twice SHALL NOT create duplicate conversations.
3. The user SHALL be able to search conversations by text, date range and source.
4. The agent SHALL have tools to: search, read a conversation, summarize, tag, Banish, and "resurrect" (start a new chat seeded with a conversation's context summary).
5. Summaries and tags produced by the agent SHALL be stored and shown with the conversation.
6. The app SHALL show the agent run as a séance timeline (see R7).

### R6. Inbox Exorcist
1. The app SHALL import `.mbox` and `.eml` files and parse them in the browser.
2. Importing the same message twice SHALL NOT create duplicates (keyed by Message-ID, with a content-hash fallback).
3. The agent SHALL have tools to: search, read a message, classify (for example needs-reply, newsletter, receipt, noise), draft a reply, label, and Banish.
4. The agent SHALL never send mail. Drafts are text only.
5. Bulk Banish SHALL require approval and show the list of affected messages.
6. The app SHALL ship with a seeded sample inbox.
7. Gmail OAuth is out of scope.

### R7. UI and design
1. Both apps SHALL use the shared `packages/ui` design system and one dark theme (neutral surfaces, one indigo accent; see `.kiro/steering/design-language.md`).
2. The apps SHALL be dark-theme only.
3. The agent run SHALL render as a séance timeline: each tool call is a step showing name, input, output, duration and approval state.
4. The apps SHALL provide a command palette (⌘K / Ctrl+K) and full keyboard navigation of primary flows.
5. WHEN `prefers-reduced-motion` is set, non-essential animation SHALL be disabled.
6. Automated axe checks SHALL report zero serious or critical violations on the landing page and each app's main screens.
7. Text contrast SHALL meet WCAG AA.

### R8. Landing page
1. The root page SHALL present the template story: "build your own agent app in an afternoon".
2. The root page SHALL link to both apps.
3. The root page SHALL include a visible Kiro-usage section (specs, steering, MCP) linking to `KIRO_USAGE.md`.
4. The root page SHALL link to the repo and the demo video.

### R9. MCP server
1. `packages/mcp-server` SHALL expose an app's tool registry over stdio MCP, backed by the file `Storage` adapter.
2. The repo's `.kiro/settings/mcp.json` SHALL register this server so Kiro can call the apps' tools.
3. Tools exposed over MCP SHALL come from the same registry definitions as the browser. There SHALL be no duplicate tool definitions.

### R10. Template
1. `templates/app` SHALL be a minimal working app that uses Core, Storage, LLM and UI.
2. `pnpm new:app <name>` SHALL copy the template into `apps/<name>` and the result SHALL build and pass tests without manual edits.
3. The README SHALL document the "afternoon" path in under ten steps.

### R11. Testing and CI
1. Unit and property-based tests (Vitest + fast-check) SHALL cover the properties listed in design.md.
2. Playwright SHALL run a smoke test on both apps and the landing page.
3. CI (GitHub Actions) SHALL run typecheck, lint, test and build on every push and pull request.
4. Cloudflare SHALL deploy `main` automatically from the GitHub repo.

### R12. Deployment first
1. The landing page and empty shells of both apps SHALL be deployed to Cloudflare on scaffolding day, before any app feature work.
2. Every later milestone SHALL end with a deployed build.

## Stretch goals (cut from scope, not planned)

- **MCP client** in the browser (remote Streamable HTTP servers).
- **Semantic search** with in-browser embeddings.
- **Light mode.**
- Gmail OAuth import.

These are documented only. No task in `tasks.md` depends on them.

## Non-goals

- Dead-code tooling of any kind.
- A backend, accounts, or any hosted LLM proxy.
- Sending email.
- Mobile-first layouts (desktop-first, responsive down to tablet).
