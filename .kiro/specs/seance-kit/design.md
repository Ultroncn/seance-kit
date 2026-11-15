# Séance Kit: Design

## 1. Decisions

| Area | Decision |
|---|---|
| Language | TypeScript (strict) |
| Package manager | pnpm workspaces |
| UI | React + Vite, Tailwind v4, Radix primitives, Motion |
| Validation | zod (one schema feeds validation, LLM JSON Schema and MCP) |
| Storage | Dexie over IndexedDB, behind a `Storage` interface |
| Search | MiniSearch, persisted to IndexedDB |
| Email parsing | `postal-mime` (browser), custom streaming mbox splitter |
| Tests | Vitest, fast-check, fake-indexeddb, Playwright, axe-core |
| Hosting | Cloudflare Pages, one origin, static only |
| CI | GitHub Actions |
| License | MIT |

## 2. Monorepo layout

```
.kiro/
  specs/seance-kit/        requirements.md, design.md, tasks.md, submission.md
  steering/                product, tech, structure, design-language, testing
  hooks/                   on-save checks
  settings/mcp.json        registers packages/mcp-server
apps/
  archive-seance/
  inbox-exorcist/
site/                      landing page (template story, app links, Kiro usage)
packages/
  core/                    agent loop, tool registry, approvals, events
  llm/                     Anthropic, OpenAI-compatible, Ollama, Mock
  storage/                 Storage interface + IndexedDB, memory, file adapters
  ui/                      tokens, components, timeline, palette
  mcp-server/              stdio MCP server over a registry
templates/app/             starter copied by `pnpm new:app`
scripts/                   build-all, serve-dist, new-app, check-kiro-not-ignored
worker/                    Cloudflare Worker: per-app SPA fallback
wrangler.jsonc             Cloudflare deploy config
LICENSE  README.md  KIRO_USAGE.md
```

The landing page lives in `site/`, outside `apps/`, so `apps/` holds exactly the two app folders the rules require (decided, formerly OQ1).

Dependency direction: `apps/* -> ui, core, llm, storage`. `site -> ui` only. `core -> storage (interface only), llm (types only)`. `llm`, `storage` and `ui` never import `core`; `llm` owns the provider and chat-message types, so core can type the loop without a cycle. `mcp-server -> core, storage`.

## 3. Core

### Tool definition

```ts
type Risk = "read" | "write" | "destructive";

interface Tool<I, O> {
  name: string;               // snake_case, unique
  description: string;
  input: z.ZodType<I>;
  output: z.ZodType<O>;
  risk: Risk;
  run(input: I, ctx: ToolContext): Promise<O>;
}

interface ToolContext { storage: Storage; signal: AbortSignal; now(): Date; }
```

`ToolRegistry` has `register`, `get`, `list`, `toJsonSchema()` (for providers) and `toMcpTools()` (for the MCP server). Registering a duplicate name throws.

### Agent loop

```
run(userMessage):
  steps = 0
  loop:
    reply = provider.complete(history, registry.toJsonSchema())
    if reply has no tool calls: emit message; stop
    for call in reply.toolCalls:
      if ++steps > maxSteps: emit error(StepBudget); stop
      parsed = tool.input.safeParse(call.input)
      if !parsed.success: return typed ToolInputError to model; continue
      if tool.risk != "read": emit approvalRequested; await decision
        if rejected: return ToolRejected to model; continue
      result = tool.run(parsed.data); validate against tool.output; emit toolResult
```

Events: `stepStarted | toolCalled | approvalRequested | toolResult | message | error`. The UI subscribes to the stream. The loop never touches the DOM.

Undo: destructive tools return an `undoToken`. `core.undo(token)` restores the item. Tools Banish items by setting `banishedAt`. No hard delete exists in tool code. Only the user-initiated "wipe all data" does a hard delete.

## 4. LLM providers

`Provider.complete({ messages, tools, system, signal }) -> Promise<{ text, toolCalls }>`. Responses are not streamed in v1 (decided in M1 to keep the loop and Mock simple). Streaming is a possible later addition.

- **Anthropic** and **OpenAI-compatible**: direct browser `fetch` using the user's key. Anthropic needs its browser-access header.
- **Ollama**: `http://localhost:11434`, no key. The user must allow the page origin (`OLLAMA_ORIGINS`). The settings panel explains this.
- **Mock**: takes a script `[{ match, toolCalls?, text }]` and replays it deterministically. Seeded scripts exist per app. Unknown prompts get a polite "Demo mode only knows these prompts" reply with suggestion chips.

### Demo mode honesty

A `useProviderMode()` hook exposes `isMock`. The shared `<DemoBadge/>` in `packages/ui` renders in the app header whenever `isMock` is true. Playwright asserts the badge is present with Mock and absent with a fake real provider. The badge is not dismissible.

## 5. Storage

```ts
interface Storage {
  put<T>(collection: string, item: T & { id: string }): Promise<void>;
  get<T>(collection: string, id: string): Promise<T | undefined>;
  list<T>(collection: string, opts?: ListOpts): Promise<T[]>;
  remove(collection: string, id: string): Promise<void>;   // hard delete, not used by tools
  exportAll(): Promise<Blob>;
  wipe(): Promise<void>;
}
```

Adapters: `IndexedDbStorage` (Dexie), `MemoryStorage`, `FileStorage` (JSON files, Node, used by the MCP server). One contract suite runs against all three.

Collections: `conversations`, `messages`, `emails`, `tags`, `summaries`, `drafts`, `settings`, `searchIndex`.

Search: MiniSearch index rebuilt from storage on first load, then serialized to `searchIndex` after changes (debounced).

## 6. Importers (apps own them, core does not)

Each importer is a pure function `parse(input: string | ArrayBuffer) -> NormalizedItem[]` plus a stable `id` function.

- **ChatGPT**: walk the `mapping` tree of `conversations.json` in `current_node` order. Id = conversation `id`.
- **Claude**: `chat_messages` arrays. Id = conversation `uuid`.
- **Markdown/text**: split on `## User` / `## Assistant` style headings or `Role:` prefixes. Id = content hash.
- **mbox**: split on `From ` separator lines (handle `>From ` escaping), then `postal-mime` per message. Id = `Message-ID`, fallback hash of headers + body.
- **eml**: one message per file, same id rule.

Large files are read in chunks and imported in batches so the UI stays responsive. A progress event stream feeds a progress bar.

## 7. Archive Séance tools

| Tool | Risk |
|---|---|
| `search_conversations` | read |
| `read_conversation` | read |
| `summarize_conversation` | write (stores summary) |
| `tag_conversation` | write |
| `banish_conversation` | destructive |
| `resurrect_conversation` | write (creates a seeded new chat) |

## 8. Inbox Exorcist tools

| Tool | Risk |
|---|---|
| `search_emails` | read |
| `read_email` | read |
| `classify_email` | write |
| `draft_reply` | write (stores text, never sends) |
| `label_email` | write |
| `banish_emails` (bulk) | destructive |

## 9. MCP server

`packages/mcp-server` takes an app's registry module and a data directory, then serves it over stdio using the official MCP TypeScript SDK. Tools come from `registry.toMcpTools()`. Risky tools over MCP rely on the MCP client's own approval prompt (Kiro asks before running). `.kiro/settings/mcp.json` points at `pnpm --filter mcp-server start -- --app archive-seance --data ./.local-data`. The apps' "Export" action writes a file this server can read.

## 10. UI and visual direction

- **Palette** (dark only): background `#0B0A10`, surface `#14121C`, raised `#1D1A28`, border `#2A2638`, text `#E8E6F0`, muted `#9A96AD`, ectoplasm accent `#7CF2B6`, candle amber `#F2B35E` (approvals), blood `#E5636F` (destructive). All text pairs verified at AA or better. Exact values are tokens in `packages/ui`, so changing them in one place is enough.
- **Type**: a humanist sans for UI and a monospace for tool I/O, both self-hosted.
- **Signature**: the séance timeline. A vertical line with candle-glow nodes. Steps fade in. A pending approval pulses amber (static ring under reduced motion).
- **Layout**: three panes (library, conversation or message, agent). The command palette reaches every action.
- **Motion**: short (under 200 ms) and purposeful. No decorative loops.
- **Copy**: lightly spooky labels ("Resurrect", "Banish") over plain descriptions in tooltips. Never at the cost of clarity.

## 11. Landing page (`site/`)

Sections in order: hero (template story), "How an app is built" (tool registry in 3 code steps), two app cards with links, **Built with Kiro** (specs, steering, hooks, MCP, with links to `KIRO_USAGE.md` and `.kiro/`), demo video embed, footer (repo, license). Static, no JS framework needed beyond Vite + React for consistency with `packages/ui`.

## 12. Deployment

Cloudflare Workers static assets (the Cloudflare dashboard's unified Worker/Pages flow), one project named `seance-kit`, configured by `wrangler.jsonc` and deployed with `npx wrangler deploy`. A build script produces `dist/` with:

```
/            landing
/archive/    archive-seance (Vite base "/archive/")
/inbox/      inbox-exorcist (Vite base "/inbox/")
```

Per-app SPA fallback lives in `worker/index.js`, not in `_redirects`. The Worker serves assets first (`env.ASSETS.fetch`). On a 404 for a GET/HEAD navigation under `/archive/` or `/inbox/` (and not a file-like path such as `.js`), it returns that app's own `index.html`. Unknown root URLs and missing files still return 404.

**Decision record (Nov 16-17, 2026).** The first deploy failed with Cloudflare API error 100324 ("Infinite loop detected in this rule") on `/archive/* /archive/index.html 200` and `/inbox/* /inbox/index.html 200`. Workers static assets rejects wildcard 200 rewrites whose destination re-matches the source (see cloudflare/workers-sdk#11824 and #11904). We rejected `assets.not_found_handling = "single-page-application"` because it falls back only to the root `index.html`, so `/archive/` deep links would show the landing page. `build-all.mjs` therefore emits no `_redirects`, and `wrangler.jsonc` sets `main` and `assets.binding = "ASSETS"`.

GitHub Actions runs checks. Cloudflare's Git integration builds and deploys `main` (build command `pnpm install --frozen-lockfile && pnpm build`, deploy command `npx wrangler deploy`). Deployment is proven on day one (task group 0).

## 13. Testing

### Property-based (fast-check)

| ID | Property |
|---|---|
| P1 | For any normalized conversation, `serialize(parse(x))` round-trips for each importer format. |
| P2 | `normalize` is idempotent: `normalize(normalize(x)) = normalize(x)`. |
| P3 | Importing a file N times yields the same stored set as importing once. |
| P4 | For any message set, the mbox splitter returns the same message count as the generator produced, including bodies with `From ` lines. |
| P5 | The Storage contract holds on IndexedDB (fake-indexeddb), Memory and File adapters. After `put(x)`, `get(x.id)` equals `x`. After `wipe`, `list` is empty. |
| P6 | MiniSearch results for any query are a subset of, and contain, the brute-force substring oracle matches for exact-token queries. |
| P7 | For any generated tool input, the registry either runs the tool or returns a typed validation error. It never throws. |
| P8 | For any Mock script and `maxSteps`, executed tool calls never exceed `maxSteps`. |
| P9 | For any generated call sequence, no non-read tool runs without a recorded approval. |
| P10 | `banish` then `undo` restores the original item. Banished items never appear in default search. |
| P11 | `toMcpTools()` and `toJsonSchema()` list exactly the registered tools with matching names. |

### Other layers

- Unit tests for importers using fixture exports (small, sanitized).
- Playwright: landing, archive and inbox smoke paths (import sample, run a Mock prompt, approve a step, see timeline). Includes Demo-badge assertions.
- axe-core on every smoke path.
- A CI script verifies `.kiro` exists and is not gitignored.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Solo, 18 days | Cut list is final. Weekly milestones, each deployed. Buffer day Dec 2. |
| Export formats change | Parsers are tolerant, fixtures cover current shapes, unknown fields are ignored. |
| Large mbox files freeze the tab | Chunked reads, batched writes, a worker for parsing if profiling shows need. |
| Browser CORS to providers | Anthropic and OpenAI allow browser calls with the right header. Ollama needs `OLLAMA_ORIGINS`, documented. Fallback is the Mock provider. |
| Mock demo looks fake | Honest badge, plus the real-provider path shown in the video. |
| Template claim is hollow | `pnpm new:app` is tested in CI by generating an app and building it. |

## 15. Open questions

None. OQ1 (landing location) is resolved: `site/`.
