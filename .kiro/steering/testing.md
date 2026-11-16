# Testing

- Vitest for unit tests, fast-check for properties, fake-indexeddb for IndexedDB, Playwright for e2e, axe-core for accessibility.
- Write the property first when the code is a parser, normalizer, store, registry or gate.
- The property list is P1-P14 in `.kiro/specs/seance-kit/design.md`. Name tests with their ID, for example `P3 import is idempotent`.
- Storage adapters share one contract suite. A new adapter must pass it unchanged.
- Mock provider scripts make agent tests deterministic. Never call real LLMs in CI.
- Fixtures are small and sanitized. No real personal data.
- When a property fails, keep the shrunk counterexample as a regression example test.
- Every milestone needs: typecheck, lint, tests and build green, then a deploy check.
- Playwright smoke tests must assert the Demo badge is present under Mock and absent under a fake real provider.
- CI also runs the `.kiro`-not-ignored check and the template generation check.
