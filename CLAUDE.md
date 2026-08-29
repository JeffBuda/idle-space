# CLAUDE.md — Project Context for AI Agents

> Quick reference for agents working on this repo. Complements `README.md`
> (user-facing docs) and `MEMORY.md` (feature development notes).

---

## TL;DR — Most common pitfalls

| Pitfall | What to do |
|---|---|
| Manifest `start_url` 404s on GitHub Pages | Use **relative** paths in VitePWA `manifest` config (`start_url: '.'`, `src: 'icons/...'`) — Vite's `base` does **not** prefix manifest fields |
| TypeScript check shows TS6305/TS6306/TS6310 | Pre-existing config issues. Use `npm run build` for the real type check |
| `cd /D` fails in shell | Use `Set-Location` or `node -e` with absolute paths instead |
| Editor tool doubles indentation | Include full leading whitespace in `old_text`, or use `node -e` to write files |

---

## 1. PWA Manifest Paths — The #1 Gotcha

**The bug**: Setting `start_url: '/'` or `src: '/icons/...'` in the VitePWA
`manifest` config produces a manifest with **absolute** paths. On GitHub Pages,
these resolve to the domain root (`https://JeffBuda.github.io/`) instead of the
app's subpath (`https://JeffBuda.github.io/idle-space/`), causing a 404 when
a user launches from the home screen icon.

**Why it happens**: Vite's `base` option (`/idle-space/`) automatically prefixes
HTML `<link>`, `<script>`, and service-worker registration URLs, but it does
**not** touch the Web App Manifest content. The manifest's `start_url` and
`icons[].src` are passed through verbatim.

**The fix** (matches the Scoresceror pattern at `C:\Users\jeffr\git\Scoresceror`):

```ts
// vite.config.ts — use RELATIVE paths in the manifest config
manifest: {
  start_url: '.',           // ← relative, resolves to /idle-space/
  icons: [
    { src: 'icons/pwa-192x192.png', ... },  // ← relative
    { src: 'icons/pwa-512x512.png', ... },  // ← relative
  ],
}
```

Per the [Web App Manifest spec](https://www.w3.org/TR/appmanifest/), relative
URLs in the manifest resolve against the manifest file's own URL. Since the
manifest is served at `/idle-space/manifest.webmanifest`, `'icons/...'`
correctly resolves to `/idle-space/icons/...`.

**Verify after build**:
```bash
npm run build
# Check the generated manifest:
cat dist/manifest.webmanifest | node -e "const m=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log(m.start_url, m.scope, m.icons[0].src)"
```

---

## 2. Deploy Process

- **Trigger**: Push to `main` (or open a PR to `main`)
- **CI/CD**: `.github/workflows/deploy.yml` runs `npm ci`, tests, E2E, then
  builds and deploys `dist/` to GitHub Pages
- **Live URL**: `https://JeffBuda.github.io/idle-space/`
- `dist/` is gitignored — never commit it; the CI pipeline builds from source

---

## 3. Shell & Tooling Environment

### Commands that DON'T work in this Windows + PowerShell environment
- `cd /D C:\path` — the PowerShell profile's `Set-Location` wrapper intercepts
  the `/D` flag and throws "Cannot find path 'C:\D'"
- → **Use**: `Set-Location C:\path` or `node -e "..."` with absolute paths

### TypeScript check
- `npx tsc --noEmit` produces **pre-existing** TS6305/TS6306/TS6310 errors
  (stale `.d.ts` files and composite project config) — these are NOT real
  issues and exist before any changes
- → **Use** `npm run build` (Vite's esbuild-based type check is authoritative)

### Editor tool
- Substring matching in `old_text` can double leading whitespace (the existing
  indentation + new indentation from `new_text`)
- → When replacing lines with leading whitespace, include the **full** original
  indentation in both `old_text` and `new_text`, or use `node -e` to write the
  file directly

---

## 4. Cross-references

- `README.md` — project overview, getting started, tech stack table
- `MEMORY.md` — detailed feature development notes (testing conventions, file
  layout, gotchas from Phase 1 iOS install banner work)
- `C:\Users\jeffr\git\Scoresceror` — sibling PWA project with a working
  GitHub Pages + VitePWA setup (reference implementation for manifest paths)