# Séance Kit

A local-first template for building AI agent apps in an afternoon, plus two apps built with it.
Kiroween 2026 entry, category Skeleton Crew.

- **Archive Séance** (`apps/archive-seance`): import, search, summarize and resurrect old AI chats.
- **Inbox Exorcist** (`apps/inbox-exorcist`): triage `.mbox` / `.eml` email archives. Never sends mail.

Live demo: _URL goes here once the Cloudflare Pages deploy is verified (task 0.9)._

> Status: scaffolding (milestone M0). The apps are shells. See `.kiro/specs/seance-kit/tasks.md`.

## Develop

Requires Node 20+ and pnpm 9.

```
pnpm install
pnpm --filter @seance/archive-seance dev   # or @seance/inbox-exorcist, @seance/site
pnpm typecheck && pnpm lint && pnpm test
pnpm build                                  # assembles dist/ (/, /archive/, /inbox/)
pnpm e2e                                    # Playwright smoke tests against dist/
```

## Layout

See `.kiro/steering/structure.md`. The spec lives in `.kiro/specs/seance-kit/`.

## License

MIT
