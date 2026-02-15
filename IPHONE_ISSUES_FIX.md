# iPhone Safari Issues - Fixes Applied

## ✅ Issues Fixed

### 1. CSS Not Loading on iPhone Safari
**Problem:** CSS styles not appearing on iPhone Safari (but working on Chrome desktop)

**Root Cause:** 
- Safari on iOS is stricter about MIME types
- Static file serving needed explicit Content-Type headers
- CORS headers needed for cross-origin asset loading

**Fix Applied:**
- Added explicit MIME type headers for CSS, JS, and HTML files
- Added CORS headers for static assets
- Improved static file serving configuration

### 2. Password Reset Link Not Accessible from iPhone
**Problem:** Password reset link in email doesn't work when clicked from iPhone

**Root Cause:**
- Email links were using `localhost` or `127.0.0.1` which doesn't work from mobile devices
- Need to use the actual network IP address (e.g., `192.168.0.133`)

**Fix Applied:**
- Updated `getBaseUrl()` function to detect network IP when host is localhost
- Automatically uses network IP address for password reset links in development
- For production, set `APP_BASE_URL` environment variable

---

## 🔧 Changes Made

### 1. Static File Serving (server.js)
```javascript
app.use(express.static('.', {
  setHeaders: (res, filePath) => {
    // Explicit MIME types for Safari/iOS compatibility
    const ext = path.extname(filePath).toLowerCase();
    if (ext === '.css') {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (ext === '.js') {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (ext === '.html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
    }
    // CORS headers for static assets
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
}));
```

### 2. Password Reset Link Base URL (server.js)
```javascript
const getBaseUrl = (req) => {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/$/, '');
  }
  const protocol = req.protocol || 'http';
  let host = req.get('host');
  
  // Auto-detect network IP if host is localhost (for mobile device access)
  if (host && (host.includes('localhost') || host.includes('127.0.0.1'))) {
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
      for (const iface of networkInterfaces[name]) {
        if (iface.family === 'IPv4' && !iface.internal) {
          host = `${iface.address}:${process.env.PORT || 3000}`;
          break;
        }
      }
      if (host && !host.includes('localhost') && !host.includes('127.0.0.1')) {
        break;
      }
    }
  }
  
  return `${protocol}://${host}`;
};
```

---

## 🧪 Testing

### Test 1: CSS Loading on iPhone
1. Restart server: `npm start`
2. Open Safari on iPhone
3. Go to: `http://192.168.0.133:3000`
4. **Expected:** CSS styles should load correctly
5. **Check:** Page should look the same as on desktop Chrome

### Test 2: Password Reset Link from iPhone
1. Request password reset from iPhone
2. Check email on iPhone
3. Click the reset link in email
4. **Expected:** Link should open and work correctly
5. **Check:** Link should use network IP (e.g., `http://192.168.0.133:3000/reset-password?token=...`)

---

## 📋 What to Do Now

### Step 1: Restart Server
```bash
# Stop server (Ctrl+C)
npm start
```

### Step 2: Test CSS on iPhone
1. Open Safari on iPhone
2. Go to: `http://192.168.0.133:3000`
3. Verify CSS styles are loading

### Step 3: Test Password Reset Link
1. Request password reset from iPhone
2. Check email
3. Click reset link
4. Verify it opens correctly

---

## 🔍 Troubleshooting

### CSS Still Not Loading?
1. **Clear Safari cache:**
   - Settings → Safari → Clear History and Website Data
   - Or: Settings → Safari → Advanced → Website Data → Remove All

2. **Check server logs:**
   - Look for CSS file requests
   - Verify Content-Type header is being set

3. **Hard refresh:**
   - On iPhone Safari, tap and hold the refresh button
   - Select "Reload Without Content Blockers"

### Password Reset Link Still Not Working?
1. **Check email link:**
   - Open email on iPhone
   - Long-press the link to see the URL
   - Should show: `http://192.168.0.133:3000/reset-password?token=...`
   - If it shows `localhost`, the fix didn't apply - restart server

2. **Verify network IP:**
   - Your IP might have changed
   - Find current IP: `ipconfig` (Windows) or `ifconfig` (Mac/Linux)
   - Update `.env` with `APP_BASE_URL=http://YOUR_IP:3000` if needed

3. **Set APP_BASE_URL manually:**
   - Add to `.env`: `APP_BASE_URL=http://192.168.0.133:3000`
   - Restart server
   - This ensures consistent IP usage

---

## ✅ Success Criteria

After fixes:
- ✅ CSS loads correctly on iPhone Safari
- ✅ Password reset links work when clicked from iPhone
- ✅ Links use network IP instead of localhost
- ✅ All static assets (CSS, JS, images) load properly

---

## 📝 Notes

- **Development:** Network IP auto-detection works automatically
- **Production:** Set `APP_BASE_URL` environment variable to your domain
- **Security:** CORS headers on static assets are safe for development (restrict in production if needed)

**Both issues should now be fixed! Restart your server and test.**
