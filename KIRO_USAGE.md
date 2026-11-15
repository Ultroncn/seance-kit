# How we used Kiro

Draft, started in M0. Each section gets real examples and screenshots before submission (task 5.1).

## Specs

`.kiro/specs/seance-kit/` holds `requirements.md` (EARS), `design.md`, `tasks.md` and `submission.md`. We wrote and reviewed them before any code. `tasks.md` is the build plan, with milestones tied to requirement IDs.

## Steering

`.kiro/steering/` has `product.md`, `tech.md`, `structure.md`, `design-language.md` and `testing.md`. They hold the rules that are easy to forget mid-build: no app code in `core`, soft-delete only, the Demo-mode badge, design tokens, property-test naming.

## Hooks

Planned (task 0.11): typecheck on save, tests on commit.

## MCP

Planned (M4): `packages/mcp-server` exposes the apps' tool registry, and `.kiro/settings/mcp.json` registers it so Kiro can call the tools.

## Decision log

### Deploy: Workers static assets rejects `_redirects` SPA rewrites

The first Cloudflare deploy built cleanly, then failed at `wrangler deploy` with API error 100324 ("Infinite loop detected in this rule") on `/archive/* /archive/index.html 200`. The platform's validator rejects wildcard 200 rewrites whose destination re-matches the source.

`assets.not_found_handling = "single-page-application"` was no fix either, because it falls back only to the root `index.html` and would show the landing page on `/archive/` deep links.

Decision: remove `_redirects` and add a small Worker (`worker/index.js`) that serves assets first, then returns the right app's `index.html` for navigations under `/archive/` or `/inbox/`. Unknown root URLs still return 404. The local test server (`scripts/serve-dist.mjs`) runs the same Worker, so Playwright covers the deep-link behavior before every deploy. Recorded in `design.md` section 12.
