# iPhone Local Testing Debug Guide

**Problem:** `http://localhost:3000/` works on PC, fails on iPhone with “Safari can’t open the page because it couldn’t connect to the server.”

**Stack (verified):** Express app, `server.js`, `npm start` → `node server.js`. Port 3000.

---

## 1) Root cause: why localhost works on PC but not on iPhone

- **On your PC,** `localhost` (or `127.0.0.1`) means “this machine.” The browser connects to the server running on the same computer. So `http://localhost:3000/` works.

- **On your iPhone,** `localhost` means **the iPhone itself**, not your PC. There is no server listening on the iPhone’s port 3000, so Safari gets “couldn’t connect to the server.”

So the fix is **not** to use localhost on the phone. You must:
1. Use your **PC’s LAN IP** (e.g. `192.168.1.105`) in the URL on the iPhone.
2. Ensure the server is reachable from the LAN (it’s already bound to all interfaces; see below).
3. Ensure **Windows Firewall** allows inbound TCP on port 3000 so the iPhone can connect.

**Summary:** Same Wi‑Fi + correct URL (`http://<PC_LAN_IP>:3000/`) + firewall allowing port 3000 = iPhone can load the site.

---

## 2) Step-by-step checklist to get iPhone to load the site over Wi‑Fi

### 2.1 Find your PC’s LAN IP on Windows

- Open **PowerShell** or **Command Prompt** (Win + R → `cmd` → Enter).
- Run:
  ```bat
  ipconfig
  ```
- Find the section for your **Wi‑Fi adapter** (e.g. “Wireless LAN adapter Wi-Fi” or “Ethernet adapter” if you’re on ethernet).
- Note the **IPv4 Address**. It will look like `192.168.1.105` or `192.168.0.10`.
- **Use this IP in the URL on your iPhone** (see below). Do **not** use `127.0.0.1` or `localhost` on the phone.

### 2.2 Correct URL format for iPhone

- **Use exactly:** `http://<LAN_IP>:3000/`
- **Example:** If your IPv4 Address is `192.168.1.105`, on iPhone Safari open:
  ```text
  http://192.168.1.105:3000/
  ```
- For another page, e.g.:
  ```text
  http://192.168.1.105:3000/gcse_physics.html
  ```
- **Do not use:** `http://localhost:3000/` or `https://` (unless you’ve set up HTTPS).

### 2.3 Both devices must be on the same Wi‑Fi

- PC and iPhone must be on the **same** Wi‑Fi network (same SSID).
- On iPhone: Settings → Wi‑Fi → check the network name.
- On PC: system tray / Settings → Network → Wi‑Fi → check the same name.

### 2.4 Things that block connection

- **VPN on PC** — Can route traffic so the phone can’t reach `192.168.x.x`. Turn VPN off on the PC when testing.
- **iCloud Private Relay (iPhone)** — Settings → [Your name] → iCloud → Private Relay. Turn **OFF** temporarily for testing.
- **iPhone on cellular / mobile data** — Safari must be using **Wi‑Fi**, not 4G/5G. Turn off cellular data or ensure Wi‑Fi is active and used for Safari.
- **Guest Wi‑Fi / AP isolation** — Some routers isolate guest clients from the main LAN. Connect both PC and iPhone to the **same (non-guest)** Wi‑Fi if possible.
- **Windows Firewall** — Must allow inbound TCP on port 3000 (see Section 4).

---

## 3) Server binding: no code change needed

Your project was inspected: **the server already binds to all interfaces.**

**File:** `server.js` (around lines 2388–2396)

**Current code (correct):**
```js
const PORT = process.env.PORT || 3000;
// Listen on all network interfaces (0.0.0.0) to allow access from other devices on the same network
app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    host: '0.0.0.0',
  });
});
```

- So the server is **not** bound only to `127.0.0.1`. It listens on `0.0.0.0`, so it accepts connections from the LAN.
- **No edit is required** for binding. Keep port 3000 as is.

**If you ever had a server that only bound to localhost,** the fix would be:

- **Express:** Change to `app.listen(PORT, '0.0.0.0', () => { ... });`
- **Vite:** In `vite.config.js`: `server: { host: true }` or `host: '0.0.0.0'`
- **Next.js:** `next dev -H 0.0.0.0` or in `package.json`: `"dev": "next dev -H 0.0.0.0"`
- **Other Node (http.createServer):** `server.listen(PORT, '0.0.0.0', () => { ... });`

Your app is Express and already correct.

---

## 4) Windows Firewall: allow inbound TCP on port 3000

If the firewall blocks port 3000, the iPhone will get “couldn’t connect to the server” even with the right URL.

### Option A — GUI (recommended)

1. Press Win + R, type `wf.msc`, Enter (Windows Defender Firewall with Advanced Security).
2. In the left pane, click **Inbound Rules**.
3. In the right pane, click **New Rule…**.
4. Rule Type: **Port** → Next.
5. TCP, **Specific local ports:** `3000` → Next.
6. **Allow the connection** → Next.
7. Select **Private** (and Domain/Public if you want), Next.
8. Name: e.g. **Node dev server 3000** → Finish.

### Option B — PowerShell (run as Administrator)

```powershell
New-NetFirewallRule -DisplayName "Node dev server 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private
```

### Quick test: is port 3000 reachable from another device?

- From **another PC or phone** on the same Wi‑Fi:
  - Open a browser and go to `http://<YOUR_PC_IP>:3000/`.
  - Or from a second PC (PowerShell): `Test-NetConnection -ComputerName <YOUR_PC_IP> -Port 3000` (TcpTestSucceeded = True means reachable).
- If this fails, the firewall (or router/network) is still blocking; re-check the rule and network.

---

## 5) Verification plan

1. **On PC**
   - Run `ipconfig` and note IPv4 (e.g. `192.168.1.105`).
   - Start the server: `npm start` (or `node server.js`).
   - In a browser on the PC, open `http://192.168.1.105:3000/` (use your IP). It should load like localhost.

2. **From another device on same Wi‑Fi (e.g. another laptop or phone)**
   - Open `http://<PC_IP>:3000/`. If it loads, the server and firewall are fine; then test iPhone again.

3. **On iPhone**
   - Same Wi‑Fi; no VPN on PC; Private Relay off if needed.
   - In Safari, open `http://<PC_IP>:3000/` (not localhost).
   - Expected: homepage loads. Then try `http://<PC_IP>:3000/gcse_physics.html`.

4. **If it still fails**
   - **Ping (from iPhone):** Install a “Ping” or “Network Utilities” app and ping `<PC_IP>`. If ping fails, the phone can’t reach the PC at all (network/VPN/isolated Wi‑Fi).
   - **Dev server logs:** When you try to load the page on iPhone, check the terminal where `node server.js` is running. If you see a request log (e.g. GET /), the packet reached the server and the problem may be response/front-end. If you see no log at all, the connection is blocked (firewall or network).

---

## 6) Do this now (5–10 steps)

1. On your PC, open PowerShell or Command Prompt and run **`ipconfig`**. Under your Wi‑Fi adapter, note the **IPv4 Address** (e.g. `192.168.1.105`).

2. Confirm **PC and iPhone are on the same Wi‑Fi**. Turn off **VPN on the PC** and **iCloud Private Relay on the iPhone** (temporarily) if they’re on.

3. Add a **Windows Firewall** inbound rule: allow **TCP port 3000** for **Private** profile (Section 4, Option A or B).

4. Start your server on the PC: **`npm start`** (or `node server.js`). Leave it running.

5. On the **PC browser**, open **`http://<YOUR_IP>:3000/`** (replace with your real IPv4). Confirm the site loads.

6. On **iPhone Safari**, open **`http://<YOUR_IP>:3000/`** (same IP, **do not** use localhost). See if the page loads.

7. If it still fails, from **another device on the same Wi‑Fi** try **`http://<YOUR_IP>:3000/`**. If that fails too, re-check firewall and network. If that works but iPhone doesn’t, try turning off Private Relay and try again.

8. Once it works, test **`http://<YOUR_IP>:3000/gcse_physics.html`** on the iPhone.

9. **No code or route changes are required** for this; your server already listens on `0.0.0.0` and port 3000.

10. After testing, you can turn VPN and Private Relay back on if you use them normally.

---

**Summary:** Use `http://<LAN_IP>:3000/` on the iPhone (not localhost), allow port 3000 in Windows Firewall, same Wi‑Fi, and avoid VPN/Private Relay during the test. Your Express server is already set up correctly for LAN access.
