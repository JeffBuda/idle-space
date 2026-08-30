# Space Exploration Idle PWA

A Progressive Web App (PWA) built with **React 18**, **TypeScript**, and **Vite**, designed for offline play via service worker caching and IndexedDB persistence.

## Overview

This project is the Phase 1 foundation of the Space Exploration Idle game. It includes:

- **PWA Shell** — Standalone display mode, Web App Manifest, and service worker via `vite-plugin-pwa`.
- **Testing Pyramid**:
  - **Unit** — Vitest with pure logic tests (`src/engine/`).
  - **Component** — Vitest + React Testing Library + jsdom (`src/App.test.tsx`).
  - **E2E** — Playwright (Chromium + WebKit) (`tests/e2e/`).
- **CI/CD** — GitHub Actions pipeline that runs all tests and deploys to GitHub Pages.

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Run unit + component tests
npm run test

# Run E2E tests (requires browsers)
npx playwright test
```

## Build & Deploy

```bash
npm run build      # Production build to dist/
npm run preview    # Serve production build locally
```

Pushing to `main` triggers the CI/CD pipeline which builds, tests, and deploys to GitHub Pages automatically.

## Technologies

| Category        | Tool                                                |
| --------------- | --------------------------------------------------- |
| Framework       | React 18, TypeScript (strict)                       |
| Build           | Vite 5                                              |
| PWA             | vite-plugin-pwa, idb (IndexedDB)                    |
| Unit Tests      | Vitest 2, jsdom                                     |
| Component Tests | @testing-library/react, @testing-library/user-event |
| E2E Tests       | Playwright (Chromium + WebKit)                      |
| CI/CD           | GitHub Actions, GitHub Pages                        |
