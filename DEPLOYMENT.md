# Deployment Guide

This app deploys as a single Node process: the Express server (`server/`) serves the built Angular app (`client/dist/client/browser`) as static files and answers `/api/*` itself. You need one thing external to that process: a MongoDB database.

> **Honesty note:** I verified locally that the server correctly serves the production Angular build and its SPA routing (`/`, `/habits`, and `/api/*` all resolved correctly against a real build in this environment), and that a bad `MONGO_URI` fails loudly instead of silently. I could **not** test an actual push to a live host (Render/Railway/etc.) or a real MongoDB Atlas connection from this environment — no outbound network access to those services here. Treat the platform-specific steps below as standard, well-established instructions for each provider, but do a real smoke test (see the end of this doc) after your first deploy.

## 1. Set up MongoDB

Easiest path: [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) free tier.

1. Create a free cluster.
2. **Database Access** → add a database user with a strong password.
3. **Network Access** → add `0.0.0.0/0` (allow from anywhere) if your host has a dynamic IP, or your host's specific IP/CIDR if it's static.
4. **Connect** → "Drivers" → copy the connection string. It looks like:
   ```
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/habit-tracker?retryWrites=true&w=majority
   ```
   This is your `MONGO_URI`.

Alternative: run MongoDB yourself (a VPS with `mongod`, or your host's managed MongoDB add-on).

## 2. Generate secrets

**JWT_SECRET** (required — the server refuses to start without it):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**VAPID keys** (optional — only needed if you want push notification reminders):

```bash
npx web-push generate-vapid-keys
```

Keep both private. Never commit them.

## 3. Environment variables

Set these on your host (not in a committed file):

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | Yes | From step 1 |
| `JWT_SECRET` | Yes | From step 2 |
| `NODE_ENV` | Yes | Set to `production` |
| `PRT` | No | Port to listen on; most hosts inject `PORT` — see note below |
| `CLIENT_ORIGINS` | Yes in production | Comma-separated list of allowed origins. If the server serves the client itself (recommended setup, see below), this should include your app's own public URL |
| `RATE_LIMIT_MAX` | No | Requests per 15 min per IP, default 300 |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | No | Only for push reminders; `VAPID_SUBJECT` is `mailto:you@example.com` |

**Port note:** `server/server.js` reads `process.env.PRT`, not the more common `PORT`. Most PaaS hosts (Render, Railway, Heroku) inject `PORT` and expect your app to bind to it. Either:
- set `PRT` explicitly in your host's environment settings to whatever `PORT` value the platform assigns (check their docs — some let you reference `$PORT`), or
- add one line to `server/server.js` yourself: `app.port = process.env.PRT || process.env.PORT || 3000;`

If you're deploying to a plain VPS where you control the port, just set `PRT` directly and skip this.

## 4. Build the client

```bash
cd client
npm install
npm run build
```

This outputs to `client/dist/client/browser`. `server/server.js` already points there when `NODE_ENV=production`:

```js
const clientDistPath = path.join(__dirname, "..", "client", "dist", "client", "browser");
```

So the two folders (`client/` and `server/`) need to stay siblings on whatever host you deploy to — don't split them into separate services unless you also update that path and switch the client to call an absolute API URL instead of its same-origin `/api` default.

## 5. Install server dependencies and run

```bash
cd server
npm install
npm start
```

`npm start` runs `node server.js`. In production, confirm:
- It logs `MongoDB connected successfully` (not `MongoDB connection failed`)
- It logs `Server is running on port <N>`
- If VAPID keys aren't set, it logs a warning and continues — push reminders are simply disabled, everything else works

## 6. Hosting options

Pick whichever fits your budget/comfort:

**Render.com** (simple, free tier available)
1. New → Web Service → connect this repo.
2. Build command: `cd client && npm install && npm run build && cd ../server && npm install`
3. Start command: `cd server && npm start`
4. Add the environment variables from step 3 in the dashboard.
5. Render sets `PORT` for you — apply the port note above.

**Railway.app** (similar flow, usage-based free tier)
1. New Project → deploy from repo.
2. Set a build command and start command as above, or use two services (one for build, one for the server) if you prefer — simplest is one service running both steps.
3. Add environment variables in the dashboard. Railway also injects `PORT`.

**A plain VPS (DigitalOcean, Linode, EC2, etc.)**
1. Install Node.js and (optionally) MongoDB.
2. Clone the repo, run the build/install steps from sections 4–5.
3. Set environment variables in a shell profile, systemd unit, or process manager config (see below) — not in a file inside the repo.
4. Run under a process manager so it restarts on crash/reboot:
   ```bash
   npm install -g pm2
   cd server
   pm2 start server.js --name habit-tracker
   pm2 save
   pm2 startup
   ```
5. Put Nginx or Caddy in front for TLS (Let's Encrypt) and to proxy port 80/443 to your app's port.

## 7. Post-deploy smoke test

Once it's live, verify manually (there's no automated E2E suite yet):

1. Visit your app's URL — the habit tracker UI should load (not a blank page or 404).
2. Register a new account — should redirect straight into the app.
3. Add a habit, check it off — streak should show "1 day streak."
4. Refresh the page — you should stay logged in and see the same habit.
5. Log out, log back in — should work.
6. Open Settings → Export data — should download a JSON file with your habit and check-in.
7. If you configured VAPID keys: Settings → Enable push reminders → accept the browser permission prompt → should succeed without an error toast.

If step 2 or 3 fails with a network error, double check `CLIENT_ORIGINS` includes the exact origin the browser is loading the app from (scheme + host + port, no trailing slash).

## Updating a deployed instance

```bash
git pull
cd client && npm install && npm run build
cd ../server && npm install
# restart the process (pm2 restart habit-tracker, or your host's redeploy button)
```
