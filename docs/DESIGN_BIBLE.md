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

---

# PWA Mobile UX Design Bible & Navigation Architecture

> **Normative UX Specification** for all screens, menus, and multi-choice interaction
> flows within the PWA mobile shell. Establishes standard mobile navigation patterns
> optimized for standalone iOS/mobile execution. When a prompt says "follow the PWA
> Mobile UX rules", apply the EXACT patterns below unless a final Poolside Laguna
> spec explicitly overrides them.

## Table of Contents

| #   | Section                     | Anchor                                       |
| --- | --------------------------- | -------------------------------------------- |
| 1   | Imperative Navigation Rules | `#1-imperative-navigation-rules`             |
| 2   | Screen Routing & Transition | `#2-screen-routing--transition-architecture` |
| 3   | Layout Blueprint            | `#3-standard-screen-layout-blueprint`        |
| 4   | iOS Portrait Usability      | `#4-ios-phone-portrait-usability-standard`   |

---

## 1. Imperative Navigation Rules

### ALWAYS

- **Provide explicit, native-feeling back controls on every sub-screen.** In
  standalone iOS PWA mode ("Add to Home Screen"), Safari's default browser chrome
  (including the browser back button) is hidden. Every sub-screen or modal must
  include a clearly visible top-left back button **or** a draggable bottom-sheet
  handle.

- **Place high-frequency primary actions within the "Thumb Zone"** (the bottom 35%
  of the viewport). Primary controls, route confirmation, and navigation tab bars
  must reside where the user's thumb rests naturally.

- **Use dynamic bottom sheets instead of full-screen popups** for contextual
  options. When selecting nodes, viewing planetary data, or configuring multi-stop
  itineraries, slide up a bottom sheet over the interactive map rather than covering
  the screen completely.

- **Preserve navigation state across app backgrounding.** When returning from
  background hibernation, the user must resume on the exact screen, zoom level, and
  drawer state they left, powered by IndexedDB state persistence.

- **Provide immediate visual and haptic/animated feedback within 100ms** of any
  input. Even if the underlying state engine runs asynchronously, buttons must
  immediately visually depress, active state toggles must highlight, and
  transitions must trigger.

- **Maintain a maximum navigation depth of 3 levels.** Structure all screen flows
  as `Primary Hub → Sub-system → Action Modal`. Any flow requiring 4+ steps deep
  must be refactored into a tabbed layout or inline drawer.

- **Ensure touch targets meet minimum spatial requirements** (**44 × 44 px**).
  Small visual elements (such as 12px star map nodes) must implement invisible touch
  hit slops extending to at least 44 × 44 px to accommodate imprecise thumb taps.

### NEVER

- **Rely on browser-native dialogs** (`alert()`, `confirm()`, `prompt()`). These
  break standalone PWA immersion on iOS, lock the main UI thread, and cannot be
  styled to match the game aesthetic.

- **Place destructive or irreversible actions directly adjacent to primary
  navigation buttons.** Place "Clear Route," "Sell All," or "Abandon Mission"
  actions in a secondary visual tier with distinct styling (e.g., ghost/outline
  buttons or red text accents).

- **Force full page reloads or unmount the primary view engine during navigation.**
  Screen transitions must feel like state shifts within a continuous application
  canvas rather than web page hops.

- **Hide navigation state or active context from the user.** If a user is 2 stops
  deep into a multi-stop itinerary, the top bar or persistent sheet must
  continuously indicate the active path count and cumulative time cost.

- **Use tiny top-right "X" icons as the sole closing mechanism on mobile.**
  Top-corner close targets require awkward hand re-gripping on large modern
  smartphones. Use swipe-down gestures or bottom-positioned cancel/close buttons.

### SOMETIMES

- **Use full-screen modals instead of bottom sheets.** Only use full-screen
  overlays when the user enters an active modal state that entirely halts global
  navigation (e.g., active clicker combat encounters or mandatory "Welcome Back"
  idle reward summaries).

- **Disable navigation routing based on game state.** If ship fuel range or
  capacity upgrades are exceeded during route selection, disable the action button
  and swap text to `[ INSUFFICIENT RANGE ]`, but do not prevent the user from
  inspecting the star node itself.

- **Hide persistent navigation chrome.** Hide bottom tab bars or floating action
  buttons (FABs) when the user is actively zooming or dragging the map canvas to
  maximize screen real estate, restoring chrome smoothly on gesture release.

---

## 2. Screen Routing & Transition Architecture

```
                  ┌─────────────────────────────────────────┐
                  │           MAIN MAP HUB (Canvas)          │
                  │  (Persistent Node/Navigation Overlay)   │
                  └────────────────────┬────────────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            ▼                          ▼                          ▼
   ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
   │ BOTTOM SHEET    │        │ FULL-SCREEN     │        │ SYSTEM MODAL    │
   │ (Context Flow)  │        │ VIEW (Sub-Hub)  │        │ (Blocking Flow) │
   ├─────────────────┤        ├─────────────────┤        ├─────────────────┤
   │ Node Selection  │        │ Cargo Market    │        │ Active Combat   │
   │ Route Itinerary │        │ Ship Upgrades   │        │ Welcome Back    │
   │ Planet Scanning │        │ Mission Log     │        │ Offline Summary │
   └─────────────────┘        └─────────────────┘        └─────────────────┘
```

| Container            | Primary Mobile Use Case                       | Entry Animation                          | Exit Animation        | Dismiss Gesture                         |
| -------------------- | --------------------------------------------- | ---------------------------------------- | --------------------- | --------------------------------------- |
| Bottom Sheet (Modal) | Quick choices, route plotting, target info    | Slide up from bottom (250ms ease-out)    | Slide down to bottom  | Swipe down on handle / Tap background   |
| Full-Screen Push     | Complex management screens (Market, Upgrades) | Slide in from right (300ms cubic-bezier) | Slide out to right    | Edge-swipe right / Top-left back button |
| System Overlay       | Mandatory alerts, game loop resolution        | Fade in + Scale up (90%)                 | Fade out + Scale down | Explicit primary button tap             |

### Routing Rules

- The **Main Map Hub** is the persistent root. It is never unmounted; sub-flows
  layer on top of it via z-indexed containers.
- Bottom Sheets are used for transient, reversible context flows. They must not
  block interaction with the underlying map unless a selection is actively in
  progress.
- Full-Screen Views replace the hub's primary content area for complex management
  tasks (Market, Ship Upgrades, Mission Log). Back navigation returns to the
  previous hub state without reload.
- System Overlays are modal-only; they require explicit user action to dismiss and
  are reserved for game-loop-critical interruptions (combat, reward summaries).

---

## 3. Standard Screen Layout Blueprint (The iOS Safe-Area Grid)

Every newly designed mobile screen must map to this structural skeleton:

```
┌─────────────────────────────────────────────────────────┐ 0px
 │  [TOP BAR] App Status / Current Location / Resource Gauges │
 ├─────────────────────────────────────────────────────────┤ Top Safe Area (44px)
 │                                                         │
 │                                                         │
 │                      PRIMARY VIEW                       │
 │                   (Viewport Canvas)                     │
 │                                                         │
 │                                                         │
 ├─────────────────────────────────────────────────────────┤
 │  [INTERACTIVE TIER] Bottom Sheet / Action Drawer         │ Bottom Safe Area
 │  (Thumb Zone: All primary routing & selection choices)  │ Includes iOS Home Bar
 └─────────────────────────────────────────────────────────┘ Viewport Height (100vh)
```

### Zone Rules

| Zone                              | Height        | Interaction Rules                                                                                                                                                       |
| --------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Top Safe Area (Header)**        | 44px          | Read-only metrics, active location status, and main menu trigger. No high-frequency interactive buttons.                                                                |
| **Primary Viewport (Center 65%)** | ~65% of 100vh | Pure spatial data (Star Map canvas, interactive planet renderer, visual progress meters).                                                                               |
| **Bottom Safe Area / Drawer**     | ~35% of 100vh | Interactive controls, choice selections, confirm/cancel logic, and navigation tabs. Must respect `env(safe-area-inset-bottom)` to clear native iOS home indicator bars. |

---

## 4. iOS Phone Portrait Usability Standard

> **Normative.** All interactive UI must conform when rendered on an iPhone in
> **standalone / portrait** mode. If a component cannot meet this standard, it
> must not ship.

### 4.1 Touch Targets — 44 × 44 px minimum

- **Requirement:** every `button`, `select`, toggle, and tappable affordance must expose a
  **minimum 44 × 44 CSS px hit area** (Apple HIG 44 × 44 pt; WCAG 2.1 Target Size
  Enhanced, Level AAA). The most frequent / primary actions (`Launch!`, `Faster!`,
  `Collect Ore`, navigation choices) must be **≥ 48 × 48 px**.
- **Icon-only controls** (`✕` close, gear `⚙️`, iOS banner dismiss) keep their visual glyph but
  pad the invisible hit area to 44 × 44 px with `min-width: 44px; min-height: 44px; padding` —
  never shrink a tap zone below 44 px.
- **Hit-slop rule:** small inline tappables (log rows, status items) must extend their touch target
  to ≥ 44 px; do not rely on the visual element size alone.

### 4.2 Typography — legible on a 5.4"-class screen

- **Body / status values / button labels:** `≥ 17 px` (`1.0625rem`). Apple system body is 17 pt;
  16 px is accepted but 17 px is the portrait baseline on dark backgrounds.
- **Subtext / captions:** `≥ 14 px` (`0.875rem`); debug caption / monospace must not fall below
  13 px.
- Use `font-variant-numeric: tabular-nums` on any live-updating counter (seconds, ore totals) to
  prevent layout shift.

### 4.3 Layout — iPhone Safe-Area Grid (portrait)

- **Prerequisite:** `index.html` MUST set
  `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`
  so `env(safe-area-inset-*)` is live on iOS (notch top ≈ 44 px, home indicator bottom ≈ 34 px on
  iPhone X+ in portrait).
- Fixed **bottom** elements (iOS install banner, slide-up DebugConsole, bottom-pinned action bars)
  sit at `bottom: env(safe-area-inset-bottom)` and pad content by
  `max(var(--space-*), env(safe-area-inset-bottom))` on the bottom edge.
- Centered **modals** (OfflineGreeting, MiningRewardModal) pad their overlay by the safe-area insets
  so the primary button is never hidden under the home indicator.

### 4.4 Thumb Zone & Primary Action Placement

- The most frequent action per screen must live in the **bottom 35 %** of the viewport (the thumb
  zone) and be the **last** element in the screen flow.
- Flow screens (`Welcome`, `SpaceTravel`, `Landing`, `Mining`, `PlanetHub`) render as flex-columns
  (`.flow-screen`) with the primary action wrapped in a bottom-pinned `.flow-actions`
  (`margin-top: auto`), so it is always at the very bottom, above the home-indicator safe area.
- Secondary navigation (e.g. `Back to Planet`) sits directly above the primary action; destructive
  actions are never adjacent to primary buttons.

### 4.5 Button System Consistency

- **All buttons use the canonical system** (`.btn` / `.btn--primary` / `.btn--secondary`). There is
  no `.primary-btn` token.
- **No unstyled buttons.** A bare `<button>` with no component class is a bug — it renders as the
  browser default and fails the 44 px rule on iOS.
- Every `button` has `type="button"` and a `data-testid`.
- Buttons in modal / screen action rows stack **full-width** on mobile
  (`@media (max-width: 600px)`).
