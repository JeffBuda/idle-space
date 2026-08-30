# Components

Reusable UI patterns with exact HTML + CSS. Copy-paste the structure below.
**Do not invent new patterns** unless the design bible explicitly adds one.

---

## Card (`status-card`)

**Usage:** Any grouped block of status rows (Application Status, Build Info,
Engine stats).

### HTML Structure

```tsx
<section className="status-card">
  <h2>Section Title</h2>
  <div className="status-item">
    <span className="label">Label Name</span>
    <span data-testid="unique-id" className="value">
      Value
    </span>
  </div>
</section>
```

### CSS

```css
.status-card {
  background-color: var(--color-border-subtle);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-card);
  padding: var(--space-xl);
  text-align: left;
}

.status-card h2 {
  font-size: var(--font-size-125);
  margin-bottom: var(--space-lg);
  color: var(--color-white);
}

.status-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) 0;
  border-bottom: 1px solid var(--color-border-subtle);
}

.status-item:last-child {
  border-bottom: none;
}

.label {
  font-size: var(--font-size-1);
  color: var(--color-text-secondary);
}

.value {
  font-weight: 600;
  font-size: var(--font-size-1);
}

.status-item .value.active {
  color: var(--color-accent);
}

.status-item .value.inactive {
  color: var(--color-negative);
}
```

---

## Buttons

### Primary Button (`btn btn--primary`)

```tsx
<button
  type="button"
  className="btn btn--primary"
  data-testid="collect-rewards-btn"
  onClick={onCollectRewards}
>
  Collect Rewards
</button>
```

```css
.btn {
  border: none;
  border-radius: var(--radius-card);
  padding: var(--space-md) var(--space-xl);
  font-size: var(--font-size-1);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  min-width: var(--width-btn-min);
}

.btn--primary {
  background-color: var(--color-accent);
  color: var(--color-bg);
}

.btn--primary:hover {
  background-color: var(--color-accent-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-accent-hover);
}
```

### Secondary Button (`btn btn--secondary`)

```tsx
<button
  type="button"
  className="btn btn--secondary"
  data-testid="dismiss-offline-btn"
  onClick={onDismiss}
>
  Dismiss
</button>
```

````css
.btn--secondary {
  background-color: var(--color-border-subtle);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}


---

## Modal / Overlay

**Base pattern** for OfflineGreeting, GameStateViewer, any centered modal.

```tsx
<div className="modal-overlay" data-testid="modal-name">
  <div className="modal-content">
    <header className="modal-header">
      <h3 data-testid="modal-title">Title</h3>
      <button
        type="button"
        className="modal-close"
        data-testid="modal-close"
        aria-label="Close"
        onClick={onClose}
      >
        ✕
      </button>
    </header>
    <div className="modal-body" data-testid="modal-body">
      {/* content */}
    </div>
  </div>
</div>
````

````css
.modal-overlay {
  position: fixed;
  top: 0; left: 0;
  width: 100%; height: 100%;
  background-color: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal);
  padding: var(--space-lg);
}

.modal-content {
  background-color: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-modal);
  padding: var(--space-2xl);
  max-width: var(--width-modal);
  width: 100%;
  box-shadow: var(--shadow-modal);
  text-align: center;
}

.modal-close {
  background: none;
  border: none;
  font-size: var(--font-size-11);
  cursor: pointer;
  color: var(--color-text-secondary);
  padding: var(--space-xs) var(--space-sm);
  line-height: 1;
}

---

## Settings Menu (Gear Dropdown)

See `SettingsMenu.tsx` + `SettingsMenu.css`. Gear icon `⚙️` reveals an
absolute-positioned dropdown with toggles.

```tsx
<div className="settings-menu" ref={menuRef} data-testid="settings-menu">
  <button
    type="button"
    className="settings-gear"
    data-testid="settings-gear"
    aria-label="Open settings"
    aria-haspopup="true"
    aria-expanded={isOpen}
    onClick={toggleOpen}
  >
    ⚙️
  </button>
  {isOpen && (
    <div className="settings-card" data-testid="settings-card">
      <h3 className="settings-title">Settings</h3>
      <button
        type="button"
        className={`settings-toggle ${active ? 'settings-on' : 'settings-off'}`}
        data-testid="toggle-name"
        onClick={() => { onToggle(); setIsOpen(false); }}
      >
        {active ? 'Hide' : 'Show'} Name
      </button>
    </div>
  )}
</div>
````

### Rules

- Dropdown: `position: absolute; top: 100%; right: 0; z-index: var(--z-dropdown)`.
- Click-outside dismissal via `document.addEventListener('mousedown')`.
- Active toggle: border + text = `var(--color-accent)`. Inactive: border `var(--color-border)`, text `var(--color-text-muted)`.
- Label toggles between "Show X" / "Hide X".

---

## Slide-Up Console Panel

See `DebugConsole.tsx` + `DebugConsole.css`. Bottom-anchored panel.

```css
.debug-console {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: var(--height-debug-viewport);
  max-height: var(--height-debug-max);
  background-color: var(--color-bg);
  border-top: 1px solid var(--color-border);
  border-radius: var(--radius-card) var(--radius-card) 0 0;
  z-index: var(--z-console);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: var(--shadow-console);
  animation: slide-up 0.3s ease-out;
}

@keyframes slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}
```

### Rules

- z-index: var(--z-console) (below modal overlays at var(--z-modal)).
- Height: var(--height-debug-viewport) max, capped at var(--height-debug-max).
- Animation: slide-up 0.3s ease-out on mount
- Header: flex, space-between, close button top-right

.modal-close:hover { color: var(--color-white); }
.modal-close:focus-visible { outline: 2px solid var(--color-focus-outline); outline-offset: 2px; border-radius: var(--radius-small); }

```

### Modal Rules

- z-index: var(--z-modal) for overlay; backdrop var(--color-overlay).
- Modal top border radius: var(--radius-modal).
- Close button: top-right, `✕`, aria-label="Close", type="button".
- Body center-aligned; action buttons bottom-aligned in a flex row.
.btn--secondary:hover {
  background-color: var(--color-border);
  color: var(--color-text-strong);
}
```

### Button Rules

- ALWAYS `type="button"` (never omit).
- ALWAYS has `data-testid`.
- ALWAYS has `aria-label` if the button content is an icon/emoji only.
- Button groups: `display: flex; gap: var(--space-lg); justify-content: center; flex-wrap: wrap;`
- Mobile: buttons stack full-width inside modal action containers.

### Rules

- ALWAYS use `data-testid` on `.value` spans — never on `.label`.
- ALWAYS separate label/value into a `.status-item` row.
- ALWAYS add `.active` or `.inactive` class to `.value` when the value conveys state.

---

## Page Header

```tsx
<header className="app-header">
  <h1>Space Exploration Idle PWA</h1>
  <SettingsMenu ...props />
</header>
```

---

## Main Layout

```tsx
<div className="app">
  <header className="app-header">...</header>
  <main>...</main>
  {/* Overlays mounted last, outside main */}
  <OfflineGreeting ... />
  <IOSInstallBanner />
  <DebugConsole ... />
  <GameStateViewer ... />
</div>
```
