# Design language

Dark only. A calm, professional product UI in the spirit of Linear and Claude.ai: neutral surfaces, one accent, clear hierarchy. The Kiroween flavor lives in names and copy (对话降灵, 收件箱驱魔, Resurrect, Banish), not in decoration.

## Tokens (defined once in `packages/ui/src/tokens.css`)

- Neutrals: bg `#0A0A0B`, surface `#111113`, raised `#18181B`, surface-3 `#212125`, line `#26262B`, field border `edge` `#5C5C66`
- Text: fg `#EDEDEF`, fg-2 `#B4B4BB`, muted `#8B8B94`, disabled `#5F5F68`
- Accent (indigo-violet): fill `#5B5BD6` with white text; accent-text `#A5A8FF` for links, selection and focus
- Status, by meaning only: amber `#F5A524` = waiting for approval and Demo mode; danger `#E5484D` = destructive; success `#46A758`
- Never hard-code colors in apps. Use tokens. Verify any new pair meets WCAG AA.

## Type and spacing

- One scale: 12 caption, 13 meta, 14 UI, 15 reading, 16 card title, 18 dialog title, 24 reader title, 32 section heading, 56/64 display. Nothing below 12 px. Weights 400/500/600.
- No uppercase labels, no letter-spacing on CJK. 4 px spacing grid.
- Controls share one height scale: 28 / 32 (default) / 40.
- Radii: 6 controls, 8 cards and menus, 12 dialogs and the composer.
- Two border colors only: `line` for structure, `edge` for form fields.

## Rules

- Signature element: the agent timeline (prompt, quiet tool rows, approval card, reply). A pending approval shows a small pulsing amber dot, and a static dot under `prefers-reduced-motion`.
- Exactly one primary button per view or dialog step.
- Motion is functional only: 100-200 ms for hover, open and select; a spinner for running steps; a caret for streaming text. No decorative or ambient animation. `prefers-reduced-motion` turns animation off.
- Layout: three panes (library, content, agent). Everything reachable by ⌘K / Ctrl+K and keyboard.
- Spooky labels (Resurrect, Banish) are fine, but tooltips and empty states say plainly what happens.
- The "Demo mode" badge is persistent, visible and not dismissible whenever the Mock provider is active.
- Icons: `lucide-react`, 16 px in controls, stroke 1.5. No unicode glyphs as icons.
- Focus rings are always visible. Use semantic HTML and Radix for accessible primitives.
- Zero serious or critical axe violations on every main screen.
- Self-host fonts. Inter for UI with system CJK fonts, JetBrains Mono for tool input and output.
