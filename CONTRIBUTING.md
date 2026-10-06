# Contributing

Thanks for improving Atomic.

## Workflow

1. Branch from `main` (`git checkout -b feature/thing`).
2. Make the change, keeping the existing style: standalone Angular components, token-driven CSS
   (no hard-coded colours — use the variables in `client/src/styles.css`), small focused commits.
3. Verify locally before pushing:
   ```bash
   cd client
   npm run build                     # must stay inside the bundle budget
   npx ng test --watch=false --browsers=ChromeHeadless
   cd ../server
   node --check server.js            # repeat per touched file
   ```
4. Open a PR. CI (`.github/workflows/ci.yml`) runs the same build + tests.

## Guidelines

- **Permissions**: never request one cold. Show an in-app rationale first (see Settings → Reminders
  for the pattern), and surface the current permission status with recovery steps.
- **Destructive actions**: confirm before acting (the two-step armed Delete is the reference
  implementation), then give feedback (success/error toast).
- **States**: every async view needs loading, empty, and error states — the error state must suggest
  the next action.
- **Accessibility**: 44 px minimum targets, visible focus (`--focus-ring`), `aria-label` on icon-only
  buttons, live regions for status/error text, respect `prefers-reduced-motion`.
- **Docs**: user-visible behaviour changes land with an update to `README.md` / `DEPLOYMENT.md` and a
  line in `CHANGELOG.md` (Unreleased section).
- **No secrets** in the repo; env vars only (see `DEPLOYMENT.md`).

## Project layout

```
client/       Angular app + Capacitor Android project (client/android)
server/       Express API
docs/         Quality checklist and other docs
```
