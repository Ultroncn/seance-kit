# Séance Kit: Submission Plan

Facts here must match the shipped product. Re-check every claim before submitting.

## Demo video storyboard (target 2:45, hard limit 3:00)

Record in one pass, screen capture plus voice-over. Rehearse twice. Cut anything over time.

| Time | Section | On screen | Voice-over gist |
|---|---|---|---|
| 0:00-0:15 | **Problem** | Scattered chat exports and a messy inbox file | Our AI history and email pile up in files we never open. Cloud tools want your data. |
| 0:15-0:40 | **Template** | Landing page, then the tool registry code, then `pnpm new:app` | Séance Kit is a local-first template. Define typed tools, get an agent loop, approvals, storage and UI. Two apps came out of it. |
| 0:40-1:20 | **Archive Séance** | Drag in a ChatGPT export, search, run "summarize my oldest chats", approve a tag step, resurrect one | Import, search, summarize, resurrect. Every write step waits for approval in the séance timeline. Demo-mode badge is visible. |
| 1:20-1:45 | **Real provider** | Settings, paste own key, badge disappears, run one prompt for real | The demo runs on a scripted provider and says so. Here is the same flow with a real model, key stored only in the browser. |
| 1:45-2:10 | **Inbox Exorcist** | Drop an mbox, classify, bulk Banish approval list, undo | Same core, different tools. Bulk deletes list every message first. Nothing is sent, nothing is lost. |
| 2:10-2:40 | **Kiro usage** | `.kiro` folder: spec, `tasks.md` progress, steering, MCP tool call from Kiro | Built with Kiro: spec-driven tasks, steering docs that keep conventions, and our own MCP server called from Kiro. |
| 2:40-2:45 | **Close** | URL and repo | Try it at the link. |

Total 2:45, leaving 15 seconds of margin under the 3:00 limit.

Checklist: Demo badge visible in Archive and Inbox segments. Real-provider segment included. Final export under 3:00.

## Devpost fields

**Project name**: Séance Kit

**Category**: Skeleton Crew

**Elevator pitch** (draft, under 200 characters):
A local-first template for building AI agent apps in an afternoon, plus two apps made with it: Archive Séance for old chats and Inbox Exorcist for email.

**Description** (draft):

*Inspiration.* AI chats and email pile up in exports we never revisit, and most tools that help want us to upload everything. We wanted agents that work on our own data, on our own machine.

*What it does.* Séance Kit is a template for agent workspaces. You define typed tools, and the kit provides the agent loop, approval gates, local storage, provider adapters and a polished dark UI. Two apps ship with it.
- **Archive Séance** imports ChatGPT, Claude and Markdown chats, searches them, summarizes and tags them, and resurrects an old chat into a fresh one seeded with its context.
- **Inbox Exorcist** imports `.mbox` and `.eml` files, classifies and labels messages, drafts replies (never sends), and bulk-banishes noise with an approval list and undo.

*How we built it.* TypeScript monorepo with a shared core, storage, provider and UI packages. Data lives in IndexedDB. Tools are defined once with zod and reused for the browser agent and an MCP server. Core invariants are covered by property-based tests (fast-check).

*How we used Kiro.* A spec (requirements, design, tasks) drove the build. Steering docs kept conventions consistent. Our MCP server lets Kiro call the apps' own tools. Details in `KIRO_USAGE.md`.

*Challenges.* Gmail OAuth needs Google verification for mail scopes, so we chose file import, which also strengthens the privacy story. Keeping the core free of app-specific code needed discipline.

*Accomplishments.* The core has no app code, and a generated template app builds and tests in CI.

*What we learned.* Writing invariants as properties (no write without approval, step budget never exceeded) caught bugs examples missed. (Replace with real examples before submitting.)

*What's next.* Browser MCP client, semantic search, light mode.

**Built with**: TypeScript, React, Vite, Tailwind, Radix, Dexie/IndexedDB, MiniSearch, zod, Model Context Protocol, Vitest, fast-check, Playwright, Cloudflare Workers, Kiro.

**Links**: live URL https://seance-kit.mask988888888.workers.dev/, GitHub `Ultroncn/seance-kit`, video, `KIRO_USAGE.md`.

## Pre-submit checklist

- [ ] Repo public, `.kiro` at root and tracked
- [ ] `apps/archive-seance` and `apps/inbox-exorcist` present
- [ ] MIT license at root
- [ ] Live URL works in a private window
- [ ] Demo badge visible under Mock, absent under a real provider
- [ ] Video under 3:00, shows the real-provider path, linked on landing and Devpost
- [ ] `KIRO_USAGE.md` complete with real examples
- [ ] "What we learned" and "Accomplishments" edited to match reality
- [ ] Submitted by Dec 3
