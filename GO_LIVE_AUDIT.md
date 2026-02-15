# Go-Live Readiness Audit Report
**Date:** 2025-01-27  
**Project:** Tutoring Website with Booking & Payment System  
**Auditor:** Senior Full-Stack Engineer

---

## 📋 Executive Summary

**Go-Live Verdict:** ⚠️ **Nearly Ready** (with critical fixes required)

**Architecture Overview:**
This is a Node.js/Express tutoring website with SQLite database, Stripe payment integration, user authentication, and a booking system. The application uses a static HTML/CSS/JS frontend with server-side API routes for bookings, payments, user accounts, and admin management. The codebase shows good structure with input validation, rate limiting, and security middleware, but several critical deployment and security issues must be addressed before production launch.

---

## 🚨 Top 5 Risks (by Severity)

### 1. **HIGH: Missing Environment Variable Validation** 
- **Where:** `server.js` lines 60, 178, 417, 1436
- **Issue:** Server starts even if critical env vars (STRIPE_SECRET_KEY, SESSION_SECRET, STRIPE_WEBHOOK_SECRET, ADMIN_KEY) are missing, using insecure fallbacks
- **Impact:** Payments may fail silently, sessions vulnerable to hijacking, admin panel unprotected
- **Fix:** Add startup validation that fails fast if required vars are missing in production

### 2. **HIGH: Security Vulnerabilities in Dependencies**
- **Where:** `package.json` dependencies
- **Issue:** 6 vulnerabilities found (4 high, 2 moderate): bcrypt, body-parser, nodemailer, qs, tar
- **Impact:** Potential DoS attacks, path traversal, memory exhaustion
- **Fix:** Run `npm audit fix` and update bcrypt to v6.0.0 (breaking change - test thoroughly)

### 3. **HIGH: Content Security Policy Disabled**
- **Where:** `server.js` line 49
- **Issue:** `contentSecurityPolicy: false` - CSP completely disabled for debugging
- **Impact:** XSS attacks possible, no protection against malicious scripts
- **Fix:** Re-enable CSP with proper directives for production

### 4. **MEDIUM: No Trust Proxy Configuration**
- **Where:** `server.js` - missing `app.set('trust proxy', true)`
- **Issue:** Webhook signature verification may fail behind reverse proxy (nginx/cloudflare)
- **Impact:** Stripe webhooks may be rejected, bookings not confirmed after payment
- **Fix:** Add trust proxy configuration before middleware setup

### 5. **MEDIUM: Insecure Session Secret Fallback**
- **Where:** `server.js` line 60
- **Issue:** Falls back to `'change-me-in-production-use-env-variable'` if SESSION_SECRET missing
- **Impact:** Session cookies can be forged if secret is predictable
- **Fix:** Fail startup if SESSION_SECRET not set in production

---

## ✅ Audit Categories

### A) Build & Run
**Status:** ✅ **PASS**

- ✅ `npm install` works cleanly
- ✅ `npm start` script exists and runs server
- ✅ ES modules configured correctly (`"type": "module"`)
- ✅ All imports resolve correctly
- ✅ Database auto-creates on first run
- ⚠️ No Node.js engine version specified in package.json (should add `"engines": { "node": ">=18.0.0" }`)

**Evidence:**
- `package.json` has valid start script
- Server initializes database schema automatically
- No broken imports detected

---

### B) Environment & Secrets
**Status:** ❌ **FAIL**

**Issues:**
1. ❌ **No `.env.example` file** - developers don't know what variables are required
2. ❌ **No startup validation** - server starts with missing/invalid env vars
3. ❌ **Insecure fallbacks** - SESSION_SECRET defaults to predictable string
4. ⚠️ **Multiple env var names** - `STRIPE_SECRET_KEY` OR `STRIPE_SECRET` (inconsistent)

**Required Environment Variables:**
- `STRIPE_SECRET_KEY` or `STRIPE_SECRET` (Stripe API key)
- `STRIPE_WEBHOOK_SECRET` (Stripe webhook signing secret)
- `SESSION_SECRET` (session cookie encryption key)
- `ADMIN_KEY` (admin panel authentication)
- `EMAIL_USER` (SMTP username)
- `EMAIL_PASS` (SMTP password)
- `EMAIL_TO` (recipient email for notifications)
- `PORT` (optional, defaults to 3000)
- `NODE_ENV` (should be "production" in prod)

**Fix Required:**
```javascript
// Add to server.js after dotenv.config()
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'SESSION_SECRET',
  'ADMIN_KEY',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_TO'
];

if (process.env.NODE_ENV === 'production') {
  const missing = requiredEnvVars.filter(v => !process.env[v]);
  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    process.exit(1);
  }
}
```

**Action:** Create `.env.example` file with all required variables (values as placeholders)

---

### C) Payments (Stripe)
**Status:** ⚠️ **MOSTLY OK** (with fixes needed)

**What Works:**
- ✅ Stripe Checkout session creation
- ✅ Webhook endpoint exists at `/stripe/webhook`
- ✅ Raw body parsing for webhook signature verification
- ✅ Idempotent booking creation (checks for existing booking)
- ✅ Success/cancel URLs use dynamic base URL from request
- ✅ Metadata includes slot_id for booking linkage

**Issues:**
1. ⚠️ **No webhook signature validation error handling** - returns 400 but doesn't log enough context
2. ⚠️ **Fallback booking creation in `/checkout/success`** - may create duplicate bookings if webhook fires simultaneously
3. ⚠️ **No refund/cancellation logic** - if user cancels, payment is processed but slot may remain booked
4. ⚠️ **No Stripe test mode detection** - should warn if using test keys in production

**Evidence:**
- `server.js` lines 410-515: Webhook handler
- `server.js` lines 658-754: Checkout session creation
- `server.js` lines 757-838: Success redirect with fallback booking

**Recommended Fixes:**
1. Add idempotency check using Stripe event ID to prevent duplicate processing
2. Add refund endpoint for cancellations
3. Add test mode detection and warnings

---

### D) Auth & Sessions
**Status:** ⚠️ **MOSTLY OK** (with fixes needed)

**What Works:**
- ✅ Password hashing with bcrypt (10 salt rounds)
- ✅ Session middleware configured
- ✅ Cookie security: `httpOnly: true`, `secure: true` in production, `sameSite: 'lax'`
- ✅ Rate limiting on auth endpoints (10 attempts per 15 min)
- ✅ Guest vs logged-in flows handled
- ✅ Session expiration: 24 hours

**Issues:**
1. ❌ **Insecure SESSION_SECRET fallback** - line 60 uses predictable default
2. ⚠️ **No CSRF protection** - forms vulnerable to CSRF attacks
3. ⚠️ **No password strength requirements** - only checks length (8 chars)
4. ⚠️ **No account lockout** - brute force still possible with rate limiting alone

**Evidence:**
- `server.js` lines 58-69: Session configuration
- `server.js` lines 940-1089: Signup/login routes
- `server.js` lines 932-938: Auth rate limiter

**Recommended Fixes:**
1. Fail startup if SESSION_SECRET missing in production
2. Add CSRF tokens for state-changing operations
3. Add password strength validation (uppercase, lowercase, number, special char)

---

### E) Data Integrity & Booking Logic
**Status:** ✅ **PASS**

**What Works:**
- ✅ Atomic booking creation using database transactions
- ✅ Slot reservation with timeout (30 min hold)
- ✅ Prevents double-booking (UNIQUE constraint on `bookings.slot_id`)
- ✅ Server-side input validation and sanitization
- ✅ Timezone handling uses ISO strings (UTC)
- ✅ Status transitions: available → reserved → booked

**Evidence:**
- `server.js` lines 448-489: Transaction-based booking in webhook
- `server.js` lines 685-691: Atomic slot reservation
- `server.js` lines 270-278: Database schema with UNIQUE constraint

**Minor Issues:**
- ⚠️ No timezone conversion for display (all times stored as UTC, displayed as-is)
- ⚠️ No cleanup job for expired reservations (relies on webhook for expired sessions)

---

### F) Security Hardening
**Status:** ❌ **FAIL**

**What Works:**
- ✅ Helmet middleware installed
- ✅ Rate limiting on sensitive endpoints
- ✅ Input validation and sanitization
- ✅ SQL injection protection (parameterized queries)
- ✅ XSS protection via sanitization

**Critical Issues:**
1. ❌ **CSP disabled** - `contentSecurityPolicy: false` (line 49)
2. ❌ **6 dependency vulnerabilities** - high severity in bcrypt, qs, tar
3. ⚠️ **No CSRF protection** - forms vulnerable
4. ⚠️ **No file upload handling** - not applicable but worth noting
5. ⚠️ **Admin endpoints protected but no audit logging** - admin actions not logged

**Evidence:**
- `server.js` line 49: CSP disabled
- `npm audit` output: 4 high, 2 moderate vulnerabilities
- No CSRF middleware found

**Required Fixes:**
1. Re-enable CSP with proper directives
2. Update vulnerable dependencies: `npm audit fix`
3. Add CSRF protection (e.g., `csurf` middleware)
4. Add admin action logging

---

### G) Error Handling & Logging
**Status:** ⚠️ **MOSTLY OK**

**What Works:**
- ✅ Structured logging with `logger.js`
- ✅ Request logging middleware
- ✅ Error logging with context
- ✅ No console.log spam (uses logger)

**Issues:**
1. ❌ **No 404 error page** - missing routes return Express default
2. ❌ **No 500 error page** - unhandled errors return JSON/plain text
3. ⚠️ **No centralized error handler** - each route handles errors individually
4. ⚠️ **Error messages may leak info** - some errors include stack traces in responses

**Evidence:**
- `logger.js`: Structured logging utility
- `server.js` lines 29-36: Request logging middleware
- No error page HTML files found

**Recommended Fixes:**
1. Add 404.html and 500.html pages
2. Add centralized error handler middleware
3. Sanitize error responses in production (hide stack traces)

---

### H) Performance & UX Basics
**Status:** ⚠️ **MOSTLY OK**

**What Works:**
- ✅ Static file serving configured
- ✅ CSS caching disabled in development (good for dev)
- ⚠️ No compression middleware (gzip/brotli)
- ⚠️ No explicit cache headers for static assets in production

**Issues:**
1. ⚠️ No compression - responses not gzipped
2. ⚠️ No cache headers for static assets
3. ✅ Basic accessibility - form labels, ARIA attributes present in calendar.js

**Recommended Fixes:**
1. Add compression middleware: `app.use(compression())`
2. Add cache headers for static assets in production

---

### I) SEO & Analytics
**Status:** ✅ **PASS**

**What Works:**
- ✅ Meta tags (title, description) in index.html
- ✅ OpenGraph tags present
- ✅ Sitemap.xml exists
- ✅ robots.txt configured
- ✅ Canonical URLs
- ✅ Favicon configured
- ✅ Structured data (JSON-LD) in index.html
- ✅ Analytics.js file exists

**Issues:**
1. ⚠️ **Hardcoded domain in sitemap.xml** - uses `https://louisperrintutor.com` (should be configurable)
2. ⚠️ **Hardcoded domain in robots.txt** - same issue

**Evidence:**
- `sitemap.xml`: All URLs use hardcoded domain
- `robots.txt`: Sitemap URL hardcoded
- `index.html`: SEO tags present

---

### J) Deployment Readiness
**Status:** ❌ **FAIL**

**Issues:**
1. ❌ **No trust proxy configuration** - webhooks will fail behind reverse proxy
2. ❌ **Hardcoded localhost fallbacks** - lines 708, 761, 834 use `'localhost:3000'` as fallback
3. ❌ **No healthcheck endpoint** - can't monitor server health
4. ⚠️ **No production build step** - not needed (static files), but worth noting
5. ⚠️ **No process manager config** - no PM2/forever config

**Evidence:**
- `server.js` lines 708, 761, 834: `req.get('host') || 'localhost:3000'`
- No `/health` or `/healthcheck` endpoint
- No `app.set('trust proxy', true)`

**Required Fixes:**
1. Add `app.set('trust proxy', true)` before middleware
2. Remove localhost fallbacks or make them fail in production
3. Add healthcheck endpoint: `app.get('/health', (req, res) => res.json({ status: 'ok' }))`

---

## 📝 Prioritized To-Do List

### P0: Must-Fix Before Launch

#### 1. **Create `.env.example` file**
- **Why:** Developers need to know required environment variables
- **Files:** Create new `.env.example`
- **Action:**
```env
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Session Security
SESSION_SECRET=generate-a-random-32-character-string-here

# Admin Access
ADMIN_KEY=generate-a-strong-admin-key-here

# Email Configuration (iCloud SMTP)
EMAIL_USER=your-email@icloud.com
EMAIL_PASS=your-app-specific-password
EMAIL_TO=your-email@icloud.com

# Server Configuration
PORT=3000
NODE_ENV=production
```

#### 2. **Add Environment Variable Validation on Startup**
- **Why:** Prevent silent failures in production
- **Files:** `server.js` (after line 22)
- **Action:**
```javascript
// After dotenv.config()
const requiredEnvVars = process.env.NODE_ENV === 'production' ? [
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET', 
  'SESSION_SECRET',
  'ADMIN_KEY',
  'EMAIL_USER',
  'EMAIL_PASS',
  'EMAIL_TO'
] : [];

const missing = requiredEnvVars.filter(v => !process.env[v]);
if (missing.length > 0) {
  logger.error('Missing required environment variables', { missing });
  console.error('❌ Missing required environment variables:', missing.join(', '));
  console.error('Please set these in your .env file or environment.');
  process.exit(1);
}
```

#### 3. **Fix Session Secret Fallback**
- **Why:** Insecure default allows session hijacking
- **Files:** `server.js` line 60
- **Action:**
```javascript
// Replace line 60
secret: process.env.SESSION_SECRET || (() => {
  if (process.env.NODE_ENV === 'production') {
    logger.error('SESSION_SECRET is required in production');
    process.exit(1);
  }
  logger.warn('Using insecure default SESSION_SECRET in development');
  return 'change-me-in-production-use-env-variable';
})(),
```

#### 4. **Re-enable Content Security Policy**
- **Why:** XSS protection is critical
- **Files:** `server.js` line 48-51
- **Action:**
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
  crossOriginEmbedderPolicy: false,
}));
```

#### 5. **Add Trust Proxy Configuration**
- **Why:** Webhooks fail behind reverse proxy without this
- **Files:** `server.js` (after line 26, before middleware)
- **Action:**
```javascript
// After: const app = express();
// Trust proxy for accurate IP addresses and protocol detection behind reverse proxy
app.set('trust proxy', true);
```

#### 6. **Update Vulnerable Dependencies**
- **Why:** Security vulnerabilities must be patched
- **Files:** `package.json`
- **Action:**
```bash
npm audit fix
# Note: bcrypt update to v6.0.0 is breaking - test thoroughly
npm install bcrypt@^6.0.0
# Update body-parser and nodemailer
npm install body-parser@latest nodemailer@latest
```

#### 7. **Remove Localhost Fallbacks**
- **Why:** Hardcoded localhost breaks in production
- **Files:** `server.js` lines 708, 761, 834
- **Action:**
```javascript
// Replace: const host = req.get('host') || 'localhost:3000';
const host = req.get('host');
if (!host) {
  logger.error('Unable to determine host from request headers');
  return res.status(500).json({ message: 'Server configuration error' });
}
```

#### 8. **Add Healthcheck Endpoint**
- **Why:** Monitoring and load balancer health checks
- **Files:** `server.js` (add before static file serving)
- **Action:**
```javascript
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

### P1: Strongly Recommended (Fix Soon After Launch)

#### 9. **Add CSRF Protection**
- **Why:** Prevent cross-site request forgery attacks
- **Files:** `server.js`, all POST/PUT/DELETE routes
- **Action:** Install `csurf` or use `csrf` middleware, add tokens to forms

#### 10. **Add Error Pages (404/500)**
- **Why:** Better user experience on errors
- **Files:** Create `404.html`, `500.html`, add error handler middleware
- **Action:**
```javascript
// Add after routes, before static files
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err, path: req.path });
  res.status(500).sendFile(path.join(__dirname, '500.html'));
});
```

#### 11. **Add Centralized Error Handler**
- **Why:** Consistent error responses, hide stack traces in production
- **Files:** `server.js`
- **Action:** Create error handler middleware that sanitizes responses

#### 12. **Add Compression Middleware**
- **Why:** Reduce bandwidth, improve performance
- **Files:** `server.js`
- **Action:**
```javascript
import compression from 'compression';
app.use(compression());
```

#### 13. **Add Admin Action Logging**
- **Why:** Audit trail for admin operations
- **Files:** `server.js` admin routes
- **Action:** Log all admin actions (slot creation, deletion, etc.) with admin identifier

#### 14. **Make Sitemap/Robots Domain Configurable**
- **Why:** Hardcoded domain breaks for staging/dev environments
- **Files:** `sitemap.xml`, `robots.txt`
- **Action:** Generate dynamically or use environment variable

#### 15. **Add Password Strength Requirements**
- **Why:** Improve account security
- **Files:** `server.js` signup route
- **Action:** Require uppercase, lowercase, number, special character

---

### P2: Nice-to-Have (Optional Polish)

#### 16. **Add Node.js Engine Version to package.json**
- **Files:** `package.json`
- **Action:** `"engines": { "node": ">=18.0.0" }`

#### 17. **Add Cache Headers for Static Assets**
- **Files:** `server.js` static file serving
- **Action:** Set Cache-Control headers in production

#### 18. **Add Refund/Cancellation Endpoint**
- **Files:** `server.js`
- **Action:** Stripe refund API integration for booking cancellations

#### 19. **Add Cleanup Job for Expired Reservations**
- **Files:** `server.js`
- **Action:** Cron job or scheduled task to release expired slot reservations

#### 20. **Add Test Mode Detection**
- **Files:** `server.js`
- **Action:** Warn if Stripe test keys used in production

---

## 🔧 Deployment Recommendations

### Hosting Platform Options:

1. **Render.com** (Recommended)
   - Easy Node.js deployment
   - Automatic HTTPS
   - Environment variable management
   - Free tier available
   - **Setup:** Connect GitHub repo, set env vars, deploy

2. **Fly.io**
   - Good for global distribution
   - SQLite support (but consider PostgreSQL for production scale)
   - **Note:** SQLite file storage may need volume mounting

3. **Railway.app**
   - Simple deployment
   - Built-in database options
   - **Note:** Consider migrating to PostgreSQL for production

4. **Vercel/Netlify** (Not Recommended)
   - Serverless constraints may break SQLite file writes
   - Webhook endpoints need special configuration

### Database Considerations:

⚠️ **SQLite in Production:** Current setup uses SQLite (`data.db`). For production with multiple users:
- **Option 1:** Keep SQLite if single-server deployment (Render, Fly.io with volumes)
- **Option 2:** Migrate to PostgreSQL for better concurrency and backups
- **Action:** Add database backup strategy (SQLite: file backups, PostgreSQL: automated backups)

### Webhook Configuration:

1. **Stripe Dashboard:** Add webhook endpoint: `https://yourdomain.com/stripe/webhook`
2. **Events to listen for:** `checkout.session.completed`, `checkout.session.expired`
3. **Test webhook:** Use Stripe CLI for local testing: `stripe listen --forward-to localhost:3000/stripe/webhook`

### Environment Variables in Production:

Set all required variables in your hosting platform's environment variable settings. Never commit `.env` to git.

---

## ✅ Pre-Launch Checklist

- [ ] Create `.env.example` file
- [ ] Add environment variable validation
- [ ] Fix session secret fallback
- [ ] Re-enable CSP
- [ ] Add trust proxy configuration
- [ ] Update vulnerable dependencies (`npm audit fix`)
- [ ] Remove localhost fallbacks
- [ ] Add healthcheck endpoint
- [ ] Test Stripe webhook in production
- [ ] Verify all environment variables set in hosting platform
- [ ] Test booking flow end-to-end
- [ ] Test payment flow end-to-end
- [ ] Test admin panel access
- [ ] Verify email sending works
- [ ] Set up database backups (if SQLite, schedule file backups)
- [ ] Configure domain and SSL certificate
- [ ] Update sitemap.xml with production domain
- [ ] Update robots.txt with production domain
- [ ] Test 404/500 error pages (if added)
- [ ] Run `npm audit` and verify no high-severity vulnerabilities remain

---

## 📊 Summary Statistics

- **Total Issues Found:** 20
- **Critical (P0):** 8
- **High Priority (P1):** 7
- **Nice-to-Have (P2):** 5
- **Security Vulnerabilities:** 6 (4 high, 2 moderate)
- **Missing Files:** 1 (.env.example)
- **Configuration Issues:** 5

---

## 🎯 Conclusion

The codebase is **nearly ready** for production deployment but requires **8 critical fixes** before launch. The architecture is sound, security practices are mostly good, but deployment configuration and dependency vulnerabilities must be addressed. With the P0 fixes completed, the site can safely go live, with P1 items addressed in the first week post-launch.

**Estimated Time to Production-Ready:** 2-4 hours for P0 fixes + testing

---

*End of Audit Report*
