# Product

Séance Kit is a local-first template for AI agent workspaces, with two apps built on it: **Archive Séance** (chat archives) and **Inbox Exorcist** (email archives from `.mbox`/`.eml`).

## Principles

- Local-first. User data stays in the browser (IndexedDB). No backend, no accounts, no hosted LLM proxy.
- The template is the product. Apps prove it. App-specific code never goes in `packages/core`.
- Honest demo. The Mock provider always shows a "Demo mode" badge. Never imply a scripted reply came from a real model.
- Safe by default. The agent asks before any write or destructive action. Deletion is soft (Banish) with undo. The agent never sends email.
- UI polish is our edge. Prefer fewer features that feel finished.

## Hard rules

- Never build dead-code tooling.
- Gmail OAuth, browser MCP client, semantic search and light mode are cut. Do not start them.
- `.kiro` stays tracked and out of `.gitignore`.
- Submission target is Dec 3, 2026 (deadline Dec 4, 2:00 PM PT).

## Specs

The source of truth is `.kiro/specs/seance-kit/` (requirements, design, tasks, submission).
