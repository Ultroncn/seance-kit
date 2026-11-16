# Design language

Dark only. "Candlelit": quiet, refined, a little eerie. Not a kitschy Halloween look.

## Tokens (defined once in `packages/ui`)

- Background `#0B0A10`, surface `#14121C`, raised `#1D1A28`, border `#2A2638`
- Text `#E8E6F0`, muted `#9A96AD`
- Ectoplasm accent `#7CF2B6`, candle amber `#F2B35E` (approvals), blood `#E5636F` (destructive)
- Never hard-code colors in apps. Use tokens. Verify any new pair meets WCAG AA.

## Rules

- Signature element: the séance timeline (vertical line, candle-glow nodes, steps fade in). Pending approvals pulse amber, and show a static ring under `prefers-reduced-motion`.
- Interaction motion (hover, open, select, list changes) stays under 200 ms and purposeful.
- Slow ambient motion is allowed only where it carries meaning: the landing hero, a running step, a pending approval, streaming text. Keep it subtle (low contrast, slow), never behind text people are reading.
- Landing sections may rise in once as they scroll into view (at most 600 ms). Apps never animate content in on scroll.
- `prefers-reduced-motion` turns every animation off and keeps a static equivalent (glow, ring, cursor).
- Layout: three panes (library, content, agent). Everything reachable by ⌘K / Ctrl+K and keyboard.
- Spooky labels (Resurrect, Banish) are fine, but tooltips and empty states say plainly what happens.
- The "Demo mode" badge is persistent, visible and not dismissible whenever the Mock provider is active.
- Focus rings are always visible. Use semantic HTML and Radix for accessible primitives.
- Zero serious or critical axe violations on every main screen.
- Self-host fonts. Humanist sans for UI, monospace for tool input/output.
