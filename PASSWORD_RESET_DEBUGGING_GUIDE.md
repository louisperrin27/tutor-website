# Password Reset System - Debugging Guide for iPhone/Local Network

## A) Overview

The password reset system allows users to securely reset their passwords via email. When a user requests a reset, the system generates a cryptographically secure random token, stores a SHA-256 hash of it in the database, sends an email with a reset link containing the plaintext token, and validates the token when the user submits a new password. The token expires after 1 hour and can only be used once. The system is designed to prevent email enumeration by always returning the same generic success message regardless of whether the email exists in the system.

---

## B) Step-by-Step Flow

### 1. "Forgot password" UI

**File:** `forgot-password.html`  
**Lines:** 157-302

**Trigger:**
- User visits `/forgot-password` (served by `GET /forgot-password` route in `server.js` line 1389)
- Form with email input field (line 159)
- Submit button "Send Reset Link" (line 166)

**Request sent:**
- **Method:** `POST`
- **URL:** `/api/forgot-password`
- **Body:** `{ "email": "user@example.com" }`
- **Headers:** `Content-Type: application/json`
- **Code location:** `forgot-password.html` lines 237-241

```javascript
const res = await fetchWithTimeout("/api/forgot-password", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
}, 10000);
```

---

### 2. Backend Reset-Request Handler

**Route:** `POST /api/forgot-password`  
**File:** `server.js`  
**Lines:** 1394-1475

**User lookup:**
```javascript
// Line 1418
const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(validatedEmail);
```

**Email enumeration prevention:**
- **Lines 1400-1403:** Invalid email → generic response
- **Lines 1410-1413:** Rate limited → generic response  
- **Lines 1425-1427:** User not found → generic response (same as if user exists)
- **Lines 1420-1423:** User found → same generic response
- **Lines 1471-1473:** Error occurs → same generic response

**Response format:**
- Always returns HTTP 200 with: `{ "message": "If that email exists in our system, we've sent a password reset link." }`
- **No difference** between existing vs non-existing emails (prevents enumeration)

---

### 3. Token Generation

**File:** `server.js`  
**Lines:** 1256-1263

**Token format:**
```javascript
// Line 1256-1258
const generateResetToken = () => {
  return randomBytes(32).toString('hex');
};
```
- **Type:** Cryptographically secure random bytes (Node.js `crypto.randomBytes`)
- **Length:** 32 bytes = 64 hexadecimal characters
- **Entropy:** 256 bits (extremely secure)

**Expiry:**
- **Duration:** 1 hour (60 minutes)
- **Code:** `server.js` line 1436: `new Date(Date.now() + 60 * 60 * 1000).toISOString()`
- **Enforcement:** Database query checks `pr.expires_at > ?` (lines 1493, 1543)

**Hashing:**
- **Algorithm:** SHA-256
- **Code:** `server.js` lines 1261-1263
```javascript
const hashToken = (token) => {
  return createHash('sha256').update(token).digest('hex');
};
```
- **Storage:** Only the hash is stored in database (line 1435), never the plaintext token
- **Reason:** Even if database is compromised, tokens cannot be extracted

---

### 4. Token Storage

**Database table:** `password_resets`  
**File:** `server.js`  
**Lines:** 363-373

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,              -- Foreign key to users.id
  token_hash TEXT NOT NULL,               -- SHA-256 hash of token
  expires_at TEXT NOT NULL,               -- ISO timestamp (1 hour from creation)
  used_at TEXT,                           -- NULL if unused, ISO timestamp if used
  created_at TEXT NOT NULL,               -- ISO timestamp
  request_ip TEXT,                        -- IP address of request
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

**Indexes:**
- `idx_password_resets_token_hash` (line 371) - Fast token lookup
- `idx_password_resets_user_id` (line 372) - Fast user lookup
- `idx_password_resets_expires_at` (line 373) - Fast expiry queries

**Token invalidation:**
- **On new request:** `server.js` line 1431 - Deletes all unused tokens for user:
  ```javascript
  db.prepare('DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL').run(user.id);
  ```
- **On successful reset:** `server.js` line 1566 - Marks token as used:
  ```javascript
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRecord.id);
  ```
- **On expiry:** Checked in queries (lines 1493, 1543) - `pr.expires_at > ?`

---

### 5. Email Sending

**File:** `server.js`  
**Lines:** 1332-1390

**Module/service:**
- **Library:** Nodemailer (`nodemailer` package)
- **SMTP Configuration:**
  - Host: `process.env.EMAIL_HOST || 'smtp.mail.me.com'` (line 1341)
  - Port: `parseInt(process.env.EMAIL_PORT || '587')` (line 1342)
  - Secure: `process.env.EMAIL_PORT === '465'` (line 1343)
  - Auth: `EMAIL_USER` and `EMAIL_PASS` from environment (lines 1345-1346)

**Reset link format:**
- **Code:** `server.js` line 1338
```javascript
const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
```
- **Format:** `{baseUrl}/reset-password?token={64-char-hex-token}`
- **Example:** `http://192.168.0.133:3000/reset-password?token=07820b7303f34d3287d96eb18307983eada07d9bbc7c4d47ad5d7a94bfb28c1a`

**Base URL determination:**
- **File:** `server.js`  
- **Function:** `getBaseUrl(req)` (lines 1266-1329)
- **Priority:**
  1. **Environment variable:** `process.env.APP_BASE_URL` (line 1267) - Used if set
  2. **Request headers:** `req.protocol` + `req.get('host')` (lines 1270-1271)
  3. **Network IP detection:** If host is `localhost`/`127.0.0.1`, detects network IP (lines 1281-1305)
     - Uses `os.networkInterfaces()` to find first non-internal IPv4 address
     - Example: `localhost:3000` → `192.168.0.133:3000`
  4. **Port normalization:** If port missing, adds `process.env.PORT || 3000` (lines 1274-1276)

**Email content:**
- **Subject:** "Password Reset Request" (line 1352)
- **Text version:** Plain text with reset link (lines 1353-1360)
- **HTML version:** Styled button with reset link (lines 1361-1369)
- **Security notice:** States link expires in 1 hour and can only be used once

---

### 6. Reset Link Landing

**Route:** `GET /reset-password`  
**File:** `server.js`  
**Lines:** 1478-1503

**Page served:**
- **File:** `reset-password.html` (line 1482, 1498, 1502)
- **Token extraction:** `reset-password.html` lines 189-194
  ```javascript
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  ```

**Token validation:**
- **On GET:** Validates token but still serves page (lines 1486-1499)
  - Hashes token: `hashToken(token)` (line 1486)
  - Queries database: `WHERE pr.token_hash = ? AND pr.expires_at > ? AND pr.used_at IS NULL` (lines 1489-1494)
  - If invalid/expired/used: Still serves page (user sees error on submit)

**POST request (actual validation):**
- **Method:** `POST`
- **Endpoint:** `/api/reset-password`
- **File:** `server.js` lines 1506-1585
- **Body:** `{ "token": "...", "password": "...", "confirmPassword": "..." }`
- **Code location:** `reset-password.html` lines 293-297

**Invalid/expired token handling:**
- **Code:** `server.js` lines 1546-1549
- **Response:** HTTP 400 with `{ "message": "Invalid or expired reset token. Please request a new password reset." }`

---

### 7. Setting the New Password

**Endpoint:** `POST /api/reset-password`  
**File:** `server.js`  
**Lines:** 1506-1585

**Validation rules:**
- **Token required:** Line 1523 - Must be non-empty string
- **Password length:** Line 1528 - Minimum 8 characters
- **Password match:** Line 1532 - `password === confirmPassword`

**Hashing:**
- **Algorithm:** bcrypt
- **Library:** `bcrypt` package
- **Salt rounds:** 10 (line 1553)
- **Code:** Line 1554
```javascript
const passwordHash = await bcrypt.hash(password, saltRounds);
```

**Database storage:**
- **Table:** `users`
- **Field:** `password_hash` (line 1559)
- **Update:** `UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?` (lines 1559-1562)
- **Transaction:** Atomic - password update and token invalidation happen together (lines 1557-1571)

**Token invalidation:**
- **Code:** Line 1566
```javascript
db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRecord.id);
```
- **Effect:** Token marked as used, cannot be reused

---

### 8. Post-Reset Behavior

**File:** `server.js`  
**Lines:** 1573-1585

**Response:**
- **Status:** HTTP 200
- **Body:** `{ "message": "Password reset successfully. You can now log in with your new password.", "redirectTo": "/login.html" }` (lines 1577-1580)

**Auto-login:**
- **No** - User is NOT automatically logged in
- **Reason:** Security best practice - explicit authentication required

**Redirect:**
- **Client-side:** `reset-password.html` lines 324-326
  ```javascript
  setTimeout(() => {
    window.location.href = data.redirectTo || '/login.html';
  }, 2000);
  ```
- **Delay:** 2 seconds (shows success message first)

**Session cookies:**
- **File:** `server.js` lines 103-120
- **Config:**
  - `secure: process.env.NODE_ENV === 'production'` (line 115)
    - **Development:** `false` (works with HTTP)
    - **Production:** `true` (requires HTTPS)
  - `httpOnly: true` (line 116) - Prevents XSS attacks
  - `sameSite: 'lax'` (line 118) - CSRF protection
  - `maxAge: 24 * 60 * 1000` (line 117) - 24 hours

**Session refresh middleware:**
- **File:** `server.js` lines 121-129
- **Purpose:** Ensures session cookies persist on mobile Safari over HTTP
- **Code:**
```javascript
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    if (req.session && req.sessionID) {
      req.session.touch();
    }
    next();
  });
}
```

**Dev vs Prod differences:**
- **Cookie Secure flag:** Dev = false (HTTP), Prod = true (HTTPS)
- **Session refresh:** Only in development
- **APP_BASE_URL:** Optional in dev (auto-detects), required in prod

---

## C) iPhone / Local-Network Risk Checklist

### ✅ Safe: No "localhost" in email links or redirects

**Status:** **SAFE** (with caveat)

**Why:**
- **Code:** `server.js` lines 1281-1305 - Network IP detection
- **Behavior:** If `req.get('host')` contains `localhost` or `127.0.0.1`, function detects network IP using `os.networkInterfaces()`
- **Example:** Request from `localhost:3000` → Email link uses `192.168.0.133:3000`

**Caveat:**
- Only triggers if Host header is `localhost`/`127.0.0.1`
- If iPhone accesses `http://192.168.0.133:3000` directly, Host header is already correct, so detection doesn't run
- **This is safe** - correct host is used

**Code reference:** `server.js` lines 1266-1329 (`getBaseUrl` function)

---

### ✅ Safe: Server binding to 0.0.0.0

**Status:** **SAFE**

**Why:**
- **Code:** `server.js` line 2316
```javascript
app.listen(PORT, '0.0.0.0', () => {
```
- **Binding:** `0.0.0.0` (all network interfaces), not `localhost` or `127.0.0.1`
- **Result:** Server accessible from iPhone at `http://192.168.0.133:3000`

---

### ✅ Safe: Cookies with Secure=false in development

**Status:** **SAFE**

**Why:**
- **Code:** `server.js` line 115
```javascript
secure: process.env.NODE_ENV === 'production',
```
- **Development:** `secure: false` (works with HTTP)
- **Production:** `secure: true` (requires HTTPS)
- **Result:** Cookies work correctly over HTTP in local testing

---

### ✅ Safe: SameSite='lax' (not 'none')

**Status:** **SAFE**

**Why:**
- **Code:** `server.js` line 118
```javascript
sameSite: 'lax'
```
- **Behavior:** `'lax'` works with HTTP and allows same-site requests
- **Not `'none'`:** Would require `Secure: true` (HTTPS only)
- **Result:** Cookies work correctly in local network testing

---

### ✅ Safe: CORS headers configured

**Status:** **SAFE**

**Why:**
- **Code:** `server.js` lines 2305, 2236
```javascript
res.setHeader('Access-Control-Allow-Origin', '*');
```
- **Location:** Static asset middleware (line 2305) and explicit JS routes (line 2236)
- **Result:** No CORS issues between frontend and backend

---

### ⚠️ Potential Issue: Session state during reset

**Status:** **MOSTLY SAFE** (but not used)

**Why:**
- **Code:** `server.js` lines 1506-1585 - Password reset endpoint
- **Behavior:** Does NOT check for existing session or log user in
- **Result:** Reset works regardless of session state
- **Note:** User must manually log in after reset (line 1579 redirects to `/login.html`)

**Potential concern:**
- If user is logged in on another device, session remains active (not invalidated)
- **This is acceptable** - password reset doesn't require session state

---

## D) Issues Found and Fixes

### Issue 1: Rate Limiter Validation Error (FIXED)

**Problem:**
- Rate limiter was throwing validation errors due to `trust proxy` setting
- Caused "Unable to connect to the server" errors on iPhone

**Fix Applied:**
- **File:** `server.js` lines 460, 470, 480, 490, 1039, 1049
- **Change:** Added `keyGenerator` to all rate limiters:
```javascript
keyGenerator: (req) => req.ip || req.connection?.remoteAddress || 'unknown',
```
- **Result:** Rate limiters work correctly with `trust proxy` enabled

---

### Issue 2: Network IP Detection Only Triggers for localhost

**Status:** **NOT AN ISSUE** (works correctly)

**Current behavior:**
- If iPhone accesses `http://192.168.0.133:3000` directly, Host header is already `192.168.0.133:3000`
- Network IP detection (lines 1281-1305) doesn't run (only runs for `localhost`/`127.0.0.1`)
- **This is correct** - correct host is already in the request

**If issue occurs:**
- Check server logs for "Using network IP for password reset link" (line 1292)
- Verify `req.get('host')` in logs matches iPhone's access URL
- If mismatch, set `APP_BASE_URL=http://192.168.0.133:3000` in `.env`

---

### Issue 3: Error Handling for Network Failures

**Status:** **IMPROVED** (fixes applied)

**Problem:**
- Safari "Load failed" errors weren't being caught properly
- Generic error messages didn't help diagnose issues

**Fix Applied:**
- **File:** `reset-password.html` lines 205-214, 327-345
- **Changes:**
  - Added `safeFetch` function with better error handling
  - Catches "Load failed" and "Failed to load" errors specifically
  - Improved error messages and console logging
  - Added `AbortError` handling

---

## Debugging Checklist for iPhone Issues

When debugging password reset failures on iPhone:

1. **Check server logs for:**
   - "Password reset requested" (line 1455) - Confirms request received
   - "Using network IP for password reset link" (line 1292) - Confirms correct URL
   - "Password reset URL generated for mobile device" (line 1320) - Confirms mobile detection
   - "Password reset attempt" (line 1511) - Confirms POST request received
   - Any error logs with `isMobile: true`

2. **Verify email link:**
   - Check email for reset link
   - Verify URL uses `192.168.0.133:3000` (not `localhost`)
   - Verify token is 64 hex characters

3. **Check iPhone network:**
   - Ensure iPhone can access `http://192.168.0.133:3000` in browser
   - Verify no firewall blocking port 3000
   - Check iPhone and server are on same network

4. **Check browser console (if accessible):**
   - Look for JavaScript errors
   - Check network tab for failed requests
   - Verify `fetchWithTimeout` function is loaded

5. **Verify token in database:**
   ```sql
   SELECT * FROM password_resets 
   WHERE user_id = (SELECT id FROM users WHERE email = 'user@example.com')
   ORDER BY created_at DESC LIMIT 1;
   ```
   - Check `expires_at` is in future
   - Check `used_at` is NULL
   - Verify `token_hash` matches SHA-256 hash of token from email

---

## Code Reference Summary

| Component | File | Lines |
|-----------|------|-------|
| Forgot password page | `forgot-password.html` | 157-302 |
| Reset password page | `reset-password.html` | 185-347 |
| GET /forgot-password | `server.js` | 1389-1391 |
| POST /api/forgot-password | `server.js` | 1394-1475 |
| GET /reset-password | `server.js` | 1478-1503 |
| POST /api/reset-password | `server.js` | 1506-1585 |
| Token generation | `server.js` | 1256-1258 |
| Token hashing | `server.js` | 1261-1263 |
| Base URL detection | `server.js` | 1266-1329 |
| Email sending | `server.js` | 1332-1390 |
| Database schema | `server.js` | 363-373 |
| Session config | `server.js` | 103-120 |
| Server binding | `server.js` | 2316 |

---

**Last Updated:** 2026-02-01  
**Version:** 1.0
