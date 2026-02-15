# Going live – deployment guide

This guide covers how to put your Node/Express site on the internet. Your app uses **SQLite**, **Stripe**, **sessions**, and **email**; the steps below keep that in mind.

---

## 1. Pre-launch checklist

### 1.1 Environment variables (production)

Your server already checks these when `NODE_ENV=production`:

| Variable | Purpose |
|----------|--------|
| `NODE_ENV` | Set to `production` on the host |
| `PORT` | Usually set by the host (e.g. 3000 or 8080) |
| `STRIPE_SECRET_KEY` | **Live** key from Stripe (starts with `sk_live_`) |
| `STRIPE_WEBHOOK_SECRET` | From Stripe Dashboard → Webhooks (see below) |
| `SESSION_SECRET` | Long random string (e.g. 64 chars) – **change from dev** |
| `ADMIN_KEY` | Strong password for admin – **change from dev** |
| `EMAIL_USER` | SMTP login (e.g. iCloud address) |
| `EMAIL_PASS` | SMTP password / app password |
| `EMAIL_TO` | Where to receive form emails |

Optional: `YOUTUBE_CHANNEL_ID` (for latest-video on the homepage).

**Important:** Do **not** commit `.env`. Use the host’s “Environment variables” or “Secrets” UI to set these. Use **live** Stripe keys and a **new** webhook for your production URL.

### 1.2 Stripe (live mode)

1. In [Stripe Dashboard](https://dashboard.stripe.com), switch to **Live** (toggle in the sidebar).
2. Get your **live** keys: Developers → API keys → **Publishable key** and **Secret key**.
3. In your front end (e.g. any template or JS that uses `STRIPE_PUBLISHABLE_KEY`), ensure the **live** publishable key is used in production (e.g. via a build or server-rendered config).
4. **Webhook for production:**
   - Developers → Webhooks → Add endpoint.
   - URL: `https://your-domain.com/stripe/webhook`
   - Events: e.g. `checkout.session.completed`, and any others your code uses.
   - Copy the **Signing secret** (starts with `whsec_`) and set it as `STRIPE_WEBHOOK_SECRET` on the host.

### 1.3 Database (SQLite)

- The app uses `data.db` in the project directory. On first run the server will create it (and run migrations if you have any).
- **Persistent storage:** Many PaaS hosts have an **ephemeral** filesystem (disk is wiped on deploy/restart). For production you want **persistent storage** so `data.db` is not lost:
  - **Railway:** Add a **Volume** and mount it where your app writes `data.db` (e.g. project root).
  - **Render:** Add a **Disk** and mount it; run the app (and store `data.db`) on that path.
  - **VPS (e.g. DigitalOcean, Linode):** The server disk is persistent; just run the app and `data.db` stays.

---

## 2. Hosting options (pick one)

### Option A – Railway (good balance of simplicity and control)

1. Sign up at [railway.app](https://railway.app) (GitHub login is easiest).
2. **New project** → **Deploy from GitHub** → connect your repo and select this project (or push this folder to a GitHub repo first).
3. **Variables:** In the project, open your service → **Variables** → add every variable from the checklist (no `.env` file in repo). Set `NODE_ENV=production`. Railway sets `PORT` for you.
4. **Persistent DB:** In the same service, go to **Volumes** → **Add volume**, mount path e.g. `/data`. Then set an env var so the app uses that path for the DB (see “Making SQLite path configurable” below if you add it).
5. **Start command:** Railway usually detects `npm start` (`node server.js`). If not, set build command empty and start command: `node server.js`.
6. **Domain:** In **Settings** → **Networking** → **Generate domain** (you get `*.railway.app`). Optionally add your own domain.

**Stripe webhook:** Set the endpoint URL to `https://your-railway-domain.up.railway.app/stripe/webhook` (or your custom domain).

---

### Option B – Render

1. Sign up at [render.com](https://render.com).
2. **New** → **Web Service** → connect your repo, select this project.
3. **Build:** Build command: `npm install` (or leave default). Start: `node server.js`.
4. **Environment:** Add all variables from the checklist. Set `NODE_ENV=production`. Render provides `PORT`.
5. **Persistent DB:** Add a **Disk** in the service, mount path e.g. `/data`. Adjust app to put `data.db` under `/data` (see below) so it survives restarts.
6. **Domain:** Render gives a `*.onrender.com` URL; you can add a custom domain under **Settings**.

**Stripe webhook:** Use `https://your-app.onrender.com/stripe/webhook` (or your custom domain).

---

### Option C – VPS (DigitalOcean, Linode, Vultr, etc.)

Full control; disk is persistent by default.

1. Create a small Linux droplet/server (e.g. Ubuntu 22.04).
2. SSH in, install Node (e.g. via [NodeSource](https://github.com/nodesource/distributions) or your distro’s package manager).
3. Clone your repo (or upload files), run `npm install --production`, then set env vars (e.g. in a `.env` file that’s not in git, or systemd environment).
4. Run the app:
   - **Simple:** `PORT=3000 node server.js` (or use the host’s `PORT`), ideally in a process manager.
   - **Robust:** Use **PM2**: `npm install -g pm2` then `pm2 start server.js --name "tutoring"`, then `pm2 save` and `pm2 startup`.
5. Put **Nginx** (or Caddy) in front: reverse proxy to `http://127.0.0.1:3000`, and optionally TLS (e.g. Let’s Encrypt).
6. Open port 80/443 and (if you use a firewall) allow them.

**Stripe webhook:** `https://your-domain.com/stripe/webhook`.

---

## 3. Making SQLite path configurable (optional but recommended)

If you use a **volume** or **disk** mounted at e.g. `/data`, you want `data.db` to live there so it persists.

1. In `server.js`, replace the fixed path with something like:

   ```js
   const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, 'data.db');
   const db = new Database(dbPath);
   ```

2. On the host, set `SQLITE_DB_PATH=/data/data.db` (and ensure the app can create/write that path).

If you don’t set `SQLITE_DB_PATH`, the app keeps using `data.db` in the project directory (fine for VPS; on Railway/Render without a volume/disk, the DB will be lost on restart).

---

## 4. After going live

1. **Test:** Visit `https://your-domain.com`, check nav, booking flow, and a small test payment in Stripe **live** mode (then refund if needed).
2. **Webhook:** In Stripe Dashboard → Webhooks → your endpoint, check that events are received and not failing.
3. **HTTPS:** All of the options above (Railway, Render, VPS with Nginx/Caddy) can serve over HTTPS. Use HTTPS in Stripe (webhook and redirect URLs) and in any links you send to users.
4. **Backups:** For SQLite, periodically copy `data.db` from the server or from the mounted volume to a backup location.

---

## 5. Quick reference

| Task | Where |
|------|--------|
| Live Stripe keys | Stripe Dashboard → Developers → API keys (Live) |
| Webhook signing secret | Stripe Dashboard → Developers → Webhooks → endpoint → Signing secret |
| Env vars in production | Never in git; set in Railway/Render “Variables” or on VPS in `.env` / systemd |
| Persistent SQLite | Railway Volume / Render Disk, or VPS project directory |

Once your repo is connected and env vars (and optional volume) are set, the same codebase you run locally can run in production with `NODE_ENV=production` and live Stripe keys.
