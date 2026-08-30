# Design Bible — Space Exploration Idle PWA

> **Single source of truth for all UX/UI work.** When this file exists and is
> up-to-date, **always read it before implementing any UI or component
> change.** Override these defaults with final Poolside Laguna specs.
>
> **How to use this file:** Each section maps to a concrete, copy-pasteable
> convention (CSS class, HTML structure, `data-testid`, hover state). When a
> prompt says "follow the design bible", read the relevant section and apply
> the EXACT pattern — including class names, tokens, and test IDs — unless the
> design bible explicitly overrides a rule.

## Table of Contents

| #   | Section     | File                               | What's Inside                                                        |
| --- | ----------- | ---------------------------------- | -------------------------------------------------------------------- |
| 1   | Tokens      | [tokens.md](./tokens.md)           | Colors, spacing, typography, shadows, border-radius                  |
| 2   | Components  | [components.md](./components.md)   | Card, header, button, modal, status-row, settings gear               |
| 3   | Conventions | [conventions.md](./conventions.md) | testIDs, accessibility, motion, responsive, file structure, scaffold |

## How I Apply This

When you give me a vague prompt like _"add a ship status panel"_, I will:

1. Read **`docs/DESIGN_BIBLE.md`** and the referenced section files.
2. Match the pattern (tokens + component structure + `data-testid` naming).
3. Generate `.tsx` + `.css` that is **pixel-identical in convention** to existing
   components (App, OfflineGreeting, DebugConsole, SettingsMenu).
4. Include co-located `.test.tsx` that queries by `data-testid` / roles only.
5. Run `npm run format` → `npm run test` → `npm run build` before finishing.

## Override Policy

| Source                                                     | Priority                             |
| ---------------------------------------------------------- | ------------------------------------ |
| Poolside Laguna final specs                                | Highest — overrides everything below |
| `docs/DESIGN_BIBLE.md`                                     | Follow unless contradicted           |
| Existing code conventions (App.tsx, OfflineGreeting, etc.) | Baseline fallback                    |

## Quick Reference (TL;DR)

```css
/* Raw values live ONLY in :root (src/index.css) */
:root {
  --color-bg: #0d1117; /* page */
  --color-surface: #1a202c; /* card surface */
  --color-border: rgba(255, 255, 255, 0.1); /* default */
  --color-border-subtle: rgba(255, 255, 255, 0.05); /* subtle separator */
  --color-accent: #4ade80; /* accent-green */
  --color-negative: #f87177; /* accent-red */
  --radius-card: 12px;
  --radius-modal: 16px;
}

/* Component CSS — ALWAYS use var(--...) */
background: var(--color-bg);
background: var(--color-surface);
border: 1px solid var(--color-border);
border: 1px solid var(--color-border-subtle);
color: var(--color-accent);
color: var(--color-negative);
border-radius: var(--radius-card);
border-radius: var(--radius-modal);

font-family:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  sans-serif;

@media (max-width: 600px) {
  /* mobile */
}
```

```tsx
// Every interactive element MUST have:
<button type="button" data-testid="descriptive-name" aria-label="...">
```
