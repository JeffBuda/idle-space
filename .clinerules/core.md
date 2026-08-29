---
paths:
  - "**/*"
---
# Core PWA Constraints

* Always ensure imports use explicit `.ts` or `.tsx` extensions if required by the Vite config.
* If modifying the GitHub Actions CI/CD pipeline (`.github/workflows/`), ensure the pipeline strictly halts on test failures before deploying to GitHub Pages.
* Maintain strict separation between UI components and the `src/engine/` logic.
* **Editor Tool Bug**: Substring matching in `old_text` can double leading whitespace on this Windows + PowerShell setup. When replacing lines with leading whitespace, include the FULL original indentation in both `old_text` and `new_text`, or use `node -e` to write files directly.
* **TypeScript Check**: `npx tsc --noEmit` produces pre-existing TS6305/TS6306/TS6310 errors (stale `.d.ts` files). Use `npm run build` for the authoritative type check.
* **Shell Commands**: `cd /D` fails in PowerShell. Use `Set-Location` or `node -e` with absolute paths.