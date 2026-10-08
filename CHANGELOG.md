# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions are pre-1.0.

## [Unreleased]

### Added

- **Optional cloud sync (MongoDB)**: the app stays offline-first, but signing in under
  Settings → Cloud sync mirrors every habit, check-in, scorecard entry and weekly review to the
  server so the Render website and the Android app share one dataset. A single round trip to the new
  `POST /api/sync` (whole dataset + deletion tombstones, **last-writer-wins** on `updatedAt`,
  idempotent retries) pushes local changes and pulls the authoritative merge; sync triggers on app
  start, reconnect, tab focus, debounced local edits and a manual "Sync now". Adds `SyncService`,
  the auth interceptor (401 just drops the session - no login gates), a topbar sync pill
  (Synced / Syncing / Offline / Sync issue), `updatedAt` stamps + deletion tombstones in
  `LocalStoreService`, server-side persistence of `kind`, a native sync-server field in Settings,
  and 6 new merge/tombstone specs (19 Karma specs total).
- **Pure offline mode**: all data now lives on the device in `LocalStoreService`
  (localStorage) - no login, no account, no server. Streak/history/trend/stack math from the API was
  reimplemented locally, so the app works in airplane mode; the login/register screens, auth guard,
  auth interceptor and Server setting were removed. Settings → Offline mode + privacy notice updated.
- **Grow / Break habit direction**: habits carry a `kind`. *Grow* habits use the Four Laws; *break*
  habits use the inverted laws from ch. 5 (Make it Invisible / Unattractive / Difficult / Unsatisfying)
  with swapped labels, a BREAK badge, "I resisted today" check-ins and contract wording. The Workflow
  design step has a Grow/Break toggle; a "−" scorecard entry pre-fills a break habit automatically.
- **Local-store unit tests** (13 Karma specs incl. streak math, duplicate check-in protection,
  export/import dedupe).
- **Native Android app (Capacitor)**: `client/android/` shell that bundles the built web app;
  launcher icons + splash generated from the project icon. Java 21 toolchain auto-provisioned via the
  `foojay-resolver-convention` Gradle plugin.
- **Server address setting**: Settings → Server lets a device point at any API origin
  (Test connection + Save & reload), stored in local storage and overriding the compiled default —
  no rebuild needed to switch between LAN and a hosted server.
- **Just-in-time permission flow**: Settings → Enable reminders shows an in-app rationale before the
  Android system dialog, plus a permission status row (Allowed / Not asked yet / Blocked) with
  recovery instructions when blocked.
- **Two-step delete confirmation** on the Habits page (armed state auto-reverts after 5 s) and a
  "Deleted ..." success toast.
- **In-app privacy notice** (Settings → Privacy & data) and an About section (version, platform).
- **CI**: GitHub Actions workflow — client production build + Karma unit tests, server install +
  syntax check on every push/PR.
- **Redesign**: "glass over morning haze" glassmorphism theme — frosted translucent cards with
  backdrop blur over a slate-teal sky with sunrise glow, teal pill buttons, icon glass-tile bottom
  tab bar, dark + light variants with WCAG AA token pairs.

### Changed

- Bundle dropped under its 500 kB budget (dead auth/API code tree-shaken out).
- CORS defaults extended with the Capacitor WebView origins (`capacitor://localhost`, `http://localhost`).
- Destructive and primary actions styled as pill buttons; inputs use translucent fields; consent/error
  copy kept at readable contrast in both themes.

### Removed

- **Login / register, auth guard, auth interceptor, JWT flow and the Server setting**: obsolete now
  that the app is pure offline (single user per device).
- **PWA layer**: Angular service worker, `manifest.webmanifest`, offline caching, and Web Push.
  Reminder notifications moved to native local notifications (`@capacitor/local-notifications`),
  so VAPID keys are no longer used anywhere.
- Violet-era neon gradients/glows from the component styles.

## [1.0.0] — initial release

- Identity-based habits with the Four Laws (cue, craving, response, reward), habit stacking,
  daily check-ins, streaks + personal best, 90-day heatmap.
- Habit Scorecard, Weekly Review, 12-week completion trend, level/XP, goal ring.
- JWT auth with a server-enforced password policy, per-user data scoping, rate limiting, CORS allow-list.
- JSON export/import, timezone-aware "today" for users, deployable single-process build
  (`npm run build` + `npm start`), `render.yaml` Blueprint, multi-stage `Dockerfile`.
