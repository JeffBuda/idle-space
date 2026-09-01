# Tokens

Foundational design values — colors, spacing, typography, shadows, and border
radii. These are consumed by every component. **If Poolside Laguna provides a
new token set, replace the values here and all components update automatically.**

## Color Palette

| Role                  | Token                    | Value                       | Usage                                                       |
| --------------------- | ------------------------ | --------------------------- | ----------------------------------------------------------- |
| Page background       | `--color-bg`             | `#0d1117`                   | `.app`, `.debug-console`, full-screen overlays              |
| Card surface          | `--color-surface`        | `#1a202c`                   | `.status-card`, `.offline-greeting-modal`, `.settings-card` |
| Settings surface      | `--color-surface-alt`    | `#1a1d24`                   | `.settings-card` (slightly lighter)                         |
| Border (default)      | `--color-border`         | `rgba(255, 255, 255, 0.1)`  | card borders, button borders                                |
| Border (subtle)       | `--color-border-subtle`  | `rgba(255, 255, 255, 0.05)` | status-item separators, debug entries                       |
| Text primary          | `--color-text`           | `rgba(255, 255, 255, 0.87)` | body text, headings                                         |
| Text secondary        | `--color-text-secondary` | `rgba(255, 255, 255, 0.7)`  | labels, messages                                            |
| Text muted            | `--color-text-muted`     | `rgba(255, 255, 255, 0.5)`  | captions, subtext, placeholders                             |
| Text dark             | `--color-text-dark`      | `rgba(255, 255, 255, 0.4)`  | log timestamps                                              |
| Accent / positive     | `--color-accent`         | `#4ade80`                   | active values, primary buttons, progress                    |
| Accent hover          | `--color-accent-hover`   | `#68d368`                   | hover state of primary buttons                              |
| Negative / alert      | `--color-negative`       | `#f87177`                   | inactive values, error states                               |
| Blue link / info      | `--color-info`           | `#63b3ed`                   | links, informational text                                   |
| Debug accent (cyan)   | `--color-debug-cyan`     | `rgba(100, 200, 255, 0.8)`  | log action text                                             |
| Debug accent (orange) | `--color-debug-orange`   | `rgba(255, 165, 0, 0.8)`    | log category text                                           |

> **CSS Custom Properties:** All colors, spacing, border-radius, shadows, widths, and
> font sizes are defined as `:root` variables in `src/index.css`. Component CSS
> files reference them via `var(--...)`. Raw hex/rgba values appear ONLY in the
> `:root` block — never in component stylesheets or inline styles.

## `:root` Variable Definitions

All tokens live in **`src/index.css`** under the `:root` selector:

```css
:root {
  /* Colors */
  --color-bg: #0d1117;
  --color-surface: #1a202c;
  --color-surface-alt: #1a1d24;
  --color-white: #ffffff;
  --color-border: rgba(255, 255, 255, 0.1);
  --color-border-subtle: rgba(255, 255, 255, 0.05);
  --color-text: rgba(255, 255, 255, 0.87);
  --color-text-secondary: rgba(255, 255, 255, 0.7);
  --color-text-muted: rgba(255, 255, 255, 0.5);
  --color-accent: #4ade80;
  --color-accent-hover: #68d368;
  --color-negative: #f87177;
  /* ... plus opacity variants, SVG grays, font sizes,
       z-indexes, widths, and heights — see full list below */
}
```

**When overriding with Poolside Laguna specs:** replace the VALUE of each
`--*` property in `:root`. No component CSS needs to change — they all read
via `var(--...)`.

## Spacing Scale

| Token         | Value     | Use Cases                          |
| ------------- | --------- | ---------------------------------- |
| `--space-xs`  | `0.25rem` | icon padding, small gaps           |
| `--space-sm`  | `0.5rem`  | input padding, gear button padding |
| `--space-md`  | `0.75rem` | status-item padding                |
| `--space-lg`  | `1rem`    | settings-toggle margin, gaps       |
| `--space-xl`  | `1.5rem`  | card padding (desktop)             |
| `--space-2xl` | `2rem`    | header padding                     |

## Typography

### Font Stack

```css
font-family:
  Inter,
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  'Helvetica Neue',
  Arial,
  sans-serif;
```

### Scale

| Element                 | Size                     | Weight  | Color                    | Notes                                |
| ----------------------- | ------------------------ | ------- | ------------------------ | ------------------------------------ |
| Page title (`h1`)       | `2rem` (mobile `1.5rem`) | default | `#ffffff`                | In `.app-header`                     |
| Card heading (`h2`)     | `1.25rem`                | default | `#ffffff`                | `.status-card h2`                    |
| Modal heading (`h3`)    | depends                  | default | `#ffffff`                | Titles in modals                     |
| Status label (`.label`) | `1rem`                   | default | `rgba(255,255,255,0.7)`  | Left column of status-row            |
| Status value (`.value`) | `1rem`                   | `600`   | `rgba(255,255,255,0.87)` | Right column; `.active` → `#4ade80`  |
| Body text               | `1rem`                   | `400`   | `rgba(255,255,255,0.87)` | Paragraphs                           |
| Secondary text          | `1rem`                   | `400`   | `rgba(255,255,255,0.7)`  | Subtext, messages                    |
| Caption / muted         | `0.875rem`               | `400`   | `rgba(255,255,255,0.5)`  | Offline greeting subtext             |
| Debug meta              | `0.8rem`                 | `400`   | varies                   | DebugConsole log entries             |
| Debug monospace         | `0.75rem`                | `400`   | `rgba(255,255,255,0.6)`  | Log diffs — `font-family: monospace` |

### iOS Portrait Baseline

On iOS standalone / portrait, enforce these minimums:

- body / status / button labels ≥ 17 px (`--font-size-1` = `1.0625rem`);
- subtext / captions ≥ 14 px (`--font-size-875`);
- debug caption / monospace ≥ 14 px (no `12px` debug text).

### Touch Targets (iOS Portrait)

Every interactive element must expose a minimum 44 × 44 px hit area (Apple HIG /
WCAG 2.1 Target Size Enhanced, Level AAA). Frequent / primary actions
(Launch!, Faster!, Collect Ore) get a 48 × 48 px minimum. Icon-only controls pad
the invisible hit area via `min-width` / `min-height` — the glyph size does not
define the tap zone.

| Token                     | Value  | Usage                                                              |
| ------------------------- | ------ | ------------------------------------------------------------------ |
| `--touch-target-min`      | `44px` | Minimum hit area for every interactive element (DESIGN BIBLE §4.1) |
| `--touch-target-frequent` | `48px` | Frequent / primary actions (Launch!, Faster!, Collect Ore)         |

### Tabular Numerals

Use `font-variant-numeric: tabular-nums;` on any value that updates in real-time
(time, distance, counters) to prevent layout shift.

## Border Radius

| Token                      | Value  | Usage                                              |
| -------------------------- | ------ | -------------------------------------------------- |
| `--radius-card`            | `12px` | `.status-card`, `.settings-card`, `.debug-console` |
| `--radius-modal`           | `16px` | `.offline-greeting-modal` (top corners)            |
| `--radius-button`          | `12px` | `.btn`                                             |
| `--radius-input`           | `6px`  | `.debug-filter`, `.debug-btn`                      |
| `--radius-settings-toggle` | `8px`  | `.settings-toggle`                                 |

## Shadows

| Token                   | Value                                | Usage                                   |
| ----------------------- | ------------------------------------ | --------------------------------------- |
| `--shadow-card`         | `0 12px 48px rgba(0, 0, 0, 0.5)`     | modal depth (`.offline-greeting-modal`) |
| `--shadow-dropdown`     | `0 8px 24px rgba(0, 0, 0, 0.4)`      | `.settings-card` dropdown               |
| `--shadow-console`      | `0 -4px 24px rgba(0, 0, 0, 0.5)`     | `.debug-console` (top edge)             |
| `--shadow-accent-hover` | `0 4px 16px rgba(74, 222, 128, 0.3)` | primary button hover glow               |

## Opacity Modifiers

| Value  | Usage                                                  |
| ------ | ------------------------------------------------------ |
| `0.05` | subtle fills (`rgba(255,255,255,0.05)`) and separators |
| `0.1`  | default borders and fills                              |
| `0.3`  | backgrounds behind content                             |
| `0.7`  | secondary text                                         |
| `0.87` | primary text                                           |
| `0.95` | text on hover/dismiss                                  |
