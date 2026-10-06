# Quality & permissions checklist

Adapted from the project's quality/permissions standard (written for a different app, so the *content*
is adapted but the *discipline* — P0/P1/P2, evidence per item — is kept). Status legend:
**Done** · **N/A** (item doesn't apply to this app) · **Open**.

## P0 — must have

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Permission rationale **before** any system dialog | Done | `settings.component.ts` — "Enable reminders" opens an in-app rationale first; only "Continue" calls `LocalNotifications.requestPermissions()` |
| 2 | Permission status + recovery path visible | Done | Settings → Reminders status pill (Allowed / Not asked yet / Blocked) + instructions for Android Settings when blocked |
| 3 | Confirm destructive actions | Done | `habit-list.component.ts` — two-step armed Delete ("Tap to confirm", auto-reverts 5 s), success toast after delete. Uses an in-UI confirm because Android WebView doesn't render `window.confirm()` |
| 4 | Empty / loading / error states with a next action | Done | Habit list skeleton + error toast with retry guidance; empty state "No habits yet - add one above!"; auth/settings forms show inline errors |
| 5 | Privacy notice in-app | Done | Settings → Privacy & data: what/where/who/tracking/rights, in plain language |
| 6 | Build + tests gate | Done | `.github/workflows/ci.yml` — production build (bundle budget), 5 Karma unit tests, server install + `node --check` |
| 7 | Docs kept honest | Done | README, DEPLOYMENT.md, CHANGELOG.md updated with every behaviour change |

## P1 — should have

| # | Item | Status | Evidence |
|---|---|---|---|
| 1 | Undo where feasible | Partial | Deletion needs an explicit second tap instead; check-in errors leave state untouched. Server-side undo (re-adding a deleted habit) is **Open** — would need a soft-delete |
| 2 | Accessibility: focus rings, 44 px targets, aria labels, live regions | Done | `--focus-ring` on every interactive element; min 44 px heights; `aria-label` on icon/short buttons; `role=status`/`role=alert` on status and error copy; `prefers-reduced-motion` honoured globally |
| 3 | Never request permission cold (ask in context) | Done | Rationale is triggered from Settings where the user asked for reminders, not at app start |
| 4 | Secure transport & secrets | Done | JWT required on all data routes, secrets via env (`JWT_SECRET`, `MONGO_URI`), HTTPS on host; cleartext only enabled for LAN testing |
| 5 | CI on push/PR | Done | `ci.yml` on push to main/master + all PRs |

## P2 — nice to have

| # | Item | Status |
|---|---|---|
| 1 | Server-side automated tests (only manual smoke flow exists) | Open — needs a test DB in CI (e.g. `mongodb-memory-server`) |
| 2 | E2E tests (Playwright/Cypress) | Open |
| 3 | LICENSE chosen by project owner | Open — deliberately not invented |
| 4 | Soft delete + undo for habits | Open |
| 5 | In-app "open Android notification settings" deep link | Open — requires an extra Capacitor plugin; currently documented in the UI instead |

## Known limitations (honest notes)

- The system notification dialog itself (once Continue is tapped) is OS-rendered and cannot be themed.
- If the user blocks notifications at the OS level, Android will not show the prompt again — the app
  detects this (`denied`) and tells the user exactly where to re-enable it.
- The web build shows an explanatory notice instead of a reminders toggle, because reminders are
  native-only now that the PWA is gone.
