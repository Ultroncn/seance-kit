# How we used Kiro

Draft, started in M0. Each section gets real examples and screenshots before submission (task 5.1).

## Specs

`.kiro/specs/seance-kit/` holds `requirements.md` (EARS), `design.md`, `tasks.md` and `submission.md`. We wrote and reviewed them before any code. `tasks.md` is the build plan, with milestones tied to requirement IDs.

## Steering

`.kiro/steering/` has `product.md`, `tech.md`, `structure.md`, `design-language.md` and `testing.md`. They hold the rules that are easy to forget mid-build: no app code in `core`, soft-delete only, the Demo-mode badge, design tokens, property-test naming.

## Hooks (skipped)

We planned three hooks (task 0.11): typecheck on saving a `.ts`/`.tsx` file, lint and tests after each spec task (`PostTaskExec`), and the `.kiro`-not-ignored check on saving `.gitignore`.

We could not create them. Every `createHook` attempt, through several retries, was denied by workspace permission rules. That included a retry after cleaning `permissions.yaml` and fully restarting Kiro. The deny rules reappeared after each attempt and `.kiro/hooks/` was never created. We did not work around the rule.

We skipped hooks on Nov 16. They are not required for submission. The same checks run in GitHub Actions on every push and pull request: the `.kiro` check, typecheck, lint, unit and property tests, build, and Playwright smoke tests.

## MCP

Planned (M4): `packages/mcp-server` exposes the apps' tool registry, and `.kiro/settings/mcp.json` registers it so Kiro can call the tools.

## Decision log

### Deploy: Workers static assets rejects `_redirects` SPA rewrites

The first Cloudflare deploy built cleanly, then failed at `wrangler deploy` with API error 100324 ("Infinite loop detected in this rule") on `/archive/* /archive/index.html 200`. The platform's validator rejects wildcard 200 rewrites whose destination re-matches the source.

`assets.not_found_handling = "single-page-application"` was no fix either, because it falls back only to the root `index.html` and would show the landing page on `/archive/` deep links.

Decision: remove `_redirects` and add a small Worker (`worker/index.js`) that serves assets first, then returns the right app's `index.html` for navigations under `/archive/` or `/inbox/`. Unknown root URLs still return 404. The local test server (`scripts/serve-dist.mjs`) runs the same Worker, so Playwright covers the deep-link behavior before every deploy. Recorded in `design.md` section 12.

### Secrets never leave through an export

The first draft stored the API key with other settings, which meant "Export all data" would have written it into a JSON file that people share or feed to the MCP server. We added a reserved `secrets` collection that every Storage adapter leaves out of `exportAll`. The shared contract suite enforces it, and an e2e test downloads a real export and checks that the key is absent. The steering file `tech.md` now carries the rule.

### Tests that caught real problems in M2

- **Markdown round-trip (P1).** A message containing a line such as `## User` would split into two messages on re-import. The property found it in its first runs, and the fix escapes marker-like lines. Removing the escape makes the property fail with that exact counterexample.
- **Search extraction.** MiniSearch also reads the `id` field through the custom field extractor. A unit test showed every id coming back empty. The search service now always reads `id` itself.
- **Accents.** A tool test expected "pastel de nata" to find the Lisbon chat, which says "pastéis". The search was right and the test was wrong, but it showed that typing without accents found nothing. Search now folds accents.

### A shared React layer

Running the agent from React (events into the timeline, approval promises, stop, undo) is identical in both apps and the template. We added `@seance/react` with `useAgentRun` instead of copying it, so `core` stays framework-free and `ui` stays presentational. The steering file `structure.md` records the rule.

### Tests that caught real problems in M3

- **mbox splitting (P4) had a blind spot.** A mutation check removed the rule that `From ` only starts a message after a blank line, and P4 still passed: a correct writer escapes every such line, so the property never sees one. Real exports are not always correct, so we added a test with an unescaped `From here on…` line in a body. It catches the mutation.
- **Header-less junk imported as mail.** `postal-mime` reads text without headers as a body. The fixture's junk entry became an email. Entries with no headers are now reported as skipped.
- **Double-spaced lists.** HTML newsletters came out with blank lines between list items. The fixture test showed it, and `htmlToText` was fixed.
- **Axe in a real browser** found that a long approval list (18 emails to sort) scrolled but could not be focused, so keyboard users could not read what they were approving. The details region is now focusable and labelled.
- **A 12-second test** was a real bug. Toasts sat over the library's Inbox, Drafts and Banished buttons and blocked clicks for six seconds. Toasts moved to the bottom centre.
- **A flaky test** was a real bug too. cmdk's fuzzy matching let "api key" highlight "Draft a reply to Maya about dinner" about 3 times in 4, so Enter could start an agent run. The palette now uses a predictable filter (`paletteScore`) with its own unit tests. The full e2e suite then passed five runs in a row.
