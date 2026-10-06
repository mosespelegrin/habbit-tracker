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

> Web-push (VAPID) keys are **no longer needed** — the PWA and its push notifications were removed;
> reminder notifications are scheduled natively on the Android build.

Keep the secret private. Never commit it.

## 3. Environment variables

Set these on your host (not in a committed file):

| Variable | Required | Notes |
|---|---|---|
| `MONGO_URI` | Yes | From step 1 |
| `JWT_SECRET` | Yes | From step 2 |
| `NODE_ENV` | Yes | Set to `production` |
| `PORT` | No | Port to listen on. Hosts (Render, Railway, Heroku, Fly) inject it automatically; `PRT` is still read as a fallback, default 3000 |
| `CLIENT_ORIGINS` | No | Extra origins allowed to call the API (e.g. a separately hosted frontend). The app's own origin is always allowed, so you can leave this alone when the server serves the client itself (the recommended setup). Defaults also allow the native app's WebView origins (`capacitor://localhost`, `http://localhost`) — keep those if you override this |
| `TRUST_PROXY` | No | Number of reverse-proxy hops in front of the server. Defaults to `1` in production. Needed so rate limiting sees each visitor's real IP instead of the host proxy's |
| `RATE_LIMIT_MAX` | No | Requests per 15 min per IP, default 300 |

The server refuses to start if `JWT_SECRET` or `MONGO_URI` is missing, so a misconfigured deploy fails loudly in the logs.

**Timezones:** the browser sends its timezone on every request (`X-Timezone`), and the server computes "today", streaks, history and trends in that zone. This matters because hosts run in UTC — without it a user's day would roll over at the wrong local time.

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

## 6. Hosting options

Pick whichever fits your budget/comfort:

The repo root has a `package.json` so any Node host can use the same two commands: **build** `npm run build` (installs and builds the client, installs the server) and **start** `npm start`. Requires Node 20.19+ (declared in `engines`). Note the build script uses `npm ci --include=dev` for the client, because hosts set `NODE_ENV=production` during the build and would otherwise skip the Angular CLI.

Every option below exposes a health check at `GET /api/health` (returns `200` once MongoDB is connected).

**Render.com** (simple, free tier available)
1. New → Blueprint → connect this repo. `render.yaml` already defines the service (build/start commands, health check, `NODE_ENV`, a generated `JWT_SECRET`).
2. Fill in `MONGO_URI` when prompted.
3. Render injects `PORT` for you — nothing else to configure.

Or by hand: New → Web Service, build command `npm run build`, start command `npm start`, then add the variables from step 3.

**Railway.app** (similar flow, usage-based free tier)
1. New Project → deploy from repo. Build command `npm run build`, start command `npm start` (Railway also detects the root `package.json`).
2. Add environment variables in the dashboard. Railway injects `PORT`.

**Docker** (Fly.io, Cloud Run, any container host)
```bash
docker build -t atomic-habit-tracker .
docker run -p 3000:3000 -e MONGO_URI=... -e JWT_SECRET=... atomic-habit-tracker
```
The image is multi-stage (builds the client, then ships only the server plus the built client), runs as a non-root user, and includes a health check.

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
7. Open Settings → Privacy & data — the notice should list what is stored, where, and that there is no tracking.

If step 2 or 3 fails with a network error and you host the client on a *different* origin than the API, make sure `CLIENT_ORIGINS` includes that exact origin (scheme + host + port). If the API sits behind a proxy that rewrites the `Host` header, the server can't recognise its own origin — add it to `CLIENT_ORIGINS` too.

Also check `GET /api/health` first: `503` means the server is up but MongoDB isn't connected yet.

## Updating a deployed instance

```bash
git pull
cd client && npm install && npm run build
cd ../server && npm install
# restart the process (pm2 restart habit-tracker, or your host's redeploy button)
```

## Mobile app against this deployment

The Capacitor build calls this deployment directly, so after the first deploy:

1. In the app: **Settings → Server → API address** — enter this service's URL (e.g.
   `https://atomic-habit-tracker.onrender.com`), tap **Test connection** (expect "Server is healthy"),
   then **Save & reload**. This stores the origin in the device's local storage, so no rebuild is needed;
   it overrides the compiled-in default.
2. `cd client && npm run build:app`, then build the APK from Android Studio (or `gradlew assembleDebug`).
3. Confirm the CORS list: the server's default `CLIENT_ORIGINS` already includes `capacitor://localhost` and
   `http://localhost`. If you set your own `CLIENT_ORIGINS`, both must be in it.
4. Smoke-test the packaged app the same way as the web build: register, add a habit, check it off, reload.
   Against Render the API is HTTPS, so it works even though Android blocks cleartext HTTP by default
   (cleartext is only enabled for LAN testing).
