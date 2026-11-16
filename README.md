# Séance Kit

A local-first template for building AI agent apps in an afternoon, plus two apps built with it.
Kiroween 2026 entry, category Skeleton Crew.

- **Archive Séance** (`apps/archive-seance`): import, search, summarize and resurrect old AI chats.
- **Inbox Exorcist** (`apps/inbox-exorcist`): triage `.mbox` / `.eml` email archives. Never sends mail.

Live demo: https://seance-kit.mask988888888.workers.dev/ ([Archive Séance](https://seance-kit.mask988888888.workers.dev/archive/), [Inbox Exorcist](https://seance-kit.mask988888888.workers.dev/inbox/))

> Status: Archive Séance works end to end (milestone M2). Inbox Exorcist is next. See `.kiro/specs/seance-kit/tasks.md`.

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
