# Atomic — Habit Streak Tracker

A MEAN-stack habit tracker built around James Clear's *Atomic Habits*: identity-based habits, the Four Laws of Behavior Change (cue, craving, response, reward), habit stacking, streaks, a habit scorecard, weekly reviews, and a completion trend chart.

## Stack

- **Client**: Angular 17 (standalone components, signals) + [Capacitor](https://capacitorjs.com/) for the native Android app
- **Server**: Node.js + Express 5 + Mongoose 9 (MongoDB)
- **Auth**: JWT bearer tokens, bcrypt-hashed passwords, a strong server-enforced password policy
- **Reminders**: local notifications on the device (`@capacitor/local-notifications`), timezone-aware per user

## Features

- Identity, cue, 2-minute version, reward, and habit stacking per habit (the Four Laws)
- Daily check-ins, current streak, personal-best streak, and a 90-day heatmap
- Habit Scorecard (rate your everyday habits +/−/=, from ch. 1 of the book)
- Weekly Review (wins / misses / one small tweak, per ISO week)
- 12-week completion trend chart
- Per-habit reminder time with local notifications in the mobile app (just-in-time permission
  rationale + permission status row in Settings)
- Export/import your data as JSON
- Level / XP and a goal-completion ring on the Habits page (10 XP per check-in over the last 90 days)
- "Glass over morning haze" UI: frosted translucent panels over a slate-teal sky with a sunrise glow,
  teal pill buttons, icon bottom tab bar on phones; dark and light variants, WCAG AA token pairs,
  bottom tab bar on phones, accessible (WCAG-conscious) UI
- Quality guardrails: two-step confirm on destructive actions, empty/loading/error states with a next
  action, in-app privacy notice, undo-style feedback toasts, CI on every push (see
  [`docs/quality-checklist.md`](./docs/quality-checklist.md))

> The PWA layer (Angular service worker, `manifest.webmanifest`, offline caching, Web Push) was removed
> when the project was converted to a native app with Capacitor.

## Project layout

```
client/              Angular app (ng serve on :4200)
client/android/      Capacitor Android project (native shell that loads the built web app)
server/              Express API (listens on :3000 by default)
```

## Local development

### Prerequisites

- Node.js 18+ and npm
- A MongoDB instance — a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) cluster works fine, or a local `mongod`
- Angular CLI (`npm install -g @angular/cli`) — optional, `npx ng` works without a global install

### 1. Server

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env`:

- `MONGO_URI` — your MongoDB connection string
- `JWT_SECRET` — **required**. Generate one with:
  ```bash
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  ```
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — optional, and not needed by the app itself: reminders are now
  scheduled as local notifications on the device. They only power the legacy Web Push endpoints
  (`/api/push/*`), which no current client uses. Generate with:
  ```bash
  npx web-push generate-vapid-keys
  ```

Then run it:

```bash
npm run dev    # auto-restarts on file changes (node --watch)
# or
npm start      # plain node
```

The API listens on `http://localhost:3000` (or `PORT` from `.env`).

### 2. Client

```bash
cd client
npm install
npm start        # ng serve, http://localhost:4200
```

The dev server doesn't proxy API calls: `client/src/app/config/api.ts` picks the base URL — `http://localhost:3000/api`
on port 4200, `/api` on the same origin when hosted, and `API_ORIGIN` for the native app.

### 3. Try it

1. Open `http://localhost:4200`
2. Register an account (password must satisfy the policy shown on the form)
3. Add a habit, check it off, explore Scorecard / Weekly Review / Trends / Settings

## Mobile app (Capacitor)

The app is wrapped with Capacitor, the toolchain Angular's own mobile guides point at for turning a web
app into a native one. The Angular build is bundled *inside* the app; only API calls go over the network.

### One-time configuration

The native WebView does not share an origin with your server, so tell it where the API lives. You do
**not** need to edit code for this: open the app → **Settings → Server → API address**, type the server
URL (e.g. `https://atomic-habit-tracker.onrender.com`), tap **Test connection**, then **Save & reload**.
The choice is stored on the device and overrides the compiled-in default (`client/src/app/config/api.ts`,
which ships pointing at the dev LAN address for first-run testing).

Deploy the server first (see [`DEPLOYMENT.md`](./DEPLOYMENT.md)) — the packaged app talks to that URL.
The server already allows the app's WebView origins (`capacitor://localhost`, `http://localhost`); if you
override `CLIENT_ORIGINS` yourself, add them back.

### Build it

```bash
cd client
npm install
npm run build:app      # ng build + cap sync android (copies the build into the native project)
npx cap open android   # opens Android Studio - Run, or Build > Build Bundle(s) / APK(s)
```

`npx cap sync android` after every web change (or use `npm run build:app`). To produce a release APK:
Android Studio → Build → Generate Signed Bundle/APK.

Launcher icons and the splash screen are generated from `client/assets/icon.png` (the project's own
512px icon) — rerun `npm run assets:android` after changing it.

To rebuild the native shell from scratch (already committed): `npx cap add android`.

Notifications need the POST_NOTIFICATIONS permission on Android 13+. The app never requests it cold:
**Settings → Enable reminders** first shows an in-app rationale (what it's for, that it stays on the
device), and only tapping **Continue** there opens the system dialog. Settings also shows the current
permission status (Allowed / Not asked yet / Blocked) and, if blocked, how to re-enable it in Android
Settings. Reminders are scheduled locally each time the habit list loads, so opening the app (or
changing a habit) keeps the schedule current.

iOS is not configured in this repo — `npx cap add ios` on macOS would generate the equivalent project.

## Testing

```bash
cd client
npm test          # Karma/Jasmine unit tests, interactive
npx ng test --watch=false --browsers=ChromeHeadless   # single run, CI-style
```

```bash
cd client
npm run build      # production build, verifies bundle budgets
```

```bash
cd server
node -c server.js  # quick syntax check; repeat per file, or see DEPLOYMENT.md's smoke-test snippet
```

There is currently no automated server test suite — see `DEPLOYMENT.md` for a manual smoke-test flow.
Every push and pull request runs these checks in GitHub Actions (`.github/workflows/ci.yml`): client
production build (bundle budget enforced) + unit tests, and server dependency install + syntax check.

## Deployment

The repo is host-ready: `npm run build` + `npm start` at the root (Render, Railway, ...), a `render.yaml` Blueprint, and a multi-stage `Dockerfile`. See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for the full step-by-step guide (MongoDB Atlas, environment variables, hosting options, health check, smoke test).

## Security notes

- All API routes except `/api/auth/register`, `/api/auth/login`, and `/api/push/vapid-public-key` require a `Bearer` JWT.
- Habits, check-ins, scorecard entries, and weekly reviews are strictly scoped to the authenticated user — cross-account access returns `404`, not `403`, to avoid confirming record existence.
- Passwords require 12+ characters with upper/lower/number/symbol, are checked against a common-password list, and can't contain the account's email.
- CORS is allow-listed via `CLIENT_ORIGINS`; a rate limiter and security headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.) are applied to every request.
