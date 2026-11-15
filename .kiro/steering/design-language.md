# Design language

Dark only. "Candlelit": quiet, refined, a little eerie. Not a kitschy Halloween look.

## Tokens (defined once in `packages/ui`)

- Background `#0B0A10`, surface `#14121C`, raised `#1D1A28`, border `#2A2638`
- Text `#E8E6F0`, muted `#9A96AD`
- Ectoplasm accent `#7CF2B6`, candle amber `#F2B35E` (approvals), blood `#E5636F` (destructive)
- Never hard-code colors in apps. Use tokens. Verify any new pair meets WCAG AA.

## Rules

- Signature element: the séance timeline (vertical line, candle-glow nodes, steps fade in). Pending approvals pulse amber, and show a static ring under `prefers-reduced-motion`.
- Motion under 200 ms, purposeful, no decorative loops. Respect `prefers-reduced-motion`.
- Layout: three panes (library, content, agent). Everything reachable by ⌘K / Ctrl+K and keyboard.
- Spooky labels (Resurrect, Banish) are fine, but tooltips and empty states say plainly what happens.
- The "Demo mode" badge is persistent, visible and not dismissible whenever the Mock provider is active.
- Focus rings are always visible. Use semantic HTML and Radix for accessible primitives.
- Zero serious or critical axe violations on every main screen.
- Self-host fonts. Humanist sans for UI, monospace for tool input/output.
