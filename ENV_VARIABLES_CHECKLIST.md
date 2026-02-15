# Environment Variables Checklist

Use this to verify your `.env.example` file has all required variables.

## ✅ Required Variables (Must be in .env.example)

### Stripe Configuration
- [ ] `STRIPE_SECRET_KEY` (or `STRIPE_SECRET` - both work)
  - Placeholder: `sk_test_your_stripe_secret_key_here`
  - Get from: https://dashboard.stripe.com/apikeys

- [ ] `STRIPE_WEBHOOK_SECRET`
  - Placeholder: `whsec_your_webhook_signing_secret_here`
  - Get from: Stripe Dashboard → Webhooks → Signing secret

### Session Security
- [ ] `SESSION_SECRET`
  - Placeholder: `your-random-secret-key-change-this-in-production`
  - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Admin Access
- [ ] `ADMIN_KEY`
  - Placeholder: `your-strong-admin-key-here`
  - Generate a strong random string

### Email Configuration (iCloud SMTP)
- [ ] `EMAIL_USER`
  - Placeholder: `your-email@icloud.com`
  - Your iCloud email address

- [ ] `EMAIL_PASS`
  - Placeholder: `your-app-specific-password-here`
  - Get from: https://support.apple.com/en-us/102654 (App-Specific Password)

- [ ] `EMAIL_TO`
  - Placeholder: `your-email@icloud.com`
  - Where notifications are sent (usually same as EMAIL_USER)

## ⚙️ Optional Variables (Recommended but not required)

- [ ] `PORT`
  - Placeholder: `3000`
  - Default: 3000 if not set

- [ ] `NODE_ENV`
  - Placeholder: `production` (or `development`)
  - Options: `development`, `production`

- [ ] `LOG_LEVEL`
  - Placeholder: `INFO`
  - Options: `DEBUG`, `INFO`, `WARN`, `ERROR`
  - Default: `INFO` if not set

---

## 📋 Complete .env.example Template

Copy this entire template to your `.env.example` file:

```env
# ============================================
# Stripe Configuration
# Get your keys from: https://dashboard.stripe.com/apikeys
# ============================================
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret_here

# ============================================
# Session Security
# Generate a random 32+ character string for production
# You can generate one using: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# ============================================
SESSION_SECRET=your-random-secret-key-change-this-in-production

# ============================================
# Admin Access
# Generate a strong, random admin key for accessing the admin panel
# ============================================
ADMIN_KEY=your-strong-admin-key-here

# ============================================
# Email Configuration (iCloud SMTP)
# For iCloud, you need to use an App-Specific Password: https://support.apple.com/en-us/102654
# ============================================
EMAIL_USER=your-email@icloud.com
EMAIL_PASS=your-app-specific-password-here
EMAIL_TO=your-email@icloud.com

# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# Optional: Logging
# LOG_LEVEL=INFO (options: DEBUG, INFO, WARN, ERROR)
# ============================================
# LOG_LEVEL=INFO
```

---

## 🔍 How to Verify Your .env.example

1. **Open your `.env.example` file**
2. **Check each item in the checklist above**
3. **Make sure all placeholders are present** (no real keys!)
4. **Verify format matches the template**

---

## ⚠️ Common Mistakes to Avoid

- ❌ **Don't put real keys** (even test keys) in `.env.example`
- ❌ **Don't use your actual SESSION_SECRET** - use a placeholder
- ❌ **Don't use your actual ADMIN_KEY** - use a placeholder
- ✅ **Do use descriptive placeholders** that explain what goes there
- ✅ **Do include comments** explaining where to get values

---

## 📝 Variables Found in Code

Based on code analysis, these variables are used:

**Required (validated in production):**
- `STRIPE_SECRET_KEY` or `STRIPE_SECRET` (line 235, 40)
- `STRIPE_WEBHOOK_SECRET` (line 474)
- `SESSION_SECRET` (line 101)
- `ADMIN_KEY` (lines 1505, 1508, 1540, 1543)
- `EMAIL_USER` (lines 619, 1443, 1456, 1779)
- `EMAIL_PASS` (lines 620, 1443, 1456, 1780)
- `EMAIL_TO` (lines 23, 630, 639, 649, 1466, 1786)

**Optional:**
- `NODE_ENV` (lines 26, 102, 112, 1840)
- `PORT` (line 1852)
- `LOG_LEVEL` (used in logger.js)

---

## ✅ Verification Command

After updating `.env.example`, you can verify it's not in `.gitignore`:

```bash
# Check if .env.example is tracked (should be YES)
git ls-files | grep .env.example

# If nothing shows, add it:
git add .env.example
```
