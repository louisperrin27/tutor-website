# Password Reset System - Complete Technical Explanation

This document provides a comprehensive, step-by-step explanation of the password reset system used in this codebase. It's designed for developers onboarding to the project who need to fully understand and trust the security flow.

---

## Overview

The password reset system allows users to securely reset their passwords via email. The implementation follows security best practices including token hashing, rate limiting, and email enumeration prevention.

**Key Security Principles:**
- Tokens are cryptographically secure and hashed before storage
- Single-use tokens (invalidated after successful reset)
- Time-limited tokens (1 hour expiration)
- Rate limiting prevents abuse
- Generic responses prevent email enumeration
- Atomic transactions ensure data consistency

---

## Step-by-Step Flow

### 1. User Initiates Password Reset Request

**Trigger:** User clicks "Forgot password?" link on `/login.html`

**Frontend Component:** `forgot-password.html` (lines 157-168)

The form submits a POST request to `/api/forgot-password` with the user's email address.

**Client-side validation:**
- Email format validation using `isValidEmail()` function
- Real-time validation on blur and input events
- Prevents submission of invalid email formats

**Code Location:** `forgot-password.html` lines 183-299

---

### 2. Backend Route Handles Request

**Route:** `POST /api/forgot-password`  
**Location:** `server.js` lines 1341-1420  
**Rate Limiter:** `passwordResetLimiter` (5 requests per hour per IP)

**Request Processing Flow:**

1. **Email Validation** (line 1345)
   - Validates and sanitizes email using `validateAndSanitizeEmail()`
   - Returns generic response if email is invalid (prevents enumeration)

2. **Email-based Rate Limiting** (lines 1354-1361)
   - Additional rate limiting by email address (3 requests per hour per email)
   - Uses in-memory `Map` for tracking (`emailResetLimiter`)
   - Returns generic response even when rate limited

3. **User Lookup** (line 1365)
   - Queries database: `SELECT id, email FROM users WHERE email = ?`
   - Returns generic response regardless of whether user exists (security best practice)

4. **Token Invalidation** (line 1378)
   - Deletes any existing unused reset tokens for this user
   - Prevents multiple active tokens: `DELETE FROM password_resets WHERE user_id = ? AND used_at IS NULL`

---

### 3. Token Generation

**Function:** `generateResetToken()`  
**Location:** `server.js` lines 1232-1234

```javascript
const generateResetToken = () => {
  return randomBytes(32).toString('hex');
};
```

**Token Characteristics:**
- **Type:** Cryptographically secure random bytes
- **Randomness:** Uses Node.js `crypto.randomBytes()` (cryptographically secure PRNG)
- **Length:** 32 bytes = 64 hexadecimal characters
- **Entropy:** 256 bits of entropy (extremely secure, ~2^256 possible values)

**Security Note:** This is cryptographically secure and suitable for production use.

---

### 4. Token Storage

**Database Table:** `password_resets`  
**Schema Location:** `server.js` lines 351-363

```sql
CREATE TABLE IF NOT EXISTS password_resets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,        -- SHA-256 hash of token
  expires_at TEXT NOT NULL,        -- ISO timestamp (1 hour from creation)
  used_at TEXT,                     -- NULL if unused, ISO timestamp if used
  created_at TEXT NOT NULL,
  request_ip TEXT,                  -- IP address of request
  FOREIGN KEY(user_id) REFERENCES users(id)
);
```

**Token Hashing:**
- **Function:** `hashToken()` (lines 1237-1239)
- **Algorithm:** SHA-256
- **Storage:** Only the hash is stored, never the plaintext token
- **Reason:** Even if database is compromised, tokens cannot be extracted

```javascript
const hashToken = (token) => {
  return createHash('sha256').update(token).digest('hex');
};
```

**Token Expiry:**
- **Expiry Time:** 1 hour (60 minutes)
- **Calculation:** `new Date(Date.now() + 60 * 60 * 1000).toISOString()`
- **Location:** `server.js` line 1383

**Storage Process** (lines 1387-1390):
1. Generate plaintext token (64 hex chars)
2. Hash token with SHA-256
3. Calculate expiry timestamp (1 hour from now)
4. Store hash, expiry, user_id, IP, and creation timestamp

**Security Features:**
- ✅ Token stored as hash (not plaintext)
- ✅ Indexed on `token_hash` for fast lookups
- ✅ Indexed on `expires_at` for cleanup queries
- ✅ Foreign key constraint ensures referential integrity

---

### 5. Reset Email Construction and Sending

**Function:** `sendPasswordResetEmail()`  
**Location:** `server.js` lines 1279-1333

**Email Service Configuration:**
- **Service:** Nodemailer (SMTP)
- **Host:** `process.env.EMAIL_HOST || 'smtp.mail.me.com'` (defaults to iCloud SMTP)
- **Port:** `process.env.EMAIL_PORT || '587'` (TLS/STARTTLS)
- **Authentication:** Uses `EMAIL_USER` and `EMAIL_PASS` from environment variables
- **From Address:** `process.env.EMAIL_FROM || "Louis Perrin Tutor" <EMAIL_USER>`

**Reset Link Format:**
```
{baseUrl}/reset-password?token={plaintextToken}
```

**Base URL Determination** (function `getBaseUrl()`, lines 1242-1276):
1. Checks `process.env.APP_BASE_URL` first (production override)
2. Falls back to auto-detection from request headers
3. In development, detects network IP for mobile device access
4. Format: `{protocol}://{host}`

**Email Content:**
- **Subject:** "Password Reset Request"
- **Text Version:** Plain text with reset link
- **HTML Version:** Styled button with reset link
- **Security Notice:** States link expires in 1 hour and can only be used once

**Email Sending** (lines 1318-1332):
- Uses async/await for error handling
- Logs success/failure
- Returns boolean indicating success
- Fails gracefully if email not configured (logs warning, doesn't crash)

**Security Note:** The plaintext token is only present in:
1. The email sent to the user
2. The URL when the user clicks the link
3. Never stored in the database (only the hash is stored)

---

### 6. User Clicks Reset Link

**Route:** `GET /reset-password?token=...`  
**Location:** `server.js` lines 1423-1448

**Processing Flow:**

1. **Token Extraction** (line 1424)
   - Extracts token from query parameter: `req.query.token`

2. **Token Validation** (lines 1431-1439)
   - Hashes the provided token: `hashToken(token)`
   - Queries database for matching hash:
     ```sql
     SELECT pr.id, pr.user_id, pr.expires_at, pr.used_at, u.email 
     FROM password_resets pr 
     JOIN users u ON u.id = pr.user_id 
     WHERE pr.token_hash = ? 
       AND pr.expires_at > ? 
       AND pr.used_at IS NULL
     ```
   - Checks three conditions:
     - Token hash matches
     - Token hasn't expired (`expires_at > now`)
     - Token hasn't been used (`used_at IS NULL`)

3. **Response:**
   - If token is valid: Serves `reset-password.html` page
   - If token is invalid/expired/used: Still serves page (validation happens on POST)

**Frontend Token Handling** (`reset-password.html` lines 186-192):
- Extracts token from URL: `new URLSearchParams(window.location.search).get('token')`
- Stores token in hidden form field
- Validates token presence before form submission

---

### 7. Token Validation on Password Reset

**Route:** `POST /api/reset-password`  
**Location:** `server.js` lines 1451-1526  
**Rate Limiter:** `passwordResetLimiter` (same as request endpoint)

**Validation Steps:**

1. **Token Presence Check** (lines 1455-1457)
   - Ensures token is provided and is a string
   - Returns 400 if missing

2. **Password Validation** (lines 1460-1466)
   - Minimum length: 8 characters
   - Type check: Must be string
   - Confirmation match: `password === confirmPassword`

3. **Token Hash and Lookup** (lines 1470-1478)
   - Hashes provided token: `hashToken(token)`
   - Queries database with same conditions as GET endpoint:
     - Hash matches
     - Not expired (`expires_at > now`)
     - Not used (`used_at IS NULL`)

4. **Validation Failure** (lines 1480-1484)
   - Returns 400 with generic error message
   - Does not reveal whether token was invalid, expired, or already used

**Security Features:**
- ✅ Token validated before any password operations
- ✅ Expiry checked against current time
- ✅ Single-use enforcement (checks `used_at IS NULL`)
- ✅ Generic error messages (doesn't reveal why token failed)

---

### 8. New Password Validation, Hashing, and Storage

**Location:** `server.js` lines 1486-1505

**Password Validation:**
- **Minimum Length:** 8 characters (line 1460)
- **Type Check:** Must be string (line 1460)
- **Confirmation Match:** Both passwords must match exactly (line 1464)

**Password Hashing:**
- **Algorithm:** bcrypt
- **Salt Rounds:** 10 (line 1487)
- **Function:** `bcrypt.hash(password, saltRounds)` (line 1488)
- **Security:** bcrypt is industry-standard, slow by design to resist brute force

**Atomic Transaction** (lines 1491-1503):
The password update and token invalidation happen in a single database transaction:

```javascript
const txn = db.transaction(() => {
  // Update user password
  db.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(
    passwordHash,
    now,
    resetRecord.user_id
  );

  // Mark token as used
  db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, resetRecord.id);

  return true;
});
txn();
```

**Why Atomic:**
- Ensures both operations succeed or both fail
- Prevents race conditions
- Guarantees token is marked as used if password is updated

**Database Updates:**
1. `users.password_hash` → Updated with new bcrypt hash
2. `users.updated_at` → Updated to current timestamp
3. `password_resets.used_at` → Set to current timestamp (marks token as used)

---

### 9. Attack Prevention Mechanisms

#### A. Token Reuse Prevention
- **Mechanism:** `used_at` timestamp field
- **Enforcement:** Token validation checks `used_at IS NULL` (lines 1438, 1477)
- **Result:** Once a token is used, it cannot be used again
- **Location:** Token marked as used in transaction (line 1500)

#### B. Brute Force Prevention
- **IP-based Rate Limiting:**
  - 5 requests per hour per IP address
  - Location: `passwordResetLimiter` (lines 1026-1032)
  - Uses `express-rate-limit` middleware

- **Email-based Rate Limiting:**
  - 3 requests per hour per email address
  - Location: `emailResetLimiter` Map (lines 1035-1043)
  - In-memory tracking with automatic cleanup

- **Password Reset Attempt Rate Limiting:**
  - Same `passwordResetLimiter` applies to reset attempts
  - Prevents brute force token guessing

#### C. Email Enumeration Prevention
- **Generic Responses:** Always returns same message regardless of email existence
- **Location:** Lines 1348-1350, 1358-1360, 1368-1370, 1416-1418
- **Message:** "If that email exists in our system, we've sent a password reset link."
- **Effect:** Attacker cannot determine if an email is registered

#### D. Token Guessing Prevention
- **Token Entropy:** 256 bits (2^256 possible values)
- **Cryptographic Security:** Uses `crypto.randomBytes()` (CSPRNG)
- **Hash Storage:** Even with database access, tokens cannot be extracted
- **Expiry:** 1-hour window limits attack window

#### E. Timing Attack Mitigation
- **Consistent Response Times:** Generic responses prevent timing-based enumeration
- **Database Queries:** Similar query structure for valid/invalid emails
- **No Early Returns:** Processing continues even for invalid emails

#### F. Session Invalidation (Not Implemented)
- **Current State:** Sessions are not invalidated after password reset
- **Security Implication:** User remains logged in on other devices with old password
- **Recommendation:** See "Security Improvements" section below

---

### 10. Post-Reset Actions

**Location:** `server.js` lines 1507-1518

**Actions Taken:**

1. **Token Invalidation** ✅
   - Token marked as used (`used_at` set to timestamp)
   - Prevents reuse

2. **Password Update** ✅
   - New password hash stored in database
   - Old password hash replaced

3. **Response to User** ✅
   - Success message returned
   - Redirect URL provided: `/login.html`

4. **Logging** ✅
   - Event logged: "Password reset completed"
   - Includes user ID and email

**What Does NOT Happen:**

❌ **Session Invalidation:** Existing sessions are NOT invalidated
- **Impact:** User remains logged in on other devices
- **Risk:** If password was compromised, attacker may still have access
- **Code Comment:** Lines 1512-1513 acknowledge this limitation

❌ **Auto-Login:** User is NOT automatically logged in
- **Behavior:** User must manually log in with new password
- **Reason:** Security best practice - explicit authentication required

**Frontend Behavior** (`reset-password.html` lines 308-316):
- Shows success message
- Auto-redirects to login page after 2 seconds
- User must log in with new password

---

## Security Analysis

### ✅ Security Strengths

1. **Token Security:**
   - Cryptographically secure generation (256-bit entropy)
   - SHA-256 hashing before storage
   - Single-use enforcement
   - 1-hour expiration

2. **Rate Limiting:**
   - Dual-layer (IP + email)
   - Prevents abuse and brute force

3. **Email Enumeration Prevention:**
   - Generic responses
   - Consistent behavior

4. **Password Security:**
   - bcrypt hashing (10 rounds)
   - Minimum length enforcement
   - Confirmation matching

5. **Atomic Operations:**
   - Transaction ensures consistency
   - Prevents race conditions

### ⚠️ Security Improvements Needed

#### 1. Session Invalidation After Password Reset

**Current State:** Sessions remain active after password reset

**Risk:** If password was compromised, attacker may still have access via existing session

**Recommendation:**
```javascript
// After successful password reset, invalidate all sessions
// This would require session store modification
// Option 1: Store session IDs in database and check on each request
// Option 2: Use Redis session store with user_id mapping
// Option 3: Add session_version to users table and increment on password change

// Example implementation (requires session store changes):
const invalidateUserSessions = (userId) => {
  // This is a placeholder - actual implementation depends on session store
  // For SQLite-based sessions, you'd need to:
  // 1. Store session_id -> user_id mapping
  // 2. Delete all sessions for this user_id
  // 3. Or add session_version to users and check on each request
};
```

**Priority:** Medium (mitigates ongoing attack if password was compromised)

---

#### 2. Token Cleanup Job

**Current State:** Expired tokens remain in database indefinitely

**Risk:** Database bloat over time

**Recommendation:**
```javascript
// Add periodic cleanup job
setInterval(() => {
  const now = nowISO();
  const deleted = db.prepare(
    'DELETE FROM password_resets WHERE expires_at < ? OR used_at IS NOT NULL'
  ).run(now);
  logger.info('Password reset tokens cleaned up', { deleted: deleted.changes });
}, 24 * 60 * 60 * 1000); // Run daily
```

**Priority:** Low (performance/maintenance issue, not security)

---

#### 3. Password Strength Requirements

**Current State:** Only minimum length (8 characters) required

**Recommendation:** Add additional requirements:
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Priority:** Low (enhances security but 8+ chars is acceptable minimum)

---

#### 4. Rate Limiting Storage

**Current State:** Email-based rate limiting uses in-memory Map

**Risk:** Lost on server restart, not shared across instances

**Recommendation:** Store in database or Redis for persistence and multi-instance support

**Priority:** Low (only affects high-availability deployments)

---

#### 5. Token in URL Logging

**Current State:** Reset tokens appear in URL query parameters

**Risk:** Tokens may be logged in:
- Web server access logs
- Browser history
- Referrer headers (if user clicks external link)

**Recommendation:** Consider using POST-only token validation or token in request body instead of URL

**Priority:** Low (common practice, but could be improved)

---

#### 6. Email Rate Limiting Response

**Current State:** Returns generic success even when rate limited

**Current Behavior:** Correct (prevents enumeration)

**Note:** This is actually a security feature, not a bug. The generic response prevents attackers from determining if an email is rate-limited vs. non-existent.

---

## Code Locations Reference

### Backend Routes
- `GET /forgot-password` → `server.js` line 1336
- `POST /api/forgot-password` → `server.js` line 1341
- `GET /reset-password` → `server.js` line 1423
- `POST /api/reset-password` → `server.js` line 1451

### Helper Functions
- `generateResetToken()` → `server.js` line 1232
- `hashToken()` → `server.js` line 1237
- `getBaseUrl()` → `server.js` line 1242
- `sendPasswordResetEmail()` → `server.js` line 1279

### Rate Limiters
- `passwordResetLimiter` → `server.js` line 1026
- `emailResetLimiter` → `server.js` line 1035

### Database Schema
- `password_resets` table → `server.js` lines 351-363

### Frontend Pages
- `forgot-password.html` → Root directory
- `reset-password.html` → Root directory

---

## Testing Recommendations

### Manual Testing Checklist

1. ✅ Request reset with valid email → Email sent
2. ✅ Request reset with invalid email → Generic response
3. ✅ Request reset with non-existent email → Generic response (no enumeration)
4. ✅ Use reset link → Password updated
5. ✅ Reuse reset link → Fails (token already used)
6. ✅ Expired token → Fails (token expired)
7. ✅ Rate limiting (IP) → Blocks after 5 requests/hour
8. ✅ Rate limiting (email) → Blocks after 3 requests/hour
9. ✅ Password validation → Enforces 8+ characters
10. ✅ Password mismatch → Rejects non-matching passwords
11. ✅ Login with new password → Success
12. ✅ Login with old password → Fails

### Security Testing

1. **Token Guessing:** Attempt to guess valid token (should fail)
2. **Token Reuse:** Try using same token twice (should fail)
3. **Expired Token:** Wait 1+ hour, try token (should fail)
4. **Email Enumeration:** Try multiple emails, check response timing (should be consistent)
5. **Rate Limit Bypass:** Try different IPs/emails (should still be limited)

---

## Summary

The password reset system is **well-implemented** with strong security foundations:

✅ **Secure token generation and storage**
✅ **Single-use, time-limited tokens**
✅ **Rate limiting (dual-layer)**
✅ **Email enumeration prevention**
✅ **Atomic transactions**
✅ **Proper password hashing**

⚠️ **Recommended Improvements:**
- Session invalidation after password reset
- Token cleanup job for expired tokens
- Enhanced password strength requirements (optional)

**Overall Security Rating:** **Strong** - Production-ready with minor improvements recommended.

---

**Last Updated:** 2025-01-27  
**Documentation Version:** 1.0  
**Codebase Version:** As of latest commit
