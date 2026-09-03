---
paths:
  - '**/*'
---

# Core PWA Constraints

- Always ensure imports use explicit `.ts` or `.tsx` extensions if required by the Vite config.
- If modifying the GitHub Actions CI/CD pipeline (`.github/workflows/`), ensure the pipeline strictly halts on test failures before deploying to GitHub Pages.
- Maintain strict separation between UI components and the `src/engine/` logic.
- **Editor Tool Bug**: Substring matching in `old_text` can double leading whitespace on this Windows + PowerShell setup. When replacing lines with leading whitespace, include the FULL original indentation in both `old_text` and `new_text`, or use `node -e` to write files directly.
- **TypeScript Check**: `npx tsc --noEmit` produces pre-existing TS6305/TS6306/TS6310 errors (stale `.d.ts` files). Use `npm run build` for the authoritative type check.
- **Shell Commands**: `cd /D` fails in PowerShell. Use `Set-Location` or `node -e` with absolute paths.
- **GitHub CLI (gh)**: Installed at `C:\Program Files\GitHub CLI\gh.exe`. Add `C:\Program Files\GitHub CLI` to PATH, or invoke directly: `& "C:\Program Files\GitHub CLI\gh.exe" pr create --title "..." --body "..." --base main --head <branch>`.
- **Formatting Workflow**: Always run Prettier in fix mode FIRST (`npm run format`) to auto-format all code before running tests. Then run `npm run test` to verify all code works. Then run `npm run build` to verify the production build succeeds. **Never use text editor tools, custom scripts (.cjs files), or manual find/replace to fix code formatting — always run `npm run format` instead.** Prettier handles all formatting automatically.
- **Formatting Tooling**: This project uses Prettier (`npm run format`) for comprehensive code formatting, integrated with ESLint via `eslint-config-prettier` to disable conflicting rules. Prettier config lives in `.prettierrc.cjs` with ignores in `.prettierignore`. **Do not use editor tools or `.cjs` scripts for formatting fixes — only Prettier auto-formats code.** The workflow is: `npm run format` -> `npm run test` -> `npm run build`.
- **Terminal Hygiene (Windows PowerShell/CLI)**: When executing Windows PowerShell or CLI commands, you MUST strictly follow these rules to prevent the terminal from hanging:
  - **NO PAGERS**: Never use commands that open interactive pagers. Always set `GIT_PAGER=cat` or use `git --no-pager`.
  - **PACKAGE MANAGERS**: Always run npm, yarn, pnpm, and npx in non-interactive/CI mode.
    - Prepend `CI=true` to environments if possible.
    - Always append `--yes` or `-y` to `npm init`, `npx create-*`, or package installs to bypass "Are you sure?" prompts.
  - **POWERSHELL COMMANDS**: Always append `-Force` and `-Confirm:$false` to destructive PowerShell cmdlets (like `Remove-Item` or `Stop-Process`) to bypass confirmation prompts.
  - **BACKGROUND PROCESSES**: If starting a persistent dev server (e.g., `npm run dev`, `npx vite`), you must acknowledge that it will block the terminal. Do NOT wait for it to finish. If you need to run it in the background, use `Start-Process -NoNewWindow` or explicitly state you are leaving it running.
  - **NO EDITOR LAUNCHES**: Never run commands that open GUI editors (like `code .` or `notepad`) as this can halt the execution loop.
- **Work Session Hygiene**: New work sessions should always start by pulling the latest `main` and creating a new feature branch off of it, ensuring a clean separation from any existing in-progress work.
- **Deterministic Seeds in Tests**: Always use a fixed, repeatable RNG seed in test environments. In E2E/Playwright tests, override `Math.random()` via `page.addInitScript(() => { Math.random = () => 0.1; })` in a `beforeEach` hook so procedurally-generated data (e.g., star map graphs) is reproducible. Non-deterministic seeds cause flaky CI failures when random extra-edges violate test adjacency assumptions (observed: ~15% failure rate for sys_5 <-> sys_1 adjacency).
