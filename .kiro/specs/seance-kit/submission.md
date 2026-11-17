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
- `KIRO_USAGE.md` now includes actual spec, steering, hooks, MCP, history and review/test screenshots, plus the configured real-model approval state in docs/runtime-evidence. Captions state the coverage limits.
- The existing Devpost draft was renamed **Séance Kit**. Its project story, three technology tags, four links, Skeleton Crew category, testing instructions and technology disclosure were saved. After saving the public demo video URL, the form shows **DRAFT, 3/5 steps**; missing personal fields and Devpost terms have not been fabricated or accepted.

## Reviewed demo and publication status

The local publication file is **seance-kit-demo-publish.mp4**, **1:44.67**, 1920×1080 H.264/AAC. It replaces the rejected screenshot-only candidate. Actual tab interactions are edited together with cropped Kiro evidence, synthetic English narration and subtitles. Source tabs were sampled at approximately four frames per second during actual actions and rendered at 30 fps; this is not native 30 fps capture or a one-take recording. Cuts and final-frame holds preserve the timing of the selected action ranges.

| Time | Shown evidence | Coverage |
| --- | --- | --- |
| 0:00–0:18 | Landing and actual Define/Run/Render tab changes | Typed tools and the shared foundation. |
| 0:18–0:30 | Archive sample load/read, tag approval and Reject | Demo provider; actual tools and rejection. |
| 0:30–0:50 | Inbox import, full approval list, Allow and Undo | Five messages; Inbox 18→13→18; local recovery. |
| 0:50–1:10 | Actual deepseek-flash search/read and tag approval/Reject | Owner-configured real provider; a second explicit prompt requested the tag tool. No tag was added. Settings/key entry is not recorded. |
| 1:10–1:35 | Cropped actual Kiro specs, steering, hook configuration and MCP results | Hook configuration is labelled as configuration, not proof of execution; each observed MCP search returned one sample record. |
| 1:35–1:45 | Readable public demo and repository URLs | Labelled demo without sign-up; own provider required for real calls. |

All 17 scene samples and all 26 caption frames were visually checked. Complete local audio transcription matches the script after normalizing “eighteen”/“18”; subtitles were aligned to the recognized word boundaries. The complete file decodes without error. This is frame-based visual review, full automated transcription and technical audio checking, not a claim of human listening or uninterrupted full-speed playback. See [media review and asset disclosure](../../../docs/demo-video-review.md).

Narration is locally generated with Kokoro-82M v1.0 (Apache-2.0), voice af_heart, through kokoro-onnx (MIT); it is not the owner's voice. The publication package contains captions, credits, the upload copy and a checksum manifest. Earlier system-voice drafts are superseded. No key, private archive, stock footage or music is included.

**Published Nov 17:** [https://youtu.be/r6lZfKDDlno](https://youtu.be/r6lZfKDDlno). The owner explicitly approved channel creation/YouTube terms and public upload. YouTube showed “Video published” after Public was selected; its copyright check reported no issues at publication time. English SRT captions were imported and saved, and synthetic narration was disclosed through the AI setting. The actual URL was saved in Devpost (draft advanced to 3/5) and set as `VIDEO_URL` in `site/src/App.tsx`. This is video publication, not final hackathon submission.

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
The owner configured a real provider using deepseek-flash. The browser showed an actual archive search, five conversation reads and a proposed summary paused at the write-approval gate, with no Mock badge. The captured acceptance state did not approve the write. This verifies that configured path, not every model or provider endpoint.

The Nov 17 build passed 332 unit/property tests and 57 browser tests locally. The same 57 browser tests passed against the deployed site in fresh browser contexts, including axe, keyboard flows, offline reloads and first offline use of deferred imports and dialogs. A fresh local clone passed a frozen-lockfile install, tests and build. GitHub CI and Cloudflare deployment passed for commit 71fc623.

## What's next
Complete the final personal/eligibility and submission review, then improve the template based on developer feedback. The public demo video is available at https://youtu.be/r6lZfKDDlno. The current scope stays focused on the two working applications and their shared foundation.

### Testing instructions

Open the public demo in a fresh browser. No account or API key is needed for the clearly labelled Mock demo. Open Archive Séance or Inbox Exorcist, click Load the sample archive/inbox, then choose a suggested prompt. Review the tool steps, approve a write or Banish operation, and try Undo. All sample data is fictional. Each app stores data in its own IndexedDB database; after first load it can reload and import offline. Real-provider calls require the judge's own configured endpoint/key and Internet access. The UI supports English and Chinese. Repository setup: pnpm i --frozen-lockfile; pnpm test; pnpm build; pnpm e2e. UI gallery: https://seance-kit.mask988888888.workers.dev/kit/

### Kiro technology explanation

Kiro IDE was used for spec-driven development, steering-guided implementation and the project reviews described in KIRO_USAGE.md. The tracked .kiro folder contains EARS requirements, design decisions, tasks, five steering files and three hook definitions. On Nov 17 we also verified the Kiro MCP integration directly: archive-seance and inbox-exorcist each connected with 7 tools, and actual search_conversations(query=sourdough) and search_emails(query=boiler) calls each returned one fictional sample record. This Kiro session asked for approval before each read call despite the configured autoApprove list; we do not claim automatic approvals. Property-based testing covers P1–P15; concrete regressions and other-tool contributions are disclosed at https://github.com/Ultroncn/seance-kit/blob/main/KIRO_USAGE.md . No Kiro Crew or Powers use is claimed.

### Pre-existing code disclosure

The project uses standard third-party libraries and tools listed in the repository package manifests. The reusable starter in templates/app is part of this project. Git history and KIRO_USAGE.md disclose other-AI-assisted contributions and reverted experiments. Please see the MIT license and dependency manifests for source and licensing details.

## Owner actions and final gate

- [x] Owner-configured real-provider tool/approval path: owner confirmed working, and actual deepseek-flash browser state showed a successful search and five reads followed by a summary approval card. No write was approved during capture, and no key was recorded. The earlier gpt-6-luna error is not claimed fixed; other endpoints were not manually certified.
- [x] Owner approved public upload; the 1:44.67 file was published on YouTube with English captions and synthetic narration disclosure. Actual URL: https://youtu.be/r6lZfKDDlno. Saved in Devpost and configured on the landing page. The edited video includes recorded interactions and Kiro evidence; it is not a one-take recording.
- [x] Upload the three public sample cover/gallery images. On Nov 17, the approved landing-page cover and Archive/Inbox approval screenshots were uploaded through the native file picker; both gallery captions were saved and verified after navigation. The upload interface continued returning a file-permission error despite the owner reporting the flag already enabled. Its actual cause was not established; no extension setting change was needed for native upload.
- [ ] Fill personal fields truthfully: residence, age/jurisdiction eligibility, submitter type, AWS employment, previous Kiroween participation and the two personal surveys. Do not infer these from the repository.
- [ ] Review all saved fields and the public preview. Re-check remote commit, CI, deployed site and the final R1 checklist.
- [ ] The owner reviews/accepts the official rules and terms and performs the final prize-entry submission. Verify Devpost shows complete, not Draft.
- [ ] Tag `v1.0.0-kiroween` only after final acceptance; freeze linked materials after the official deadline.

No bonus-prize eligibility, real-model success, upload URL or completed submission is claimed before it is verified.
