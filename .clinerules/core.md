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
- **Formatting Workflow**: Always run Prettier in fix mode FIRST (`npm run format`) to auto-format all code before running tests. Then run `npm run test` to verify all code works. Then run `npm run build` to verify the production build succeeds. Never manually fix formatting — Prettier handles it automatically.
- **Formatting Tooling**: This project uses Prettier (`npm run format`) for comprehensive code formatting, integrated with ESLint via `eslint-config-prettier` to disable conflicting rules. Prettier config lives in `.prettierrc.cjs` with ignores in `.prettierignore`. The workflow is: `npm run format` -> `npm run test` -> `npm run build`.
