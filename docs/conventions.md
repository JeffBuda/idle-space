# Conventions

Cross-cutting rules for every component, test, and file.

---

## File Structure

```
src/
├── App.tsx        # Root — orchestrates UI, no game math
├── main.tsx       # Entry (createRoot, SW registration)
├── index.css      # Global reset + :root font stack
├── db/             # IndexedDB (idb wrapper) — no game logic
├── engine/         # Pure functions only — no React imports
├── hooks/          # React ↔ engine bridge
├── components/     # Presentational only — receive props
├── logging/        # Diagnostic logging (separate from engine)
└── utils/          # Pure utility functions
```

### Rules

- ONE `.tsx` + ONE `.css` per component; base name must match.
- Tests co-located: `Component.test.tsx`.
- Engine: `(prevState, currentTime, seed)` — deterministic, no Date.
- Components only consume props — no game math inside JSX.

---

## data-testid Naming

Query by these — **never** by CSS class or text content.

| Pattern         | Example                            |
| --------------- | ---------------------------------- |
| kebab-case      | `sw-status`, `collect-rewards-btn` |
| with dynamic id | `log-entry-{id}`                   |

### Existing TestIDs (MUST NOT BREAK)

| Component        | testID                                                                                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App              | `sw-status`, `db-status`, `install-status`, `total-travel-time`, `total-distance`, `app-version`, `build-date`                                                                   |
| SettingsMenu     | `settings-menu`, `settings-gear`, `settings-card`, `toggle-debug-console`, `toggle-game-state`                                                                                   |
| OfflineGreeting  | `offline-greeting`, `offline-time-display`, `collect-rewards-btn`, `dismiss-offline-btn`                                                                                         |
| DebugConsole     | `debug-console`, `debug-title`, `debug-close`, `debug-filter`, `debug-refresh`, `debug-clear`, `debug-export`, `debug-loading`, `debug-empty`, `log-entry-{id}`, `log-diff-{id}` |
| GameStateViewer  | `game-state-viewer`, `game-state-backdrop`, `game-state-title`, `game-state-close`, `game-state-content`, `game-state-json`, `game-state-empty`                                  |
| IOSInstallBanner | `ios-install-banner`, `ios-install-dismiss`                                                                                                                                      |

### Rules

- ALWAYS `data-testid` on component root element.
- ALWAYS `data-testid` on every interactive element (button, select).
- Use on `.value` spans in status rows, NOT on `.label`.

---

## Accessibility (a11y)

---

## Motion & Animation

| Element              | Animation                                       |
| -------------------- | ----------------------------------------------- |
| Modal / panel mount  | `slide-up 0.3s ease-out` (from bottom)          |
| Button hover         | `transition: all 0.2s ease`                     |
| Primary button hover | `transform: translateY(-1px)` + box-shadow glow |

Animate transform/opacity only — never layout properties (width/height).

---

## Responsive Design

**Breakpoint:** `@media (max-width: 600px)`

| Element         | Desktop  | Mobile                   |
| --------------- | -------- | ------------------------ |
| Page title (h1) | 2rem     | 1.5rem                   |
| Card padding    | 1.5rem   | 1rem                     |
| Modal padding   | 2rem     | 1.5rem                   |
| Modal actions   | flex-row | flex-column (full width) |

```css
@media (max-width: 600px) {
  .btn {
    width: 100%;
  }
  .offline-greeting__actions {
    flex-direction: column;
    gap: 0.75rem;
  }
}
```

---

## Component Scaffold (Copy-Paste Template)

New component files: `MyComponent.tsx`, `MyComponent.css`, `MyComponent.test.tsx`

### MyComponent.tsx

```tsx
import React from 'react';
import './MyComponent.css';

export interface MyComponentProps {
  visible: boolean;
  onClose: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ visible, onClose }) => {
  if (!visible) return null;
  return (
    <div className="my-component" data-testid="my-component">
      <button
        type="button"
        className="btn btn--primary"
        data-testid="my-component-action"
        aria-label="Do thing"
        onClick={() => {}}
      >
        Do Thing
      </button>
    </div>
  );
};
export default MyComponent;
```

### MyComponent.test.tsx

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders root element', () => {
    render(<MyComponent visible={true} onClose={vi.fn()} />);
    expect(screen.getByTestId('my-component')).toBeInTheDocument();
  });
  it('does not render when hidden', () => {
    render(<MyComponent visible={false} onClose={vi.fn()} />);
    expect(screen.queryByTestId('my-component')).not.toBeInTheDocument();
  });
});
```

---

## Testing Rules (Vitest)

| Requirement  | Details                                             |
| ------------ | --------------------------------------------------- |
| Test queries | `data-testid` + accessible roles — NO CSS classes   |
| Mocking      | `vi.mock()` for hooks at test-file level            |
| `matchMedia` | Already mocked in `vitest.setup.ts`                 |
| `renderHook` | `@testing-library/react` v14 only                   |
| Commands     | `npm run test` runs all `src/**/*.test.{ts,tsx}`    |
| Pre-flight   | `npm run format` → `npm run test` → `npm run build` |

---

## CSS Conventions

| Rule               | Details                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frameworks         | **None** — plain CSS only (no Tailwind)                                                                                                          |
| File per component | Same base name: `MyComponent.tsx` + `MyComponent.css`                                                                                            |
| Import order       | CSS import last in the `.tsx` import block                                                                                                       |
| Selectors          | Class-based (`.my-component`), not element-based                                                                                                 |
| Units              | rem for spacing, hex/rgba only inside `:root` variables                                                                                          |
| Mobile             | `@media (max-width: 600px)` at bottom of file                                                                                                    |
| **Variables**      | **ALL** colors, spacing, border-radius, shadows, and widths MUST use `var(--...)`. Raw hex/rgba appear only in the `:root` block in `index.css`. |

### Accessibility (a11y)

| Requirement       | Details                                  |
| ----------------- | ---------------------------------------- |
| Button type       | ALWAYS `type="button"`                   |
| Icon-only buttons | MUST have `aria-label`                   |
| Dropdown buttons  | `aria-haspopup="true"` + `aria-expanded` |
| Focus styles      | `:focus-visible` for keyboard nav        |
| Close buttons     | `aria-label="Close"`                     |

```css
*:focus-visible {
  outline: 2px solid var(--color-focus-outline);
  outline-offset: 2px;
  border-radius: var(--radius-small);
}
```
