# Password Reset System - Testing Guide

## ✅ Implementation Complete

The password reset system has been implemented with the following features:

### Security Features
- ✅ Tokens stored as SHA-256 hashes (not plaintext)
- ✅ Single-use tokens (invalidated after use)
- ✅ Token expiration (1 hour)
- ✅ Rate limiting by IP (5 requests/hour)
- ✅ Rate limiting by email (3 requests/hour)
- ✅ Generic responses (prevents email enumeration)
- ✅ Password strength validation (min 8 characters)
- ✅ Password confirmation matching

### Routes Created
- `GET /forgot-password` - Forgot password page
- `POST /api/forgot-password` - Request password reset
- `GET /reset-password?token=...` - Reset password page
- `POST /api/reset-password` - Complete password reset

### Database
- `password_resets` table created with:
  - `user_id` (foreign key to users)
  - `token_hash` (SHA-256 hash of token)
  - `expires_at` (ISO timestamp)
  - `used_at` (ISO timestamp, NULL if unused)
  - `created_at` (ISO timestamp)
  - `request_ip` (IP address of request)

---

## 🧪 Testing Checklist

### Test 1: Request Password Reset (Valid Email)
**Steps:**
1. Go to `/login.html`
2. Click "Forgot password?"
3. Enter a valid email (e.g., `test1@example.com`)
4. Click "Send Reset Link"

**Expected:**
- ✅ Success message: "If that email exists in our system, we've sent a password reset link."
- ✅ Email sent (check server logs or email inbox)
- ✅ Token created in database
- ✅ Same message even if email doesn't exist (security)

**Verify:**
- Check server logs for "Password reset requested"
- Check email inbox for reset link
- Check database: `SELECT * FROM password_resets WHERE user_id = (SELECT id FROM users WHERE email = 'test1@example.com')`

---

### Test 2: Request Password Reset (Invalid Email)
**Steps:**
1. Go to `/forgot-password`
2. Enter invalid email: `notanemail`
3. Click "Send Reset Link"

**Expected:**
- ✅ Client-side validation error
- ✅ No request sent to server

---

### Test 3: Request Password Reset (Non-existent Email)
**Steps:**
1. Go to `/forgot-password`
2. Enter email that doesn't exist: `nonexistent@example.com`
3. Click "Send Reset Link"

**Expected:**
- ✅ Same generic success message (security - prevents enumeration)
- ✅ No email sent
- ✅ No token created

---

### Test 4: Use Reset Link (Valid Token)
**Steps:**
1. Request password reset for valid email
2. Open email and click reset link
3. Enter new password: `NewPassword123!`
4. Confirm password: `NewPassword123!`
5. Click "Reset Password"

**Expected:**
- ✅ Success message
- ✅ Redirect to login page after 2 seconds
- ✅ Token marked as used in database
- ✅ Password updated in database

**Verify:**
- Check database: `SELECT used_at FROM password_resets WHERE token_hash = '...'` (should have timestamp)
- Try logging in with new password (should work)
- Try logging in with old password (should fail)

---

### Test 5: Use Reset Link Twice (Token Reuse)
**Steps:**
1. Complete Test 4 successfully
2. Try to use the same reset link again

**Expected:**
- ✅ Error: "Invalid or expired reset token. Please request a new password reset."
- ✅ Token already marked as used

---

### Test 6: Expired Token
**Steps:**
1. Request password reset
2. Wait 1 hour (or manually update database: `UPDATE password_resets SET expires_at = '2020-01-01T00:00:00.000Z'`)
3. Try to use reset link

**Expected:**
- ✅ Error: "Invalid or expired reset token. Please request a new password reset."

---

### Test 7: Rate Limiting (IP)
**Steps:**
1. Request password reset 6 times from same IP within 1 hour

**Expected:**
- ✅ First 5 requests succeed
- ✅ 6th request: "Too many password reset requests. Please try again later."

---

### Test 8: Rate Limiting (Email)
**Steps:**
1. Request password reset for same email 4 times within 1 hour

**Expected:**
- ✅ First 3 requests succeed
- ✅ 4th request: Generic success message (but no email sent)

---

### Test 9: Password Validation
**Steps:**
1. Request password reset
2. Open reset link
3. Enter password: `short` (less than 8 chars)
4. Click "Reset Password"

**Expected:**
- ✅ Error: "Password must be at least 8 characters long."

---

### Test 10: Password Mismatch
**Steps:**
1. Request password reset
2. Open reset link
3. Enter password: `Password123!`
4. Enter confirm password: `Password456!`
5. Click "Reset Password"

**Expected:**
- ✅ Error: "Passwords do not match."

---

### Test 11: Invalid Token Format
**Steps:**
1. Go to `/reset-password?token=invalid-token-123`
2. Try to reset password

**Expected:**
- ✅ Error: "Invalid or expired reset token. Please request a new password reset."

---

### Test 12: Missing Token
**Steps:**
1. Go to `/reset-password` (no token parameter)
2. Try to reset password

**Expected:**
- ✅ Error: "Invalid reset link. Please request a new password reset."

---

## 🔧 Manual Testing Steps

### Quick Test Flow:
```bash
# 1. Start server
npm start

# 2. Open browser
http://localhost:3000/login.html

# 3. Click "Forgot password?"

# 4. Enter test email (must be existing user)
test1@example.com

# 5. Check server logs for:
# - "Password reset requested"
# - "password reset email sent"

# 6. Check email inbox for reset link

# 7. Click reset link in email

# 8. Enter new password
NewPassword123!

# 9. Confirm password
NewPassword123!

# 10. Click "Reset Password"

# 11. Should redirect to login

# 12. Try logging in with new password (should work)
```

---

## 📋 Database Queries for Testing

### Check if token was created:
```sql
SELECT pr.*, u.email 
FROM password_resets pr 
JOIN users u ON u.id = pr.user_id 
WHERE u.email = 'test1@example.com' 
ORDER BY pr.created_at DESC 
LIMIT 1;
```

### Check if token was used:
```sql
SELECT used_at FROM password_resets 
WHERE token_hash = '...' AND used_at IS NOT NULL;
```

### Manually expire a token (for testing):
```sql
UPDATE password_resets 
SET expires_at = '2020-01-01T00:00:00.000Z' 
WHERE user_id = (SELECT id FROM users WHERE email = 'test1@example.com');
```

---

## ⚙️ Environment Variables

### Required (Production):
- `EMAIL_USER` - SMTP username
- `EMAIL_PASS` - SMTP password
- `EMAIL_TO` - Notification recipient
- `APP_BASE_URL` - Base URL for reset links (e.g., `https://louisperrintutor.com`)

### Optional:
- `EMAIL_HOST` - SMTP host (default: `smtp.mail.me.com`)
- `EMAIL_PORT` - SMTP port (default: `587`)
- `EMAIL_FROM` - From address (default: uses EMAIL_USER)

### Development:
- `APP_BASE_URL` can be left empty (auto-detects from request headers)
- For testing emails, use Mailtrap or Ethereal (configure via EMAIL_HOST/PORT)

---

## 🐛 Troubleshooting

### Email not sending:
- Check `EMAIL_USER` and `EMAIL_PASS` are set
- Check server logs for email errors
- Verify SMTP settings (host, port)
- For dev: Consider using Mailtrap/Ethereal

### Reset link not working:
- Check token is in URL: `/reset-password?token=...`
- Check server logs for token validation errors
- Verify token hasn't expired (1 hour limit)
- Verify token hasn't been used already

### Rate limiting issues:
- Wait 1 hour for rate limit to reset
- Or clear rate limit cache (restart server)

---

## ✅ Success Criteria

All tests pass if:
- ✅ Valid email receives reset link
- ✅ Invalid/non-existent email gets generic response
- ✅ Reset link works once, then invalid
- ✅ Token expires after 1 hour
- ✅ Rate limiting works (IP and email)
- ✅ Password validation works
- ✅ New password allows login
- ✅ Old password fails after reset

---

**Implementation Date:** 2025-01-27  
**Files Modified:** `server.js`, `login.html`  
**Files Created:** `forgot-password.html`, `reset-password.html`
