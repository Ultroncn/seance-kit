# Séance Kit: submission packet

Status checked Nov 17, 2026. This is a preparation record, not a completed entry or an eligibility declaration.

## Rules and timing

- Category: **Skeleton Crew**, with two separate app folders and a reusable starter.
- Official deadline: **December 4, 2026, 2:00 PM Pacific Standard Time**, equivalent to **December 5, 2026, 06:00 Beijing time**. The internal target remains December 3.
- The demo must be **under 3 minutes**, show the project working and Kiro usage, and be on **YouTube set to public**. Use English narration or an English translation.
- Keep the public repository, MIT license, root tracked `.kiro/`, working demo URL and Kiro write-up accessible.
- After the deadline, do not change the repository, video, app or linked materials until winners are announced. A local tag does not replace this freeze.

Sources: [Official rules](https://kiroween.devpost.com/rules), [submission finalization checklist](https://devpost.com/submit-to/31667-kiroween-2026/manage/submissions/1305589-seance-kit/finalization). Re-check for organizer updates before final submission.

## Verified preparation

- Public repository: https://github.com/Ultroncn/seance-kit
- Live demo: https://seance-kit.mask988888888.workers.dev/
- Both app folders and the root MIT license are present; `.kiro/` is tracked and its ignore check passes.
- Commit `71fc623` passed [GitHub CI](https://github.com/Ultroncn/seance-kit/actions/runs/44009744731) and Cloudflare deployment. Later local commits must be pushed and their remote checks verified separately.
- The full deployed suite passed **57/57** in fresh Playwright contexts, including axe, keyboard flows, offline reload and first offline use of deferred importers/dialogs. This is automated clean-browser verification, not a manual incognito-window claim. The log is in `docs/kiro-evidence/production-e2e.log`.
- Both Kiro MCP servers connected with seven tools each. Actual searches found the expected sourdough and boiler samples. A Storage.exportAll sample JSON was also imported into isolated FileStorage and queried from Kiro. Read calls still required one-time permission; no MCP write was exercised.
- `KIRO_USAGE.md` now includes actual spec, steering, hooks, MCP, history and review/test screenshots, with truthful limits on what each proves.
- The existing Devpost draft was renamed **Séance Kit**. Its project story, three technology tags, four links, Skeleton Crew category, testing instructions and technology disclosure were saved. The form still shows **DRAFT, 2/5 steps**; missing fields and terms have not been fabricated or accepted.

## Demo cut and remaining recording

The local review cut measures **2:42.04** (1920×1080, H.264/AAC). It is an edited montage of actual browser/Kiro screenshots with synthetic English narration and subtitles. It is **not continuous screen recording** and **not the final submission video**. It includes a clearly labelled pending real-model segment. Do not upload it as evidence of a real-provider run.

The final video should follow this 2:45 outline, leaving 15 seconds below the limit:

| Time | Actual screen action | Narration focus |
| --- | --- | --- |
| 0:00–0:12 | Landing page and two app links | One reusable local-first agent template, two concrete apps. |
| 0:12–0:32 | Tool definition and shared UI | zod schema, risk, agent loop, storage; `pnpm new:app`. |
| 0:32–1:02 | Archive public sample, search/tag approval, Reject | Demo badge stays visible; the script invokes actual tools and respects rejection. |
| 1:02–1:27 | Owner-configured real provider and one actual prompt | Hide key-entry fields while recording. Show successful connection, selected model, no Mock badge and actual tool/approval result. This segment is still pending. |
| 1:27–1:57 | Inbox sample, Banish approval, Allow, Undo | Five listed messages, Inbox 18→13→18, recoverable local changes; never sends. |
| 1:57–2:37 | Kiro specs, steering/hook configuration and actual MCP read result | Distinguish configured hooks from observed execution; disclose other-tool follow-up. |
| 2:37–2:45 | Public demo and repository links | No account for the labelled demo; bring your own provider for a real model. |

Final recording checklist: actual working flows; readable Demo badge; real-provider segment genuinely verified; no keys/private data; English narration/subtitles; duration below 180 seconds; YouTube **public**, then put the actual URL in Devpost and `VIDEO_URL` in `site/src/App.tsx`. No placeholder URL.

## Saved Devpost copy

**Project name:** Séance Kit

**Tagline:** Build local-first AI agent apps from one tested template. Explore chat archives and triage email with typed tools, approval gates and undo.

**Category:** Skeleton Crew

**Saved technology tags:** typescript, react, kiro.

**Try-it links:**

- https://seance-kit.mask988888888.workers.dev/
- https://github.com/Ultroncn/seance-kit
- https://seance-kit.mask988888888.workers.dev/archive/
- https://seance-kit.mask988888888.workers.dev/inbox/

### Project story

## Inspiration
AI chats and email accumulate in export files that are hard to revisit. We wanted useful agents over local data, with clear approval before any change. The reusable template is the product; two different applications demonstrate it.

## What it does
Séance Kit provides a typed tool registry, agent loop, approval gates, local storage, provider adapters, a shared dark UI, and an MCP server.

**Archive Séance** imports ChatGPT, Claude, Markdown and zip exports. Search and read conversations, summarize or tag them, soft-delete with Undo, and resurrect an old conversation into a new prompt.

**Inbox Exorcist** imports mbox, eml and zip archives. Search messages, classify and label them, draft replies without sending mail, and approve bulk Banish operations with the affected messages listed first.

Both applications work offline after the first load, except calls to a real provider. The hosted demo uses an explicitly labelled scripted Mock provider with fictional sample data. Real-provider adapters support Anthropic, OpenAI-compatible endpoints and Ollama through browser settings; no hosted LLM proxy is provided.

## How we built it
A strict TypeScript pnpm monorepo shares core, React bindings, LLM, Storage, UI and MCP packages. Tools are defined once using zod; the same schemas drive validation, model tool definitions and MCP. IndexedDB keeps browser data local. API keys live in a reserved secrets collection excluded from exports. Each app has its own database and offline-worker scope.

The starter is generated with pnpm new:app. App-specific tools and importers remain outside the reusable core. The two app folders are apps/archive-seance and apps/inbox-exorcist.

## How we used Kiro
Tracked EARS requirements, design decisions and tasks in .kiro preceded the scaffold. Steering files specify product boundaries, dependencies, implementation conventions, testing and design language. Three hook definitions cover shared-package typechecks, task checks and session status. The repository distinguishes hook configuration from evidence that a particular hook actually ran.

Kiro-attributed development and reviews are documented alongside other-tool contributions, including the Codex follow-up. KIRO_USAGE.md links concrete commits, regression tests for R.1–R.16 and actual Kiro screenshots. Both MCP servers connected in Kiro with seven tools each. Actual searches for sourdough and boiler returned the expected fictional sample record. Archive was also checked against a Storage.exportAll sample export in an isolated data directory. Kiro requested one-time permission for the reads despite the autoApprove list; no MCP write was exercised.

Details: https://github.com/Ultroncn/seance-kit/blob/main/KIRO_USAGE.md

## Challenges and what we learned
Property tests found cases ordinary examples missed: a Markdown message containing a role marker could split on re-import, and duplicate conversation IDs in one import could make re-imports alternate stored versions. Shrunk examples remain as regressions.

Reviews exposed protocol and lifecycle issues that a scripted provider could hide, including orphan tool results after resetting a run. Defaults in zod input schemas also needed the input view so optional model/MCP fields did not become required.

Cloudflare static-asset rewrite constraints led to a small Worker that serves each app's own shell on deep links. Scoped workers cache all app output for offline use. Lazy loading reduces startup JavaScript, but background precaching still downloads deferred code; we report those separately.

## Accomplishments
The Nov 17 build passed 332 unit/property tests and 57 browser tests locally. The same 57 browser tests passed against the deployed site in fresh browser contexts, including axe, keyboard flows, offline reloads and first offline use of deferred imports and dialogs. A fresh local clone passed a frozen-lockfile install, tests and build. GitHub CI and Cloudflare deployment passed for commit 71fc623.

## What's next
Finish real-provider acceptance and the public demo video, then improve the template based on developer feedback. The current scope stays focused on the two working applications and their shared foundation.


### Testing instructions

Open the public demo in a fresh browser. No account or API key is needed for the clearly labelled Mock demo. Open Archive Séance or Inbox Exorcist, click Load the sample archive/inbox, then choose a suggested prompt. Review the tool steps, approve a write or Banish operation, and try Undo. All sample data is fictional. Each app stores data in its own IndexedDB database; after first load it can reload and import offline. Real-provider calls require the judge's own configured endpoint/key and Internet access. The UI supports English and Chinese. Repository setup: pnpm i --frozen-lockfile; pnpm test; pnpm build; pnpm e2e. UI gallery: https://seance-kit.mask988888888.workers.dev/kit/

### Kiro technology explanation

Kiro IDE was used for spec-driven development, steering-guided implementation and the project reviews described in KIRO_USAGE.md. The tracked .kiro folder contains EARS requirements, design decisions, tasks, five steering files and three hook definitions. On Nov 17 we also verified the Kiro MCP integration directly: archive-seance and inbox-exorcist each connected with 7 tools, and actual search_conversations(query=sourdough) and search_emails(query=boiler) calls each returned one fictional sample record. This Kiro session asked for approval before each read call despite the configured autoApprove list; we do not claim automatic approvals. Property-based testing covers P1–P15; concrete regressions and other-tool contributions are disclosed at https://github.com/Ultroncn/seance-kit/blob/main/KIRO_USAGE.md . No Kiro Crew or Powers use is claimed.

### Pre-existing code disclosure

The project uses standard third-party libraries and tools listed in the repository package manifests. The reusable starter in templates/app is part of this project. Git history and KIRO_USAGE.md disclose other-AI-assisted contributions and reverted experiments. Please see the MIT license and dependency manifests for source and licensing details.

## Owner actions and final gate

- [ ] Configure a real provider privately in the already-open app Settings, then run connection and actual tool-flow acceptance. Do not send the key in chat or commit it.
- [ ] Replace the pending real-model segment, review the final video, and upload a public YouTube video. Add its actual link to the app landing page and Devpost.
- [ ] Upload the three public sample cover/gallery images. The owner approved this upload on Nov 17. The attempt failed because the Chrome extension lacks local file URL access; the owner will enable it and notify us before another attempt. No image is claimed uploaded, and approval need not be requested again.
- [ ] Fill personal fields truthfully: residence, age/jurisdiction eligibility, submitter type, AWS employment, previous Kiroween participation and the two personal surveys. Do not infer these from the repository.
- [ ] Review all saved fields and the public preview. Re-check remote commit, CI, deployed site and the final R1 checklist.
- [ ] The owner reviews/accepts the official rules and terms and performs the final prize-entry submission. Verify Devpost shows complete, not Draft.
- [ ] Tag `v1.0.0-kiroween` only after final acceptance; freeze linked materials after the official deadline.

No bonus-prize eligibility, real-model success, upload URL or completed submission is claimed before it is verified.
