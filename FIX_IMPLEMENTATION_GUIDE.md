# Fix Implementation Guide
**Ordered by dependencies and impact - follow sequentially**

---

## 🎯 Phase 1: Foundation (Start Here - 30 minutes)

These fixes are independent and can be done in any order, but this order is recommended.

### Step 1: Create `.env.example` file
**Time:** 2 minutes  
**Why first:** You'll reference this while fixing other issues

1. Create a new file called `.env.example` in the project root
2. Copy this content:

```env
# Stripe Configuration
# Get your keys from: https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here

# Session Security
# Generate a random 32+ character string for production
# You can generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SESSION_SECRET=your-random-secret-key-change-this-in-production

# Admin Access
# Generate a strong, random admin key for accessing the admin panel
ADMIN_KEY=your-strong-admin-key-here

# Email Configuration (iCloud SMTP)
# For iCloud, you need to use an App-Specific Password: https://support.apple.com/en-us/102654
EMAIL_USER=your-email@icloud.com
EMAIL_PASS=your-app-specific-password-here
EMAIL_TO=your-email@icloud.com

# Server Configuration
PORT=3000
NODE_ENV=production

# Optional: Logging
# LOG_LEVEL=INFO (options: DEBUG, INFO, WARN, ERROR)
```

**✅ Test:** File exists and is readable

---

### Step 2: Add Trust Proxy Configuration
**Time:** 1 minute  
**Why:** Needed for webhooks to work behind reverse proxy (most hosting platforms)

1. Open `server.js`
2. Find line 26: `const app = express();`
3. Add this line immediately after (line 27):

```javascript
const app = express();

// Trust proxy for accurate IP addresses and protocol detection behind reverse proxy
app.set('trust proxy', true);
```

**✅ Test:** Server still starts: `npm start`

---

### Step 3: Add Healthcheck Endpoint
**Time:** 2 minutes  
**Why:** Needed for monitoring and load balancers

1. Open `server.js`
2. Find the section with API routes (around line 78, after the YouTube route)
3. Add this new route before the Stripe webhook route (around line 175):

```javascript
// Healthcheck endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

**✅ Test:** 
- Start server: `npm start`
- Visit: `http://localhost:3000/health`
- Should see: `{"status":"ok","timestamp":"...","uptime":...}`

---

## 🔒 Phase 2: Security Fixes (45 minutes)

### Step 4: Fix Session Secret Fallback
**Time:** 5 minutes  
**Why:** Prevents insecure default in production

1. Open `server.js`
2. Find line 60 (session middleware configuration)
3. Replace this line:
   ```javascript
   secret: process.env.SESSION_SECRET || 'change-me-in-production-use-env-variable',
   ```
   
   With this:
   ```javascript
   secret: process.env.SESSION_SECRET || (() => {
     if (process.env.NODE_ENV === 'production') {
       logger.error('SESSION_SECRET is required in production');
       process.exit(1);
     }
     logger.warn('Using insecure default SESSION_SECRET in development');
     return 'change-me-in-production-use-env-variable';
   })(),
   ```

**✅ Test:** 
- Server starts in development (without SESSION_SECRET)
- Set `NODE_ENV=production` and verify it fails without SESSION_SECRET

---

### Step 5: Add Environment Variable Validation
**Time:** 10 minutes  
**Why:** Prevents silent failures in production

1. Open `server.js`
2. Find line 22: `dotenv.config();`
3. Add this code block immediately after (after line 22):

```javascript
dotenv.config();
logger.info('Environment variables loaded', { emailTo: process.env.EMAIL_TO ? 'configured' : 'not configured' });

// Validate required environment variables in production
if (process.env.NODE_ENV === 'production') {
  const requiredEnvVars = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'SESSION_SECRET',
    'ADMIN_KEY',
    'EMAIL_USER',
    'EMAIL_PASS',
    'EMAIL_TO'
  ];

  const missing = requiredEnvVars.filter(v => {
    // Check both STRIPE_SECRET_KEY and STRIPE_SECRET (for backward compatibility)
    if (v === 'STRIPE_SECRET_KEY') {
      return !process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET;
    }
    return !process.env[v];
  });

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    console.error('❌ Missing required environment variables:', missing.join(', '));
    console.error('Please set these in your .env file or environment.');
    process.exit(1);
  }
}
```

**✅ Test:**
- Server starts normally in development
- Set `NODE_ENV=production` temporarily and remove a required var → should exit with error

---

### Step 6: Re-enable Content Security Policy
**Time:** 10 minutes  
**Why:** Critical XSS protection

1. Open `server.js`
2. Find lines 48-51 (helmet configuration)
3. Replace this:
   ```javascript
   app.use(helmet({
     contentSecurityPolicy: false, // Temporarily disabled for debugging CSS loading issue
     crossOriginEmbedderPolicy: false, // Allow YouTube iframes
   }));
   ```
   
   With this:
   ```javascript
   app.use(helmet({
     contentSecurityPolicy: {
       directives: {
         defaultSrc: ["'self'"],
         styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
         scriptSrc: ["'self'", "https://cdnjs.cloudflare.com", "https://www.googletagmanager.com"],
         imgSrc: ["'self'", "data:", "https:"],
         connectSrc: ["'self'", "https://api.stripe.com", "https://www.youtube.com"],
         frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com", "https://www.youtube.com"],
         fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
       },
     },
     crossOriginEmbedderPolicy: false, // Allow YouTube iframes
   }));
   ```

**✅ Test:**
- Start server: `npm start`
- Visit homepage: `http://localhost:3000`
- Check browser console for CSP errors
- If you see CSP violations, note which resources are blocked and we'll adjust

---

### Step 7: Remove Localhost Fallbacks
**Time:** 5 minutes  
**Why:** Hardcoded localhost breaks in production

1. Open `server.js`
2. Find line 708 (in `/api/create-checkout-session` route)
3. Replace:
   ```javascript
   const host = req.get('host') || 'localhost:3000';
   ```
   With:
   ```javascript
   const host = req.get('host');
   if (!host) {
     logger.error('Unable to determine host from request headers', { headers: req.headers });
     return res.status(500).json({ message: 'Server configuration error' });
   }
   ```

4. Find line 761 (in `/checkout/success` route) - do the same replacement
5. Find line 834 (also in `/checkout/success` route) - do the same replacement

**✅ Test:**
- Start server
- Try creating a checkout session (should work)
- If host is missing, should return 500 error (not use localhost)

---

## 📦 Phase 3: Dependency Updates (30 minutes)

### Step 8: Update Vulnerable Dependencies
**Time:** 20 minutes + testing  
**Why:** Security vulnerabilities must be patched

1. **First, check current versions:**
   ```bash
   npm list bcrypt body-parser nodemailer
   ```

2. **Update body-parser and nodemailer (safe updates):**
   ```bash
   npm install body-parser@latest nodemailer@latest
   ```

3. **Update bcrypt (BREAKING CHANGE - requires testing):**
   ```bash
   npm install bcrypt@^6.0.0
   ```
   
   **⚠️ Important:** bcrypt v6 has breaking changes. Test thoroughly:
   - Sign up a new user
   - Login with existing users (may need to reset passwords if using old hash format)
   - Verify password hashing still works

4. **Run audit again:**
   ```bash
   npm audit
   ```
   
   Should show fewer or no high-severity vulnerabilities.

5. **If bcrypt v6 causes issues, you can temporarily stay on v5 but note the vulnerability:**
   ```bash
   npm install bcrypt@^5.1.1
   ```
   (Then add a TODO to migrate later)

**✅ Test:**
- `npm start` - server starts
- Create new account - password hashing works
- Login - authentication works
- Check `npm audit` - vulnerabilities reduced

---

## 🧪 Phase 4: Testing & Verification (30 minutes)

### Step 9: Test All Critical Flows
**Time:** 30 minutes

Run through these scenarios:

1. **Server Startup:**
   - ✅ Server starts without errors
   - ✅ Healthcheck endpoint works: `http://localhost:3000/health`
   - ✅ No CSP errors in browser console

2. **User Authentication:**
   - ✅ Sign up new account
   - ✅ Login
   - ✅ Logout
   - ✅ Session persists

3. **Booking Flow:**
   - ✅ View available slots
   - ✅ Select slot
   - ✅ Create checkout session (paid)
   - ✅ Free session booking (if applicable)

4. **Payment Flow (use Stripe test mode):**
   - ✅ Complete test payment
   - ✅ Webhook receives event (check server logs)
   - ✅ Booking created in database
   - ✅ Confirmation email sent

5. **Admin Panel:**
   - ✅ Admin login
   - ✅ Generate slots
   - ✅ View bookings
   - ✅ Delete slots

6. **Error Handling:**
   - ✅ Missing env vars cause startup failure (in production mode)
   - ✅ Invalid requests return proper errors

---

## 📋 Quick Reference: File Locations

| Fix | File | Line(s) |
|-----|------|---------|
| Trust Proxy | `server.js` | ~27 (after `const app = express()`) |
| Healthcheck | `server.js` | ~175 (before Stripe webhook) |
| Session Secret | `server.js` | ~60 |
| Env Validation | `server.js` | ~23 (after `dotenv.config()`) |
| CSP | `server.js` | ~48-51 |
| Localhost Fallbacks | `server.js` | ~708, 761, 834 |

---

## 🚨 If Something Breaks

### Server won't start:
- Check console for error messages
- Verify `.env` file has all required variables
- Check `NODE_ENV` isn't set to `production` during development

### CSP blocking resources:
- Check browser console for CSP violation messages
- Add blocked domains to CSP directives in Step 6
- Common additions: Google Analytics, other CDNs

### bcrypt errors after update:
- If login fails, passwords may need to be rehashed
- Option: Stay on bcrypt v5 for now, add to P1 fixes
- Test with new user signups first

### Webhook not working:
- Verify `trust proxy` is set (Step 2)
- Check Stripe webhook URL is correct
- Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard

---

## ✅ Completion Checklist

After completing all steps:

- [ ] `.env.example` file created
- [ ] Trust proxy configured
- [ ] Healthcheck endpoint added and tested
- [ ] Session secret fails safely in production
- [ ] Environment variable validation added
- [ ] CSP re-enabled and tested
- [ ] Localhost fallbacks removed
- [ ] Dependencies updated (`npm audit` shows fewer issues)
- [ ] All critical flows tested
- [ ] Server starts without errors
- [ ] No CSP violations in browser console

---

## 🎯 Next Steps After P0 Fixes

Once all P0 fixes are complete:
1. Commit changes to git
2. Test in staging environment (if available)
3. Move to P1 fixes (see `GO_LIVE_AUDIT.md` for details)
4. Prepare for deployment

---

**Estimated Total Time:** 2-3 hours (including testing)

**Start with Phase 1, then move sequentially through each phase.**
