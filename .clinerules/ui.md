---
paths:
  - 'src/**/*.tsx'
  - 'src/App.tsx'
  - 'src/*.tsx'
---

# React UI Rules

- **One Component per File** Prefer one Component per file to limit file size. File Edit tool works best with small files.
- **State Consumption:** Components should only consume the immutable game state passed down from the core engine. Do not perform game math (e.g., time-to-distance) inside React components.
- **Time-Skip Mechanic:** When implementing active time-skip (clicker) UI elements, ensure progress bars utilize CSS transitions or `requestAnimationFrame` for smooth visual acceleration, independent of the background state processing.
- **iOS Prompts:** Ensure the "Add to Home Screen" installation banner logic relies on `display-mode: standalone` media queries to hide itself once the PWA is properly installed.
- **Accessibility:** Always use `data-testid` attributes for testability. Ensure buttons have proper `type` attributes and accessible labels.
