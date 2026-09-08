# Gopeshwar Stationary House (GSH)

AI-powered retail intelligence for a stationery shop. Android-first, web-secondary.
appId: `com.gopeshwar.stationaryhouse`

## What's actually here right now

- **`preview/index.html`** — the real, working, tested application. Login, Command
  Center, Inventory (incl. real Excel import), Vendors, Purchases, Money/Expenses,
  Reports, Seasonal, and Ask GSH AI (a grounded query engine, not a chatbot) all live
  here as one self-contained HTML/CSS/JS file with local-first persistence
  (`window.storage`) and an offline sync outbox. This is what `npm run build` packages
  for Capacitor.
- **`server/`** — TypeScript services and routes for the production backend
  (Prisma-based): purchase posting, daily closing, AI assistant, OCR, voice parsing,
  sync push/pull. Structurally checked (see docs/ARCHITECTURE.md) but **never run
  against a live database** — no network/DB access in the environment that built this.
- **`prisma/schema.prisma`** — the canonical data model, including the Phase 1 sync
  design (see `docs/SYNC_PROTOCOL.md`).
- **`src/data/repositories/`** — TypeScript interfaces the eventual componentized UI
  will depend on; not yet wired to actual UI components (that's still `preview/index.html`).

## What is NOT here yet (be aware before assuming otherwise)

- No deployed backend, no live Postgres database, no real authentication server.
- No committed `android/` folder — it's `.gitignore`'d and generated fresh by CI
  (see below) via `npx cap add android`, so it's never gone stale from what
  `capacitor.config.ts` actually specifies.
- No `package-lock.json` yet — `npm install` is used instead of `npm ci` in CI until
  one is generated and committed.
- Login is still OTP-based in the UI; migrating to User ID + Password is tracked but
  not done.

## Build locally

```bash
npm install
npm run build          # packages preview/index.html into dist/index.html
npx cap add android     # first time only — generates the android/ project
npx cap sync android
cd android && ./gradlew assembleDebug
```

Debug APK output: `android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions

`.github/workflows/android-apk.yml` runs the same steps above on every push to
`main` (and on manual trigger) and uploads the resulting debug APK as a workflow
artifact named `gsh-debug-apk`. See that file for the exact steps — nothing in it
is invented; every command is one you can also run locally.

## Pushing this repo to GitHub

```bash
git init
git add .
git commit -m "GSH: GitHub + Android CI setup"
git branch -M main
git remote add origin https://github.com/<your-username>/gsh-app.git
git push -u origin main
```

Then: GitHub → your repo → **Actions** tab → run "Android APK" (or just push to
`main`, which triggers it automatically) → open the completed run → download the
`gsh-debug-apk` artifact.

## Docs

- `docs/ARCHITECTURE.md` — folder layout and the repository-pattern seam
- `docs/API_CONTRACTS.md` — REST surface the repositories will eventually call
- `docs/SYNC_PROTOCOL.md` — local-first outbox + Phase 1/Phase 2 sync design
