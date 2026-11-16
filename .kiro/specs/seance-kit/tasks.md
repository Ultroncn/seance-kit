# Séance Kit: Tasks

Today is Nov 16, 2026. Submit Dec 3. Deadline Dec 4, 2:00 PM PT.
Every milestone ends with a deployed Cloudflare Pages build.

## Schedule

| Dates | Milestone |
|---|---|
| Nov 16-17 | M0 Scaffold + deploy pipeline |
| Nov 18-20 | M1 Core, storage, providers, UI kit |
| Nov 21-24 | M2 Archive Séance |
| Nov 25-28 | M3 Inbox Exorcist |
| Nov 29-30 | M4 MCP server, template, landing, a11y |
| Dec 1 | M5 Video, write-up, Devpost |
| Dec 2 | Buffer and feature freeze |
| Dec 3 | Submit |

## M0. Scaffold and deploy first (Nov 16-17)

- [x] 0.1 Init pnpm workspace, TypeScript strict config, ESLint, Prettier. (R11)
- [x] 0.2 Add `LICENSE` (MIT), `README.md` stub, `.gitignore` that does not ignore `.kiro`. (R1)
- [x] 0.3 `scripts/check-kiro-not-ignored` plus CI job. (R1.6)
- [x] 0.4 Empty shells: `site/` (landing), `apps/archive-seance`, `apps/inbox-exorcist` (Vite + React + Tailwind, base paths `/`, `/archive/`, `/inbox/`). `apps/` holds only the two apps. (R1.2)
- [x] 0.5 `packages/ui` with tokens and theme only. Shells use it.
- [x] 0.6 Combined build script producing `dist/`. No `_redirects` (see 0.8a).
- [x] 0.7 GitHub Actions: typecheck, lint, test, build. (R11.3)
- [x] 0.8 Create the Cloudflare project (Workers static assets), connect `main`, enable PR previews. Config in `wrangler.jsonc`. (R11.4, R12.1)
- [x] 0.8a `worker/index.js` provides per-app SPA fallback, with unit tests and e2e coverage. Workers static assets rejects `_redirects` SPA rewrites (error 100324), so the fallback lives in the Worker. See design.md section 12.
- [x] 0.9 Verify the live URL serves landing and both shells, and that `/archive/` and `/inbox/` deep links show the right app (`BASE_URL=<url> pnpm e2e`). Record the URL in README.
- [x] 0.10 Playwright smoke: three URLs load. Add to CI.
- [~] 0.11 ~~Add Kiro hooks (typecheck on save, tests on commit).~~ **Skipped** (Nov 16). `createHook` was blocked by workspace permission rules on every attempt, including after a clean `permissions.yaml` and a full restart. Not required for submission. CI already runs typecheck, lint and tests on every push. See `KIRO_USAGE.md`.
- [x] 0.12 Start `KIRO_USAGE.md` with entries for specs, steering, hooks (hooks entry records the skip), decisions.

Exit: public URL works, CI green, `.kiro` committed.

## M1. Core, storage, providers, UI kit (Nov 18-20)

- [x] 1.1 `packages/storage`: interface, Memory adapter, contract suite. (R4.2)
- [x] 1.2 IndexedDB adapter (Dexie) passing the contract suite. (R4.1)
- [x] 1.3 File adapter passing the contract suite. (R4.2)
- [x] 1.4 PBT P5 for storage.
- [x] 1.5 `packages/core`: tool registry with schemas, risk, `toJsonSchema`, `toMcpTools`. (R2.2)
- [x] 1.6 PBT P7, P11 for registry.
- [x] 1.7 Agent loop with step budget, validation, event stream. (R2.1, R2.3, R2.4, R2.6)
- [x] 1.8 Approval gate and Banish/undo. (R2.5, R2.7)
- [x] 1.9 PBT P8, P9, P10 for the loop and gates.
- [x] 1.10 `packages/llm`: Provider interface, Mock provider with scripts. (R3.1)
- [ ] 1.11 Anthropic, OpenAI-compatible, Ollama adapters (manual verify against real endpoints). _Adapters, fake-fetch tests and a routed e2e of the OpenAI-compatible path done. Still pending: the user verifies a real endpoint with his own key via Settings → Test connection. Keys are never shared in chat._
- [x] 1.12 Settings panel: provider choice, key storage in IndexedDB. (R3.2, R3.5)
- [x] 1.13 `<DemoBadge/>` and `useProviderMode`. Unit test. (R3.4)
- [x] 1.14 UI kit: layout panes, buttons, inputs, command palette, séance timeline, approval card. (R7)
- [x] 1.15 Reduced-motion handling in kit. (R7.5)
- [x] 1.15a Public UI-kit gallery at `/kit/` (in `site/`, canned data), with real-browser axe (incl. contrast), palette, approval and reduced-motion e2e tests.
- [x] 1.16 Search service over MiniSearch with persistence. PBT P6. (R4.5)
- [x] 1.17 Export all and wipe data actions. (R4.4) Export excludes the `secrets` collection.
- [x] 1.18 Deploy and verify.

## M2. Archive Séance (Nov 21-24)

- [x] 2.1 Fixtures: small sanitized ChatGPT, Claude, Markdown exports.
- [x] 2.2 Importers with tolerant parsing. PBT P1, P2. (R5.1)
- [x] 2.3 Dedup on import. PBT P3. (R5.2)
- [x] 2.4 Import UI: drag and drop, progress, error report.
- [x] 2.5 Library view: list, filters (text, date, source). (R5.3)
- [x] 2.6 Conversation reader.
- [x] 2.7 Tools: search, read, summarize, tag, banish, resurrect. (R5.4)
- [x] 2.8 Store and show summaries and tags. (R5.5)
- [x] 2.9 Agent pane with séance timeline and approvals. (R5.6)
- [x] 2.10 Seeded demo archive and Mock scripts for 4-5 prompts.
- [x] 2.11 Banished view with undo.
- [x] 2.12 Playwright smoke plus axe. (R7.6)
- [x] 2.12a `@seance/react` package with `useAgentRun`, shared by both apps and the template.
- [x] 2.13 Deploy and verify (28 e2e tests pass against the live URL). _Real-provider manual test: pending the user's own key, see 1.11._

## M3. Inbox Exorcist (Nov 25-28)

- [x] 3.1 Fixtures: small mbox (including `From ` in body) and eml files.
- [x] 3.2 mbox splitter and eml parser with `postal-mime`. PBT P4. (R6.1)
- [x] 3.3 Dedup by Message-ID with hash fallback. PBT P3 for email. (R6.2)
- [x] 3.4 Import UI with chunked reading and progress.
- [x] 3.5 Inbox list, filters, message reader.
- [x] 3.6 Tools: search, read, classify (as `classify_emails`, batched), draft_reply, label, banish_emails. No tool can send. (R6.3, R6.4)
- [x] 3.7 Bulk Banish approval card listing affected messages. (R6.5)
- [x] 3.8 Seeded sample inbox and Mock scripts. (R6.6)
- [x] 3.9 Drafts view (copy to clipboard, never send).
- [x] 3.10 Playwright smoke plus axe.
- [ ] 3.11 Deploy and verify. Real-provider manual test.

## M4. MCP, template, landing, a11y (Nov 29-30)

- [ ] 4.1 `packages/mcp-server` over stdio using the MCP SDK and File adapter. (R9.1, R9.3)
- [ ] 4.2 Register in `.kiro/settings/mcp.json`. Test from Kiro with an exported archive. (R9.2)
- [ ] 4.3 `templates/app` minimal working app. (R10.1)
- [ ] 4.4 `pnpm new:app` script. CI job generates an app, builds and tests it. (R10.2)
- [ ] 4.5 README "afternoon path" in under ten steps. (R10.3)
- [ ] 4.6 Landing page content: template story, tool-registry code walkthrough, app cards, Built with Kiro section, video slot, footer. (R8)
- [ ] 4.7 Full axe pass, keyboard walk-through, contrast audit. (R7.4, R7.6, R7.7)
- [ ] 4.8 Performance pass on a large mbox and a large conversations.json.
- [ ] 4.9 Deploy and verify.

## M5. Video, write-up, Devpost (Dec 1)

- [ ] 5.1 Finish `KIRO_USAGE.md` with concrete examples and screenshots. (R1.5)
- [ ] 5.2 Record the demo per `submission.md` storyboard. Include the real-provider switch. (R3.6)
- [ ] 5.3 Verify video length is under 3:00. Upload and put the link on the landing page.
- [ ] 5.4 Fill Devpost fields from `submission.md`.
- [ ] 5.5 Fresh-clone test: clone, `pnpm i`, `pnpm test`, `pnpm build` on a clean machine or directory.

## Dec 2. Buffer and freeze

- [ ] 6.1 No new features. Fix bugs only.
- [ ] 6.2 Final checklist against R1: public repo, `.kiro` present, two app folders, license, URL, video, write-up.
- [ ] 6.3 Confirm the live URL in a private window with no stored data.

## Dec 3. Submit

- [ ] 7.1 Submit on Devpost. Confirm the submission shows as complete.
- [ ] 7.2 Tag `v1.0.0-kiroween`. Do not push to `main` after the tag except for emergencies.

## Cut list (do not start)

MCP client, semantic search, light mode, Gmail OAuth.
