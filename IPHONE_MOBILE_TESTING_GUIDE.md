# iPhone Mobile Testing Guide — Local Development

A complete, practical guide for testing your tutoring website on iPhone while running the dev server on your PC. Use this to catch mobile-only issues (styling, routing, assets, sessions) before they reach production.

---

## 1. Gold standard workflow for testing on iPhone

Follow this workflow every time you test on device. Skipping steps often causes “works on desktop, fails on phone” issues.

### 1.1 Network requirements

- [ ] **Same Wi‑Fi network**  
  Your PC and iPhone must be on the **same** Wi‑Fi network (same SSID).  
  **Expected:** Both devices show the same network name in settings.

- [ ] **No VPN on PC (while testing)**  
  If your PC uses a VPN, the VPN may route traffic so your phone cannot reach `192.168.x.x`.  
  **Fix:** Disconnect VPN on PC when testing locally, or use a VPN that allows “local network access”.

- [ ] **iPhone: Private Relay / iCloud Private Relay**  
  Settings → [Your name] → iCloud → Private Relay. If ON, it can break access to local IPs.  
  **Fix:** Turn Private Relay OFF temporarily, or use “Allow in Local Network” if your iOS version offers it.

- [ ] **iPhone: Limit IP Address Tracking**  
  Settings → Wi‑Fi → [Your network] → tap (i) → “Limit IP Address Tracking” OFF can help if you see odd failures.  
  **Expected:** You can load `http://YOUR_PC_IP:PORT` in Safari.

### 1.2 Find your PC’s local IP on Windows

- [ ] **Option A — Command (recommended)**  
  1. Open PowerShell or Command Prompt.  
  2. Run: `ipconfig`  
  3. Find the section for your **Wi‑Fi adapter** (e.g. “Wireless LAN adapter Wi-Fi”).  
  4. Note **IPv4 Address** (e.g. `192.168.1.105`).  
  **Expected:** A value like `192.168.x.x` (not `127.0.0.1`).

- [ ] **Option B — Settings**  
  1. Settings → Network & Internet → Wi‑Fi → your network → Properties.  
  2. Find “IPv4 address”.  
  **Expected:** Same as above.

### 1.3 URL format and port

- [ ] **Base URL:** `http://YOUR_PC_IP:PORT`  
  Example: `http://192.168.1.105:3000`  
  **Do not use:** `localhost`, `127.0.0.1`, or `https` (unless you’ve set up local HTTPS).

- [ ] **Port:** Use the same port your dev server uses (e.g. `PORT=3000` or default 3000).  
  **Expected:** Server console shows something like “Server started” with `port: 3000` and `host: '0.0.0.0'`.

### 1.4 If the server binds to localhost only

If you can’t reach the site from your phone:

- [ ] **Check how the server listens.**  
  It must listen on **all interfaces**, not only `127.0.0.1`.  
  **Correct:** `app.listen(PORT, '0.0.0.0', ...)`  
  **Wrong:** `app.listen(PORT)` (some stacks default to localhost only) or `app.listen(PORT, 'localhost', ...)`.

- [ ] **Fix in code (Express example):**  
  Change to:  
  `app.listen(PORT, '0.0.0.0', () => { ... });`  
  Then restart the server.

- [ ] **Expected:** From iPhone Safari, `http://YOUR_PC_IP:3000` loads the homepage.

### 1.5 Quick connectivity check

- [ ] On PC: start the dev server.  
- [ ] On iPhone: open Safari, go to `http://YOUR_PC_IP:PORT`.  
- [ ] **Expected:** Homepage loads (even if some assets need further checks).  
- [ ] If it doesn’t load: re-check same Wi‑Fi, VPN, Private Relay, firewall (Section 5).

---

## 2. Critical mobile test cases checklist

Use this as a full pass before any demo or release. Check off each item; note any failures for the diagnostic section (Section 4).

### 2.1 Navigation / link coverage

- [ ] **Home:** `http://YOUR_IP:PORT/` loads.  
  **Expected:** Full page with nav and content (not blank or “index only”).

- [ ] **Every main page reachable:**  
  - [ ] `/` (index)  
  - [ ] `/login.html`  
  - [ ] `/singup.html`  
  - [ ] `/account.html` (after login)  
  - [ ] `/calendar.html`  
  - [ ] `/my-bookings.html`  
  - [ ] `/confirmation.html`  
  - [ ] `/forgot-password`  
  - [ ] `/reset-password` (with valid token if required)  
  - [ ] Any other public HTML pages you have  
  **Expected:** Each URL loads the correct page, no “Safari can’t open the page” or “connection lost”.

- [ ] **In-page links:** Tap every nav link and primary CTA from the homepage.  
  **Expected:** Correct page loads; no white screen or network error.

- [ ] **Redirects:**  
  - [ ] `/account-entry` → login or account as intended.  
  - [ ] `/manage-bookings` → login, signup, or my-bookings as intended.  
  **Expected:** One redirect, correct destination, no infinite loop.

### 2.2 Styling / CSS loading

- [ ] Homepage has full layout (header, nav, footer, spacing).  
  **Expected:** Not unstyled (plain black text on white).

- [ ] Typography and colours match desktop (or your mobile design).  
  **Expected:** Fonts and colours applied.

- [ ] Buttons and links are visibly styled (not default blue underline only).  
  **Expected:** Buttons have background/border; links match design.

- [ ] No “flash of unstyled content” (FOUC) after load.  
  **Expected:** Page doesn’t visibly “snap” from unstyled to styled (or only a brief flash).

### 2.3 JavaScript loading

- [ ] No blocking errors: add a simple test (e.g. tap a button that runs JS).  
  **Expected:** Behaviour runs (e.g. menu toggles, form validation).

- [ ] Console: use Section 3 to inspect; note any red errors.  
  **Expected:** No 404s for `.js` files; no “Failed to load resource” for your app scripts.

- [ ] Navigation/SPA behaviour (if any): links that are supposed to load content via JS do so.  
  **Expected:** No “only index works” — every route works.

### 2.4 Images and fonts

- [ ] Images on homepage and key pages load.  
  **Expected:** No broken-image icon; correct images.

- [ ] Favicon (if set) appears in Safari tab.  
  **Expected:** Icon visible (or no error).

- [ ] Custom fonts load (if used).  
  **Expected:** Text uses correct font, not fallback only (check a distinctive character).

### 2.5 Forms

- [ ] **Contact form:** Submit (or validation run).  
  **Expected:** Success message or clear validation; no “connection lost”.

- [ ] **Login:** Enter credentials, submit.  
  **Expected:** Redirect to account/dashboard and session persists (next check).

- [ ] **Signup:** Submit valid data.  
  **Expected:** Success and redirect (or expected error).

- [ ] **Booking flow:** Select service/slot, proceed to checkout (Stripe).  
  **Expected:** Redirect to Stripe; return to success/confirmation URL on your site.

- [ ] **Payment (Stripe):** Complete or cancel.  
  **Expected:** Return to your `checkout/success` or `confirmation.html`; no “connection lost” on return.

- [ ] **Forgot / reset password:** Request reset and (if possible) complete flow.  
  **Expected:** Emails and links work; reset page loads and submit works.

### 2.6 Auth and session persistence

- [ ] After login, reload the page.  
  **Expected:** Still logged in (no redirect to login).

- [ ] Navigate to 2–3 protected pages (e.g. account, my-bookings).  
  **Expected:** All load as logged-in user.

- [ ] Close Safari (or switch app) for ~30 seconds, reopen same tab.  
  **Expected:** Session still valid (or graceful re-login), not random logout.

- [ ] Logout.  
  **Expected:** Redirect to login/home; protected URLs redirect to login when visited again.

### 2.7 Back / forward behaviour

- [ ] Go Home → Page A → Page B. Tap Safari back twice.  
  **Expected:** Page A, then Home; no blank or error.

- [ ] After form submit (e.g. contact), tap back.  
  **Expected:** Previous page or form; no “connection lost” or duplicate submit without confirmation.

### 2.8 Viewport and responsiveness

- [ ] Portrait: content fits width; no horizontal scroll.  
  **Expected:** No sideways scroll for main layout.

- [ ] Landscape: key content still usable.  
  **Expected:** No critical elements cut off or overlapping.

- [ ] Text readable without zooming.  
  **Expected:** Body text at least ~16px equivalent; tap targets comfortably large.

- [ ] Key buttons/CTAs are easy to tap (no tiny links).  
  **Expected:** No mis-taps; primary actions work first time.

### 2.9 Performance / basic loading

- [ ] Homepage loads within a few seconds on Wi‑Fi.  
  **Expected:** First paint within ~3–5 s; no minute-long hang.

- [ ] Navigate to 2–3 other pages.  
  **Expected:** Similar speed; no severe delay compared to desktop.

- [ ] No repeated “stuck” loading spinners that never finish.  
  **Expected:** Either content appears or a clear error.

---

## 3. How to verify assets are loading on iPhone Safari

### 3.1 With a Mac (Safari Web Inspector — recommended)

- [ ] **Enable Web Inspector on iPhone:**  
  Settings → Safari → Advanced → Web Inspector **ON**.

- [ ] **Enable “Develop” menu on Mac Safari:**  
  Safari → Settings → Advanced → “Show features for web developers” (or “Show Develop menu”) **ON**.

- [ ] **Connect:**  
  1. USB cable: iPhone to Mac.  
  2. On iPhone: open your site in Safari (`http://YOUR_IP:PORT`).  
  3. On Mac: Safari → Develop → [Your iPhone name] → select the page.  
  **Expected:** Web Inspector opens; you see Console, Network, etc.

- [ ] **Console:** Check for red errors (404, CORS, syntax).  
  **Expected:** No 404 for your CSS/JS; no “blocked by CSP” or mixed content for your origin.

- [ ] **Network:** Reload page; filter by “All” or “Doc”, “Stylesheet”, “Script”.  
  **Expected:** `styles.css` and your `.js` files return **200** and correct **Content-Type** (e.g. `text/css`, `application/javascript`).  
  **Failure signs:** 404, wrong MIME type, (blocked), or status in red.

- [ ] **Check response headers:** Click a CSS or JS request → Headers.  
  **Expected:** `Content-Type: text/css; charset=utf-8` or `application/javascript; charset=utf-8`.  
  **Wrong:** `application/octet-stream` or `text/plain` for CSS/JS can cause Safari to ignore or mishandle the file.

### 3.2 Without a Mac (fallback)

- [ ] **Remote logging:**  
  - Add a simple `/api/debug-log` (or use existing logging) that accepts `method`, `url`, `status` (or message) and logs server-side.  
  - From your JS, on load or on error, send: `fetch('/api/debug-log', { method: 'POST', body: JSON.stringify({ msg, url: location.href }) })`.  
  **Expected:** You see in server logs which page/asset failed and any status.

- [ ] **Test endpoints:**  
  - In browser on PC: open `http://YOUR_IP:PORT/styles.css` and `http://YOUR_IP:PORT/load-navigation.js` (or your main JS).  
  **Expected:** CSS shows as text; JS shows as text; status 200 and `Content-Type` correct in devtools.  
  - Same URLs from iPhone: use a “Request inspector” or “Fetch test” page that does `fetch('/styles.css').then(r => alert(r.status + ' ' + r.headers.get('Content-Type')))`.  
  **Expected:** 200 and `text/css` / `application/javascript`.

- [ ] **Visual checks:**  
  - If CSS loads: layout and colours are correct.  
  - If a JS file fails: behaviour that depends on it (e.g. nav, form) will be broken; check that specific feature.

### 3.3 What to look for (all setups)

- [ ] **Wrong MIME types:**  
  CSS must be `text/css`; JS must be `application/javascript` (or `text/javascript`).  
  **Fix:** Server must set `Content-Type` for these extensions (explicit route or static middleware `setHeaders`). See Section 5.

- [ ] **Blocked resources:**  
  - Mixed content: page HTTPS but assets HTTP → can block on iOS.  
  **Fix:** Use HTTP everywhere locally, or HTTPS everywhere.  
  - CSP: missing `'self'` or wrong host for assets.  
  **Fix:** Ensure CSP allows your origin for styles and scripts.

- [ ] **404s:**  
  Request path wrong (e.g. relative path resolved against wrong base).  
  **Fix:** Use root-relative paths for assets: `href="/styles.css"`, `src="/script.js"`. See Section 4.

- [ ] **Caching:**  
  Old CSS/JS served from cache.  
  **Fix:** Dev server sends `Cache-Control: no-cache` for CSS/JS in development; on phone try “Reload Without Content Blockers” or clear Safari cache (Settings → Safari → Clear History and Website Data for a hard reset).

---

## 4. Diagnostic decision tree: common failures

Use this when something fails on iPhone. For each symptom: likely causes first, then exact fixes.

### 4.1 Page loads without CSS (unstyled)

**Likely causes:**

- CSS file not requested or 404 (wrong path).
- Wrong or missing `Content-Type` (e.g. `text/plain` or `application/octet-stream`) so Safari doesn’t apply it.
- CSP blocking the stylesheet.
- CORS blocking (less common for same-origin CSS).

**Fixes (in order):**

1. **Use root-relative path in HTML:**  
   In your HTML `<head>` use:  
   `<link rel="stylesheet" href="/styles.css">`  
   **Not:** `href="styles.css"` or `href="./styles.css"` (they can resolve wrongly with client-side routing or different page paths).

2. **Ensure server sends correct Content-Type:**  
   For `/styles.css`, response must include:  
   `Content-Type: text/css; charset=utf-8`.  
   In Express: explicit route or `express.static` `setHeaders` with `res.setHeader('Content-Type', 'text/css; charset=utf-8')`.

3. **Ensure CSS is actually served:**  
   Add an explicit route before static middleware if needed, e.g.  
   `app.get('/styles.css', (req, res) => { res.setHeader('Content-Type', 'text/css; charset=utf-8'); res.sendFile(path.join(__dirname, 'styles.css')); });`

4. **CSP:**  
   In Helmet (or equivalent), allow styles from same origin: e.g. `styleSrc: ["'self'", ...]`. If you use inline styles, you may need `'unsafe-inline'` for dev (don’t rely on that in production without a plan).

**Expected after fix:** Reload on iPhone; full layout and colours appear.

---

### 4.2 Only index page loads; other pages fail

**Likely causes:**

- Frontend is a SPA: only `index.html` is served for `/`, but other routes like `/login` aren’t mapped on server, so requesting `/login` returns 404 or wrong file.
- Links use hash routing (e.g. `#/login`) but you’re requesting `/login.html` — server has no route.
- Server only has explicit route for `/` and no fallback for other HTML routes; static middleware order or path is wrong.

**Fixes:**

1. **Match server to your routing strategy:**  
   - If you use **real paths** (e.g. `/login.html`, `/calendar.html`): ensure each is either a static file or an explicit route (e.g. `app.get('/login.html', ...)` or `sendFile` for that file).  
   - If you use **SPA with client-side routes:** serve `index.html` for all non-API routes (e.g. catch-all `app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html'))`), and ensure assets are registered above that.

2. **Use correct link hrefs on phone:**  
   Links must point to the same paths the server understands: e.g. `href="/login.html"` or `href="/calendar.html"`.  
   If your nav is built by JS, ensure the base URL is correct (no `localhost` in links). Use root-relative paths: `/login.html` not `http://localhost:3000/login.html`.

3. **Base tag (if used):**  
   If you have `<base href="...">`, it must not point to `localhost` when opened from phone. Prefer omitting `<base>` or setting it from `window.location.origin` in JS so it’s correct on every device.

**Expected after fix:** Every main URL (/, /login.html, /calendar.html, etc.) loads the right page on iPhone.

---

### 4.3 “Safari can’t open the page because the network connection was lost”

**Likely causes:**

- Request timeout (slow server or large response).
- Server closed connection (crash, restart, or idle timeout).
- Redirect or fetch to wrong host (e.g. `localhost` or `127.0.0.1` from iPhone).
- Mixed content: page on HTTP, redirect or form to HTTPS (or vice versa) causing iOS to drop connection.
- CORS or cookie issues on a redirect (e.g. after Stripe checkout).

**Fixes:**

1. **No localhost in redirects or API calls from frontend:**  
   Use the current origin in JS:  
   `const baseUrl = window.location.origin;`  
   Then use `baseUrl` for redirect URLs, Stripe `success_url`/`cancel_url`, or any `fetch`/form action that builds a full URL.  
   **Never** hardcode `http://localhost:3000` in HTML or JS that runs on the client.

2. **Stripe (and similar) return URLs:**  
   On the server, build redirect URLs with the request’s host (and protocol), e.g.  
   `const baseUrl = (req.protocol + '://' + req.get('host'))`  
   and use that for `success_url` and `cancel_url`. So when the user opens the site as `http://192.168.1.105:3000`, return URLs are `http://192.168.1.105:3000/...`.

3. **Keep HTTP everywhere locally:**  
   Don’t mix HTTP and HTTPS. Use `http://YOUR_IP:PORT` for everything during local testing.

4. **Timeouts:**  
   If the error happens on a specific action (e.g. after payment), increase timeout on the client for that request, or ensure the server responds quickly and doesn’t close the connection early.

5. **Session/cookie on redirect:**  
   After external redirect (e.g. Stripe), ensure session cookie is sent (SameSite=Lax, no Secure in dev if you’re on HTTP). So “connection lost” isn’t actually a cookie/session issue on the landing page.

**Expected after fix:** Full flow (e.g. checkout and return) completes on iPhone without “connection was lost”.

---

### 4.4 Pages load on desktop but not on iPhone

**Likely causes:**

- Desktop uses `localhost`; iPhone must use `YOUR_IP`. You’re opening the wrong URL on iPhone.
- Server bound to `127.0.0.1` only; iPhone can’t reach it.
- Firewall on PC blocking incoming connections on the dev port.
- VPN or Private Relay breaking local network.
- Different behaviour (e.g. caching, redirect) on Safari/iOS.

**Fixes:**

1. **Use same “logical” origin on both:**  
   On iPhone, open explicitly `http://YOUR_PC_IP:PORT`. Don’t rely on links that might point to localhost.

2. **Bind to 0.0.0.0:**  
   Server: `app.listen(PORT, '0.0.0.0', ...)`. Restart and test again.

3. **Windows Firewall:**  
   Allow inbound TCP on your dev port (e.g. 3000) for “Private” networks.  
   - Windows Security → Firewall & network protection → Advanced → Inbound rules → New rule → Port → TCP, 3000 (or your PORT) → Allow connection → apply to Private.  
   Or temporarily disable firewall for one test to confirm.

4. **Network:**  
   Same Wi‑Fi; VPN off on PC; Private Relay off on iPhone (Section 1.1).

5. **Reproduce on iPhone:**  
   Try the exact same path (e.g. `/login.html`) and method (GET). If it works on PC with `http://YOUR_IP:PORT/login.html`, it should work on phone; if not, check 404 vs “connection lost” and apply the right subsection above.

**Expected after fix:** Every page that loads on desktop at `http://YOUR_IP:PORT/...` also loads on iPhone.

---

### 4.5 Links work on desktop but not on iPhone

**Likely causes:**

- Links are built with `localhost` or wrong base in JS (e.g. nav or “back to home”).
- `href` is empty or `#` and behaviour depends on JS that fails on iOS (e.g. 404 for script).
- Different base path (e.g. `<base href="/">` wrong when served from subpath).
- Touch/click handling (e.g. wrong target or prevented default) — less common for normal links.

**Fixes:**

1. **Root-relative or origin-relative links:**  
   Use `href="/login.html"` or `href="/"`.  
   In JS: `const base = window.location.origin; link.href = base + '/login.html';`

2. **No localhost in generated links:**  
   Search your HTML/JS for `localhost`, `127.0.0.1`, and replace with dynamic origin or root-relative path.

3. **Ensure nav/JS loads:**  
   If links are injected by JS, a 404 for that script will break them. Fix JS loading (Section 3 and 4.1/4.2); then links will work on iPhone too.

4. **Base tag:**  
   If present, remove or set from `window.location.origin + '/'` so it’s correct when opened from any device.

**Expected after fix:** Tapping a link on iPhone goes to the correct page, same as desktop.

---

## 5. Local dev server settings that MUST be correct for phone testing

- [ ] **Bind to all interfaces**  
  Listen on `0.0.0.0`, not only `127.0.0.1`.  
  **Express:** `app.listen(PORT, '0.0.0.0', () => { ... });`  
  **Expected:** Server log shows it’s listening on 0.0.0.0; you can open `http://YOUR_IP:PORT` from another device.

- [ ] **Firewall (Windows)**  
  Inbound TCP allowed for your dev port (e.g. 3000) on Private profile.  
  **Expected:** iPhone on same Wi‑Fi can open `http://YOUR_IP:PORT`.

- [ ] **Static directory / file serving**  
  - Static middleware mounts the directory that contains `index.html`, `styles.css`, and JS files.  
  - Route order: API and explicit routes first; then static; then any catch-all for SPA.  
  **Expected:** Requests to `/styles.css`, `/script.js` hit your static or explicit routes and return 200.

- [ ] **Content-Type for CSS and JS**  
  - CSS: `Content-Type: text/css; charset=utf-8`  
  - JS: `Content-Type: application/javascript; charset=utf-8`  
  Set in explicit routes or in `express.static` `setHeaders` by extension.  
  **Expected:** In browser or inspector, CSS/JS responses show these types; Safari applies them.

- [ ] **No hardcoded localhost in frontend**  
  - No `http://localhost:3000` or `127.0.0.1` in HTML or in JS that runs in the browser.  
  - Redirect URLs, Stripe success/cancel URLs, and API bases should use `req.protocol + '://' + req.get('host')` on server, and `window.location.origin` (or root-relative paths) on client.  
  **Expected:** From iPhone, all requests go to `http://YOUR_IP:PORT`, not localhost.

- [ ] **Session cookie (if you use sessions)**  
  In development over HTTP: `cookie.secure = false`.  
  **Expected:** After login on iPhone, session persists across requests.

- [ ] **CSP (if used)**  
  Allow `'self'` for scripts and styles; if you load from CDNs, allow those origins.  
  **Expected:** No “blocked by Content-Security-Policy” in console for your assets.

---

## 6. 10-minute quick test (before every demo)

Run this script on your PC and phone once before a demo. All items should pass.

### On PC (before picking up phone)

- [ ] **1.** Start dev server.  
  **Pass:** Console shows “Server started” (or equivalent) with port and `0.0.0.0`.

- [ ] **2.** Note your IP: run `ipconfig`, get IPv4 for Wi‑Fi.  
  **Pass:** You have `192.168.x.x`.

- [ ] **3.** In browser on PC open `http://YOUR_IP:PORT`.  
  **Pass:** Homepage loads with full styling and nav.

- [ ] **4.** Open `http://YOUR_IP:PORT/styles.css` in a new tab.  
  **Pass:** CSS content visible; no 404; in devtools Response headers show `Content-Type: text/css`.

### On iPhone (same Wi‑Fi; VPN/Private Relay off if needed)

- [ ] **5.** Safari → `http://YOUR_IP:PORT`.  
  **Pass:** Homepage loads (not “Safari can’t open the page”).

- [ ] **6.** Confirm styling: header/nav/footer and colours present.  
  **Pass:** Page is styled (not plain black text).

- [ ] **7.** Tap 2–3 nav links (e.g. Login, Calendar, Contact if you have them).  
  **Pass:** Each opens the correct page; no “connection lost” or blank screen.

- [ ] **8.** Go back to home; tap a link that opens an internal page again.  
  **Pass:** Navigation and back button work.

- [ ] **9.** If auth is in scope: open Login, submit credentials.  
  **Pass:** Redirect to account/dashboard; reload keeps you logged in.

- [ ] **10.** If booking/Stripe is in scope: start booking, go to checkout, then cancel (or complete).  
  **Pass:** Return to your site (e.g. confirmation or calendar) without “connection lost”.

**Pass criteria:** All 10 checkboxes pass.  
**If any fail:** Use Section 4 (diagnostic tree) and Section 3 (asset verification) to fix, then re-run this script.

---

*End of iPhone Mobile Testing Guide. Keep this file in the project and run Section 6 before every demo.*
