# iPhone Safari Local Network Testing Audit

**Test Address:** `http://192.168.0.133`  
**Date:** 2025-01-27  
**Focus:** Mobile Safari reliability over local network

---

## Executive Summary

The application is **mostly ready** for iPhone Safari testing over local network, but has **3 critical issues** and **2 potential issues** that need fixing.

### Critical Issues:
1. ❌ **Password reset email links may use wrong host** - Network IP detection logic flaw
2. ❌ **Cookie SameSite='lax' may block session cookies on iOS Safari HTTP**
3. ❌ **Missing user-agent logging for mobile debugging**

### Potential Issues:
4. ⚠️ **Host header detection may fail if port is missing**
5. ⚠️ **No explicit error handling for network IP detection failures**

---

## 1. Server Binding ✅

**Status:** ✅ **CORRECT**

**Code Location:** `server.js` lines 2314-2322

```javascript
app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server started', {
    port: PORT,
    nodeEnv: process.env.NODE_ENV || 'development',
    host: '0.0.0.0', // Accessible from all network interfaces
  });
});
```

**Analysis:**
- Server correctly binds to `0.0.0.0` (all network interfaces)
- Not bound to `localhost` or `127.0.0.1`
- Accessible from iPhone at `192.168.0.133:3000`

**No changes needed.**

---

## 2. Network Addressing ⚠️

**Status:** ⚠️ **NEEDS FIX**

### Issue 2.1: Password Reset URL Generation Logic Flaw

**Code Location:** `server.js` lines 1242-1276 (`getBaseUrl` function)

**Problem:**
The `getBaseUrl` function only attempts network IP detection when the host header contains "localhost" or "127.0.0.1". However, when accessed from iPhone at `192.168.0.133`, the Host header will be `192.168.0.133:3000` (or `192.168.0.133` if port 80), which doesn't trigger the network IP detection.

**Why This Affects iPhone:**
- If user requests password reset from iPhone, `req.get('host')` returns `192.168.0.133:3000`
- Function uses this directly without validation
- If port is missing or host header is malformed, URL generation fails
- Email links may be incorrect if server has multiple network interfaces

**Current Logic:**
```javascript
let host = req.get('host');
// Only detects network IP if host contains localhost/127.0.0.1
if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
  // Network IP detection...
}
// Otherwise uses host directly - may be wrong interface
return `${protocol}://${host}`;
```

**Fix Required:**
1. Always validate and normalize the host header
2. Ensure port is included if missing
3. Add fallback to network IP detection if host header seems incorrect
4. Log the host header for debugging

**Code Change:**
```javascript
const getBaseUrl = (req) => {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  const protocol = req.protocol || 'http';
  let host = req.get('host');
  
  // Normalize host: ensure port is included if missing
  if (host && !host.includes(':')) {
    const port = process.env.PORT || 3000;
    host = `${host}:${port}`;
  }
  
  // If host is localhost/127.0.0.1, detect network IP
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          const port = process.env.PORT || 3000;
          host = `${iface.address}:${port}`;
          logger.info('Using network IP for password reset link', { 
            host, 
            originalHost: req.get('host'),
            userAgent: req.get('user-agent')
          });
          break;
        }
      }
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        break;
      }
    }
  }
  
  // Validate host before returning
  if (!host || host.length === 0) {
    logger.error('Unable to determine host for password reset', { 
      headers: req.headers,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
    throw new Error('Server configuration error: unable to determine base URL');
  }
  
  // Log for debugging mobile requests
  if (req.get('user-agent') && req.get('user-agent').includes('Mobile')) {
    logger.info('Password reset URL generated for mobile device', {
      host,
      protocol,
      userAgent: req.get('user-agent'),
      ip: req.ip
    });
  }
  
  return `${protocol}://${host}`;
};
```

### Issue 2.2: Other URL Generation Points

**Code Locations:**
- `server.js` line 786 (Stripe checkout success URL)
- `server.js` line 843 (Checkout success redirect)
- `server.js` line 920 (Error redirect)

**Status:** ✅ **CORRECT** - These use `req.get('host')` directly, which will work for iPhone requests.

**No changes needed for these.**

---

## 3. Password Reset Flow ⚠️

**Status:** ⚠️ **NEEDS FIX** (related to Issue 2.1)

### Issue 3.1: Email Link Generation

**Code Location:** `server.js` line 1285

```javascript
const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
```

**Problem:**
- Depends on `getBaseUrl()` which has the flaw described in Issue 2.1
- If network IP detection fails, email may contain wrong URL
- Token validation will fail if URL doesn't match

**Fix:** Fix `getBaseUrl()` as described in Issue 2.1.

### Issue 3.2: Token Validation Across Devices

**Code Location:** `server.js` lines 1423-1448 (GET `/reset-password`)

**Status:** ✅ **CORRECT**

**Analysis:**
- Token is validated by hash comparison (secure)
- Expiry check: `pr.expires_at > ?` (correct)
- Single-use check: `pr.used_at IS NULL` (correct)
- Works regardless of which device opens the link

**No changes needed.**

### Issue 3.3: Token Invalidation After Reset

**Code Location:** `server.js` lines 1491-1505

**Status:** ✅ **CORRECT**

**Analysis:**
- Atomic transaction ensures token is marked as used
- Password update happens in same transaction
- Works correctly across devices

**No changes needed.**

---

## 4. Cookies, Sessions, and Authentication ⚠️

**Status:** ⚠️ **POTENTIAL ISSUE**

### Issue 4.1: SameSite='lax' on iOS Safari with HTTP

**Code Location:** `server.js` lines 113-117

```javascript
cookie: {
  secure: process.env.NODE_ENV === 'production', // HTTPS only in production
  httpOnly: true, // Prevent XSS attacks
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  sameSite: 'lax'
}
```

**Problem:**
iOS Safari has stricter cookie handling than desktop browsers. With `SameSite='lax'` and HTTP (not HTTPS), Safari may:
- Block cookies in some cross-site scenarios
- Require explicit user interaction for cookie setting
- Have issues with redirects from email links

**Why This Affects iPhone:**
- User clicks password reset link from email
- Safari opens `http://192.168.0.133/reset-password?token=...`
- If cookie was set on different "site" context, Safari may block it
- Session may not persist correctly

**Testing Required:**
- Test if session cookies work when navigating from email link
- Test if cookies persist after password reset redirect

**Fix Options:**

**Option A: Use SameSite='none' for development (NOT RECOMMENDED)**
- Only works with Secure flag (requires HTTPS)
- Not suitable for HTTP local testing

**Option B: Use SameSite='lax' but ensure proper context (RECOMMENDED)**
- Current setting should work for same-origin requests
- Add explicit cookie setting after password reset
- Ensure redirects maintain cookie context

**Option C: Add explicit session refresh (RECOMMENDED)**
- After password reset, explicitly set session cookie
- Add middleware to refresh session on each request in development

**Code Change (Option C - Recommended):**
```javascript
// Add after session middleware (around line 119)
if (process.env.NODE_ENV !== 'production') {
  // In development, ensure session cookies work over HTTP
  app.use((req, res, next) => {
    // Refresh session cookie on each request to ensure it persists
    if (req.session && req.sessionID) {
      req.session.touch();
    }
    next();
  });
}
```

### Issue 4.2: Secure Flag in Development

**Status:** ✅ **CORRECT**

**Analysis:**
- `secure: process.env.NODE_ENV === 'production'` means:
  - Development: `secure: false` (works with HTTP) ✅
  - Production: `secure: true` (requires HTTPS) ✅
- Correct for local network testing

**No changes needed.**

---

## 5. Static Assets and Styling ✅

**Status:** ✅ **CORRECT**

### Issue 5.1: Static Asset Serving

**Code Location:** `server.js` lines 2279-2309

**Analysis:**
- Static middleware configured correctly
- CORS headers set: `Access-Control-Allow-Origin: *`
- Proper MIME types for CSS, JS, HTML
- Cache headers disabled in development
- Explicit routes for common JS files (lines 2228-2241)

**No changes needed.**

### Issue 5.2: Asset Paths

**Code Locations:**
- HTML files use absolute paths (`/styles.css`, `/analytics.js`)
- No relative paths that would break

**Status:** ✅ **CORRECT**

**No changes needed.**

---

## 6. Redirects and Navigation ✅

**Status:** ✅ **MOSTLY CORRECT**

### Issue 6.1: Redirect URLs

**Code Locations:**
- `server.js` line 808: Stripe success URL
- `server.js` line 809: Stripe cancel URL
- `server.js` line 845: Checkout success redirect
- `server.js` line 921: Error redirect
- `reset-password.html` line 325: Client-side redirect

**Analysis:**
- Server-side redirects use `baseUrl` from request (correct)
- Client-side redirect uses relative path `/login.html` (correct)
- All redirects should work on iPhone

**No changes needed.**

### Issue 6.2: Email Link Navigation

**Status:** ✅ **CORRECT**

**Analysis:**
- Email links use `getBaseUrl()` which should work (after fix)
- Links are absolute URLs
- Token is in query parameter (works across devices)

**No changes needed (after fixing Issue 2.1).**

---

## 7. Error Handling and Logging ⚠️

**Status:** ⚠️ **NEEDS IMPROVEMENT**

### Issue 7.1: Missing Mobile User-Agent Logging

**Code Location:** Throughout `server.js`

**Problem:**
- No explicit logging of mobile user agents
- Difficult to debug iPhone-specific issues
- No tracking of mobile vs desktop requests

**Why This Affects iPhone:**
- Can't identify if errors are iPhone-specific
- Hard to debug network issues from mobile devices
- No visibility into mobile request patterns

**Fix Required:**
Add mobile user-agent detection and logging to key endpoints:

**Code Changes:**

1. **Add mobile detection helper** (after line 436):
```javascript
// Helper: Detect mobile user agent
const isMobileRequest = (req) => {
  const ua = req.get('user-agent') || '';
  return /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
};
```

2. **Add mobile logging to password reset** (line 1402):
```javascript
logger.info('Password reset requested', { 
  userId: user.id, 
  email: validatedEmail,
  ip: requestIp,
  isMobile: isMobileRequest(req),
  userAgent: req.get('user-agent')
});
```

3. **Add mobile logging to reset completion** (line 1507):
```javascript
logger.info('Password reset completed', {
  userId: resetRecord.user_id,
  email: resetRecord.email,
  isMobile: isMobileRequest(req),
  userAgent: req.get('user-agent')
});
```

4. **Add mobile logging to request middleware** (line 62):
```javascript
app.use((req, res, next) => {
  const start = Date.now();
  const isMobile = isMobileRequest(req);
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.request(req, res, duration, { isMobile });
  });
  next();
});
```

### Issue 7.2: Network Error Handling

**Status:** ⚠️ **NEEDS IMPROVEMENT**

**Problem:**
- No specific error messages for network connectivity issues
- Generic errors don't help diagnose mobile network problems

**Fix Required:**
Add network-specific error handling:

**Code Change** (in `reset-password.html` line 317):
```javascript
} catch (err) {
  msg.style.display = "block";
  msg.style.color = "#c33";
  if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
    msg.textContent = 'Request timed out. Please check your internet connection and try again.';
  } else if (err.message && err.message.includes("Failed to fetch")) {
    msg.textContent = "Unable to connect to the server. Please check your internet connection and try again.";
  } else if (err.name === 'AbortError') {
    msg.textContent = "Request was cancelled. Please try again.";
  } else {
    msg.textContent = err.message || "Failed to reset password. Please try again.";
  }
  // Log error for debugging
  console.error('Password reset error:', err);
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.textContent = "Reset Password";
  }
}
```

---

## Summary of Required Fixes

### Critical Fixes (Must Fix):

1. **Fix `getBaseUrl()` function** (Issue 2.1)
   - Add host normalization (ensure port included)
   - Improve network IP detection
   - Add mobile-specific logging
   - **File:** `server.js` lines 1242-1276

2. **Add mobile user-agent logging** (Issue 7.1)
   - Add `isMobileRequest()` helper
   - Log mobile requests in key endpoints
   - **File:** `server.js` multiple locations

3. **Improve error handling for network issues** (Issue 7.2)
   - Add AbortError handling
   - Better error messages for network failures
   - **File:** `reset-password.html` line 317

### Recommended Fixes (Should Fix):

4. **Add session refresh middleware** (Issue 4.1)
   - Ensure session cookies persist on mobile Safari
   - **File:** `server.js` after line 119

---

## Testing Checklist for iPhone

After applying fixes, test the following on iPhone Safari:

### Basic Connectivity
- [ ] Server accessible at `http://192.168.0.133:3000`
- [ ] Homepage loads correctly
- [ ] CSS and JS files load
- [ ] Navigation works

### Password Reset Flow
- [ ] Request password reset from iPhone
- [ ] Check email for reset link
- [ ] Verify link uses `192.168.0.133` (not localhost)
- [ ] Click link on iPhone
- [ ] Reset password form loads
- [ ] Submit new password
- [ ] Redirect to login works
- [ ] Login with new password works

### Session Management
- [ ] Login from iPhone
- [ ] Session persists across page navigations
- [ ] Session persists after closing and reopening Safari
- [ ] Logout works correctly

### Static Assets
- [ ] All CSS loads correctly
- [ ] All JS loads correctly
- [ ] Font Awesome icons display
- [ ] Images load (if any)

### Error Handling
- [ ] Network errors show helpful messages
- [ ] Timeout errors are handled gracefully
- [ ] Server errors don't crash the page

---

## Implementation Priority

1. **High Priority:** Fix `getBaseUrl()` - affects password reset email links
2. **High Priority:** Add mobile logging - needed for debugging
3. **Medium Priority:** Improve error handling - better UX
4. **Low Priority:** Session refresh middleware - may not be needed if current setup works

---

## Notes

- All fixes maintain backward compatibility
- No breaking changes to existing functionality
- Changes are development-focused (production uses `APP_BASE_URL`)
- Mobile-specific improvements don't affect desktop users

---

**Last Updated:** 2025-01-27  
**Audit Version:** 1.0
