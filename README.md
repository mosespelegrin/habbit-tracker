# Atomic — Habit Streak Tracker

A MEAN-stack habit tracker built around James Clear's *Atomic Habits*: identity-based habits, the Four Laws of Behavior Change (cue, craving, response, reward), habit stacking, streaks, a habit scorecard, weekly reviews, and a completion trend chart.

## Stack

- **Client**: Angular 17 (standalone components, signals, `@angular/service-worker` for PWA/push)
- **Server**: Node.js + Express 5 + Mongoose 9 (MongoDB)
- **Auth**: JWT bearer tokens, bcrypt-hashed passwords, a strong server-enforced password policy
- **Push notifications**: Web Push (VAPID) + `node-cron`, timezone-aware per user

## Features

- Identity, cue, 2-minute version, reward, and habit stacking per habit (the Four Laws)
- Daily check-ins, current streak, personal-best streak, and a 90-day heatmap
- Habit Scorecard (rate your everyday habits +/−/=, from ch. 1 of the book)
- Weekly Review (wins / misses / one small tweak, per ISO week)
- 12-week completion trend chart
- Per-habit reminder time with browser push notifications
- Export/import your data as JSON
- Installable PWA, dark mode, accessible (WCAG-conscious) UI

## Project layout

```
client/   Angular app (ng serve on :4200)
server/   Express API (listens on :3000 by default)
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
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — optional, only needed for push reminders. Generate with:
  ```bash
  npx web-push generate-vapid-keys
  ```

Then run it:

```bash
npm run dev    # auto-restarts on file changes (node --watch)
# or
npm start      # plain node
```

The API listens on `http://localhost:3000` (or `PRT` from `.env`).

### 2. Client

```bash
cd client
npm install
npm start        # ng serve, http://localhost:4200
```

The dev server proxies API calls to `http://localhost:3000/api` automatically (see `HabitService`/`AuthService`'s `apiBaseUrl` logic — it switches based on port 4200).

### 3. Try it

1. Open `http://localhost:4200`
2. Register an account (password must satisfy the policy shown on the form)
3. Add a habit, check it off, explore Scorecard / Weekly Review / Trends / Settings

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

## Deployment

See [`DEPLOYMENT.md`](./DEPLOYMENT.md) for a full step-by-step guide (MongoDB Atlas, environment variables, building the client, running the server in production, and a couple of free-tier hosting options).

## Security notes

- All API routes except `/api/auth/register`, `/api/auth/login`, and `/api/push/vapid-public-key` require a `Bearer` JWT.
- Habits, check-ins, scorecard entries, and weekly reviews are strictly scoped to the authenticated user — cross-account access returns `404`, not `403`, to avoid confirming record existence.
- Passwords require 12+ characters with upper/lower/number/symbol, are checked against a common-password list, and can't contain the account's email.
- CORS is allow-listed via `CLIENT_ORIGINS`; a rate limiter and security headers (`X-Frame-Options`, `X-Content-Type-Options`, etc.) are applied to every request.
