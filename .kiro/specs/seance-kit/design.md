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
| Hosting | Cloudflare Workers static assets, one origin, static files plus a small SPA-fallback Worker |
| CI | GitHub Actions |
| License | MIT |

## 2. Monorepo layout

```
.kiro/
  specs/seance-kit/        requirements.md, design.md, tasks.md, submission.md
  steering/                product, tech, structure, design-language, testing
apps/
  archive-seance/
  inbox-exorcist/
site/                      landing page at / and the UI-kit gallery at /kit/
packages/
  core/                    agent loop, tool registry, approvals, events, search, timeline reducer
  react/                   React bindings for core: useAgentRun (events → timeline, approvals, undo)
  llm/                     Anthropic, OpenAI-compatible, Ollama, Mock
  storage/                 Storage interface + IndexedDB, memory, file adapters
  ui/                      tokens, components, timeline, palette
  mcp-server/              stdio MCP server over a registry
templates/app/             starter copied by `pnpm new:app`
scripts/                   build-all, serve-dist, new-app, check-kiro-not-ignored
worker/                    Cloudflare Worker: per-app SPA fallback
wrangler.jsonc             Cloudflare deploy config
docs/kiro-mcp.json         Portable example, also tracked at .kiro/settings/mcp.json
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

`<ProviderModeProvider>` in `packages/ui` loads saved settings and exposes `useProviderMode()`: `{ provider, isMock, config, save, ... }`. `isMock` is read from the `provider` object itself, and the agent must take its provider from the same hook, so the badge cannot disagree with what actually runs. `<DemoBadge/>` renders in the app header whenever `isMock` is true. It is not dismissible, and clicking it opens Settings. Playwright asserts the badge is present with Mock, absent after saving a (fake, routed) real provider, still absent after reload, and back after returning to Demo. A mutation check (badge ignoring `isMock`) fails those tests.

### Settings and secrets

The Settings dialog picks Demo, Anthropic, OpenAI-compatible or Ollama, and offers Test connection (one tiny request, not saved) so a user can verify a real provider with their own key. The config, including the key, is stored in the reserved `secrets` collection. Every Storage adapter excludes `secrets` from `exportAll` (contract-tested), and `parseExportFile` rejects files that contain it. Export and Delete-all-data live in the same dialog. Delete needs a second confirming click. Each app uses its own IndexedDB database (`archive-seance`, `inbox-exorcist`) because both share one origin.

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

Collections: `conversations`, `messages`, `emails`, `tags`, `summaries`, `drafts`, `searchIndex`, `banish_log`, and the reserved `secrets` (never exported).

Search: MiniSearch index rebuilt from storage on first load, then serialized to `searchIndex` after changes (debounced). Terms are lower-cased and accent-folded ("pasteis" finds "pastéis"). A saved index is reused only when every item's revision (`rev` for conversations) and the `schemaVersion` still match. Apps can index derived text through `extract` (Archive indexes the joined messages).

## 6. Importers (apps own them, core does not)

Each importer is a pure function `parse(input: string | ArrayBuffer) -> NormalizedItem[]` plus a stable `id` function.

- **ChatGPT**: walk the `mapping` tree of `conversations.json` in `current_node` order. Id = conversation `id`.
- **Claude**: `chat_messages` arrays. Id = conversation `uuid`.
- **Markdown/text**: split on `## User` / `## Assistant` style headings or `Role:` prefixes. Id = content hash.
- **mbox**: split on `From ` separator lines (handle `>From ` escaping), then `postal-mime` per message. Id = `Message-ID`, fallback hash of headers + body.
- **eml**: one message per file, same id rule.

Large files are read in chunks and imported in batches so the UI stays responsive. A progress event stream feeds a progress bar.

## 7. Archive Séance

**Data.** One `conversations` record per chat: id `${source}:${sourceId}`, imported content (title, dates, messages), plus what the user and agent add (tags, summary, banishedAt). `rev` is bumped on every write. Re-importing a newer export of the same chat replaces content and keeps annotations. `resurrections` stores generated prompts.

**Import.** `parseFile` accepts ChatGPT or Claude `conversations.json`, the export `.zip` (read in the browser with fflate), and Markdown or text. Bad items are skipped with a reason and shown in the import report. `toMarkdown` is the exact inverse of `parseMarkdown` (P1), escaping marker-like lines.

**Demo.** A fictional 12-chat sample archive in real export formats (`public/sample/`, generated by `scripts/make-sample.mjs`) is loaded through the same importer. Five Mock scripts call the real tools on the real data. Only the wording is scripted, and a test runs every script end to end.

### Tools

| Tool | Risk |
|---|---|
| `search_conversations` | read |
| `read_conversation` | read |
| `summarize_conversation` | write (stores summary) |
| `tag_conversation` | write |
| `banish_conversation` | destructive |
| `resurrect_conversation` | write (creates a seeded new chat) |

## 8. Inbox Exorcist

**Import.** `readEmails` streams a `.mbox` (Google Takeout, Thunderbird, Apple Mail) chunk by chunk through `MboxSplitter`, so large exports never sit in memory at once. The splitter works on byte strings so each message keeps its own charset, and `postal-mime` decodes MIME, encoded headers and quoted-printable. HTML-only mail goes through a small `htmlToText`. `.eml` files and small `.zip` archives of either are also read. Entries without headers are reported as skipped.

**Data.** One `emails` record per message: id `mid:<Message-ID>`, or `h:<content hash>` when there is none. A duplicate keeps the stored copy and its labels, category and banished state. `drafts` holds reply drafts. They are never sent: the reader offers Copy and a `mailto:` link that opens the user's own mail app.

**Mailboxes.** One inbox can hold several accounts. Each import is one file, so one mailbox: a message keeps the address in its topmost `Delivered-To` (or `X-Original-To`, `Envelope-To`) as `mailbox`; mail without one, such as sent mail, gets the file's main address once the file is read (`MailboxTally`: most delivered-to, else most frequent in From/To/Cc). Re-importing fills in mail stored before mailboxes existed. The list shows a mailbox filter only when there are two or more, the reader shows the mailbox, and `search_emails` takes and returns `mailbox`. Signing in to providers is not offered: browsers cannot open IMAP connections, QQ and 163 have nothing else, and Gmail's read scope needs Google's paid security review. An export guide on the empty inbox covers Gmail (Takeout), Outlook and Yahoo (via Thunderbird), iCloud (Apple Mail export), QQ and 163 (IMAP authorization code in Thunderbird).

**Demo.** A fictional 18-message sample inbox (`public/sample/inbox.mbox`, generated by `scripts/make-sample.mjs`, reserved `example` domains) is loaded through the same importer. Five Mock scripts run the real tools. Category and reply wording are scripted for the sample, and a test runs every script end to end.

### Tools

| Tool | Risk |
|---|---|
| `search_emails` | read |
| `read_email` | read |
| `classify_emails` (batch, one approval) | write |
| `draft_reply` | write (stores text, never sends) |
| `label_email` | write |
| `banish_emails` (bulk) | destructive |

## 9. MCP server

`packages/mcp-server` is generic: `createMcpServer` serves any `ToolRegistry` over MCP with the SDK's low-level `Server`, and `runCli` adds stdio, flags and imports. Tool names, descriptions, input schemas (zod "input" view, so defaulted fields are optional) and output schemas come from the registry, the same definitions the browser agent uses (R9.3). Risk becomes `readOnlyHint` / `destructiveHint`. Results carry text and `structuredContent`. Failures return `isError` with the typed error.

Each app has `mcp/app.ts` (its registry, search and importers over `FileStorage`) and `mcp/main.ts`. Flags: `--data <dir>`, `--import <file>` (a Séance export from Settings, or a raw export the app reads), `--read-only`. Relative paths resolve against the repo root, so the server works whatever directory the client starts it from. Logs go to stderr.

Kiro config: `docs/kiro-mcp.json`, also tracked at `.kiro/settings/mcp.json` after the user's explicit Nov 17 authorization. Each server connected in Kiro with seven tools. The config lists only read tools in `autoApprove`, but Kiro still requested one-time approval for reads in the tested Accept file changes session. No persistent approval was granted and no MCP write was exercised, so configuration and risk annotations are not proof of client approval behavior. Each start imports the fictional sample data, and P3 makes re-imports no-ops.

## 10. UI and visual direction

- **Palette** (dark only): see `.kiro/steering/design-language.md`; values live in `packages/ui/src/tokens.css` and a test checks every text color against every surface for WCAG AA.
- **Type**: a humanist sans for UI and a monospace for tool I/O, both self-hosted.
- **Signature**: the agent timeline. A thin thread with a mark on each step (spinner while running, a pulsing amber dot while it waits for approval, then a check, cross or stop sign). Messages carry no mark. Under reduced motion the dot is static with a ring.
- **Layout**: three panes (library, conversation or message, agent). The command palette reaches every action.
- **Motion**: short (under 200 ms) and purposeful. No decorative loops.
- **Timeline data flow**: `reduceTimeline` in core folds `AgentEvent`s into `TimelineEntry[]`. `@seance/ui` declares the same type for `<SeanceTimeline>` props (ui never imports core), so apps pass the reducer output straight in.
- **Approval card**: focus moves to the card, not to Allow, so a stray Enter never approves. Esc rejects. Bulk actions pass the affected items through `describeApproval`.
- **Command palette filter**: `paletteScore` ranks whole-phrase matches, then word starts, then substrings, and never matches scattered letters. cmdk's default fuzzy match let "api key" pick "Draft a reply to Maya about dinner" about 3 times in 4.
- **Toasts** sit at the bottom centre. The side panes keep controls at their bottom edge.
- **Kit gallery**: `/kit/` shows every component live with canned data. It is part of the template story and is covered by e2e and axe.
- **Languages (EN / 中文)**: a small typed layer in `packages/ui/src/i18n.ts`, no library (i18next and friends add ~50 KB, string keys and a build step). Each package keeps `defineMessages(en, zh)`; the Chinese dictionary must have the same keys and parameter types or `tsc` fails. `useT` re-renders on change, `tNow` serves code outside React (demo scripts). The choice is stored in `localStorage` (`seance.locale`), so the landing page and both apps switch together, and `<html lang>` follows it. Dates use `Intl` in UTC. Sample data, tool outputs and the MCP server stay English. Mock scripts match the prompt in either language and reply in the current one. A real model gets one extra system-prompt line asking it to answer in Chinese, while email drafts stay in the language of the thread. The `EN / 中文` switch sits at the far right of every header, after a divider, so it reads as a setting, not a link. CJK text uses system fonts (PingFang SC, Microsoft YaHei, Noto Sans CJK).
- **Providers (CC Switch style)**: Settings keeps a list of saved profiles (name, vendor preset, settings) in the `secrets` record `providers`, plus the active one. Picking a profile switches the agent at once, and so does the header select (`ProviderSwitch`) or ⌘K. Demo mode is one more choice, and saved keys stay when you pick it; Delete forgets a key. Presets in `packages/llm/src/presets.ts` prefill the URL and protocol for OpenAI, Anthropic, OpenRouter, Gemini, Groq, Mistral, xAI, DeepSeek, Qwen, Doubao, SiliconFlow, Qianfan, MiniMax, Hunyuan, Kimi, GLM, Ollama and LM Studio, and Custom works for any OpenAI- or Anthropic-compatible URL. Each preset records whether a browser may call it, checked with a CORS preflight from the live origin on Nov 16: Kimi and GLM refuse, so the form says to reach them through SiliconFlow or OpenRouter. "Load model list" asks the vendor's `/models` instead of shipping names that go stale. Signing in with a ChatGPT or Claude subscription is not offered: those credentials belong to the vendors' own apps, and using them elsewhere breaks their terms.
- **Model picker and reasoning**: the agent pane has a menu under the prompt box with Model › (demo, then each saved provider's name with its loaded models under it) and Reasoning › (only the levels the chosen model documents, otherwise "Not supported"). Levels come from `reasoningOptions` in `packages/llm/src/reasoning.ts`: DeepSeek off/low/high/max via `thinking` and `reasoning_effort`; Claude low/medium/high via `output_config.effort` on the models Anthropic lists; OpenAI's o-series and GPT-5 via `reasoning_effort`; OpenRouter where its model list says `reasoning`. Others get none, because an unknown parameter fails the request. Reasoning a model returns (`reasoning_content`, signed `thinking` blocks) is kept on the assistant turn and sent back unchanged: DeepSeek answers HTTP 400 to a tool follow-up without it. The settings form starts with no model and shows every loaded model in a select, because preset names go stale.
- **Streaming**: `CompleteRequest.onDelta` receives text and reasoning as they arrive. OpenAI-compatible servers and Anthropic stream over Server-Sent Events (`readEvents`), and a server that ignores `stream` and answers with JSON still works. The agent turns the callbacks into `message_delta`, `reasoning_delta` and `reasoning` events (`withDeltas`), and the reducer keeps one open entry per stream. In the timeline, replies type out with a caret, thinking shows faintly while it happens and then folds to "Thought for N s", runs of finished read steps fold into "Used N tools", and steps that change data stay on their own line with Undo. Screen readers hear a reply once it is complete. The Mock types its scripted replies (`typingMs: 14` in the apps, 0 in tests).
- **Look**: a calm, professional dark product UI (Linear and Claude.ai are the reference): neutral surfaces, one indigo accent, amber only for approvals and Demo mode, red only for destructive actions. One type scale (12-64 px, weights 400-600, no uppercase), one control height scale (28/32/40), two border colors. The Kiroween flavor is in names and copy, not decoration. The landing page shows the real product: `pnpm screenshots` renders `site/public/screens/*.png` from the built apps in both languages, so the page never shows an old UI. The redesign followed an independent review of every screen (`.shots/audit/REVIEW.md`, not committed).
- **Copy**: lightly spooky labels ("Resurrect", "Banish") over plain descriptions in tooltips. Never at the cost of clarity.

## 11. Landing page (`site/`)

Sections in order: hero (template story), "How an app is built" (tool registry in 3 code steps), two app cards with links, **Built with Kiro** (specs, steering, MCP, with links to `KIRO_USAGE.md` and `.kiro/`), demo video embed, footer (repo, license). Static, no JS framework needed beyond Vite + React for consistency with `packages/ui`.

## 12. Deployment

Cloudflare Workers static assets (the Cloudflare dashboard's unified Worker/Pages flow), one project named `seance-kit`, configured by `wrangler.jsonc` and deployed with `npx wrangler deploy`. A build script produces `dist/` with:

```
/            landing
/archive/    archive-seance (Vite base "/archive/")
/inbox/      inbox-exorcist (Vite base "/inbox/")
```

Per-app SPA fallback lives in `worker/index.js`, not in `_redirects`. The Worker serves assets first (`env.ASSETS.fetch`). On a 404 for a GET/HEAD navigation under `/archive/` or `/inbox/` (and not a file-like path such as `.js`), it returns that app's own `index.html`. Unknown root URLs and missing files still return 404.

**Decision record (Nov 16-17, 2026).** The first deploy failed with Cloudflare API error 100324 ("Infinite loop detected in this rule") on `/archive/* /archive/index.html 200` and `/inbox/* /inbox/index.html 200`. Workers static assets rejects wildcard 200 rewrites whose destination re-matches the source (see cloudflare/workers-sdk#11824 and #11904). We rejected `assets.not_found_handling = "single-page-application"` because it falls back only to the root `index.html`, so `/archive/` deep links would show the landing page. `build-all.mjs` therefore emits no `_redirects`, and `wrangler.jsonc` sets `main` and `assets.binding = "ASSETS"`.

**Offline (R4.3).** Each app's `vite.config.ts` adds `offline()` from `scripts/vite-offline.ts`. On build it writes `<base>sw.js` from `scripts/offline-sw.js` with the list of built files and a content-hash version, and adds an inline registration script to `index.html`. The worker's scope is the app's own path, and its cache names carry that path, so apps on the shared origin never read or delete each other's caches. Navigations go network first and fall back to the cached shell (cached under the folder URL, because Cloudflare redirects `.../index.html`). Other requests in scope are cache first. Requests outside the scope, including every provider call, are not intercepted. The landing page has no worker: R4.3 covers the apps only.

GitHub Actions runs checks. Cloudflare's Git integration builds and deploys `main` (build command `pnpm install --frozen-lockfile && pnpm build`, deploy command `npx wrangler deploy`). Deployment is proven on day one (task group 0).

## 12a. Performance (measured Nov 16, Chromium, `node scripts/perf.mjs`)

| Import | Imported | List ready | Longest block | Search | JS heap |
|---|---|---|---|---|---|
| Archive, 2,000 chats × 12 messages (13 MB) | 1.3 s | 1.3 s | 0 ms | 157 ms | 87 MB |
| Inbox, 5,000 messages (5 MB) | 1.8 s | 1.9 s | 0 ms | 150 ms | 78 MB |
| Archive, 10,000 chats (67 MB) | 4.6 s | 4.6 s | 163 ms | 159 ms | 368 MB |
| Inbox, 30,000 messages (31 MB) | 9.3 s | 10.6 s | 329 ms | 158 ms | 290 MB |

"Search" includes the 120 ms typing debounce. The search engine alone takes about 18 ms on 30,000 messages. Lists render 300 rows at a time, with a "Show more" button. Known limits: each app keeps every item in memory, about 37 KB per 12-message chat. A large `conversations.json` is parsed on the main thread in one block (about 165 ms at 67 MB). Moving parsing to a worker and keeping a light list index are the next steps if archives grow past about 10,000 chats.

## 12b. Initial JavaScript (measured Nov 17, 2026)

Measured from the production build on Node 24.18.0 / pnpm 9.15.9, after merge `56d54fc` and the README/link-copy fix. Sizes are decimal KB (1 KB = 1,000 bytes). "Initial" sums the entry and every static JavaScript dependency; it excludes CSS, fonts, images, service-worker precaching and modules requested only after interaction or scrolling. Each file is gzipped separately with Node's default `gzipSync` settings.

| Entry | Before, raw KB | After, raw KB | Before, gzip KB | After, gzip KB |
|---|---:|---:|---:|---:|
| Landing `/` | 610.56 | 292.00 | 203.01 | 95.45 |
| UI gallery `/kit/` | 637.46 | 502.94 | 212.81 | 167.83 |
| Archive `/archive/` | 898.86 | 848.49 | 295.61 | 278.56 |
| Inbox `/inbox/` | 981.47 | 848.96 | 325.05 | 278.35 |

**Analysis.** A temporary Vite `generateBundle` plugin inspected each chunk's module `renderedLength`, without installing a dependency. The largest contributors before minification were React DOM (~654 KB), Motion DOM (~395 KB), Dexie (~289 KB), zod (~253 KB), and, in Inbox, postal-mime (~260 KB). These are rendered source lengths, not additive estimates of compressed bytes. The landing entry also pulled in Dexie through unused UI → LLM → Storage exports. React DOM, storage, schemas, search and the apps' on-screen UI remain eager because startup uses them.

**Changes.** `useImporter` loads its app's parser inside the existing import guard and error handling. MIME parsing loads postal-mime on use; the zip branches load fflate. The public Settings and command-palette components load their UI on first opening and stay mounted afterwards, preserving Radix focus restoration; keyboard listeners remain eager. Archive's directory-import dialog loads on first selection. The existing landing timeline loads when approaching the viewport and reserves its original 23rem minimum height. Package `sideEffects` metadata lets unused exports disappear, while explicitly retaining UI i18n initialization and CSS.

**Validation.** The executable-JS budget e2e failed for all three original entries before splitting. Its limits are 130,000 gzip bytes for the landing and 280,000 for each app. Functional e2e includes axe, keyboard flows, both offline sample imports, and first offline use of Settings, the command palette, zip extraction, MIME parsing and the directory-import dialog.

**Offline tradeoff.** The existing service workers still precache every app build file, including deferred chunks. This reduces the JavaScript needed to start and execute the page, but does not reduce total first-visit app downloads: precaching still downloads the deferred code in the background, and all emitted JS totals 295.61 → 299.32 KB gzip for Archive and 325.05 → 337.47 KB for Inbox due to per-chunk compression and shared code. Changing that cache policy is outside this performance change. No new dependency, provider, app feature or deployment was added.

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
| P12 | Provider profiles survive save and load unchanged and never reach an export. Parsing any input gives unique ids and an active id that exists, or demo mode. |
| P13 | Server-Sent Events parse to the same events however the byte stream is split, including inside multi-byte characters. |
| P14 | A run stopped mid-stream keeps exactly the text that arrived, and leaves no timeline entry marked as streaming. |
| P15 | Dragged or saved pane widths always stay within each pane's limits and leave the content pane at least 360 px; clamping twice changes nothing. |

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
