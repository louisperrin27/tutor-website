# Dependency Update Testing Checklist

## ✅ Updates Completed

- ✅ **body-parser**: `2.2.0` → `2.2.2` (safe update)
- ✅ **nodemailer**: `7.0.9` → `7.0.12` (safe update)
- ✅ **bcrypt**: `5.1.1` → `6.0.0` (BREAKING CHANGE - requires testing)
- ✅ **Vulnerabilities**: 6 → 0 (all fixed!)

---

## ⚠️ Important: bcrypt v6 Breaking Changes

**bcrypt v6.0.0** has breaking changes from v5. The main concern is:
- **Password hashing format may have changed**
- **Existing passwords may need to be rehashed**

### What to Test:

1. **New User Signups** (should work fine)
   - New passwords will use bcrypt v6 format
   - These should work without issues

2. **Existing User Logins** (may fail)
   - If login fails, passwords were hashed with bcrypt v5
   - Solution: Users need to reset passwords OR you stay on bcrypt v5

---

## 🧪 Required Testing Steps

### Step 1: Server Startup Test
**Time:** 1 minute

```bash
npm start
```

**Expected Result:**
- ✅ Server starts without errors
- ✅ No bcrypt-related errors in console
- ✅ Server listens on port 3000 (or your configured PORT)

**If it fails:**
- Check console for error messages
- May need to rebuild: `npm rebuild bcrypt`

---

### Step 2: New User Signup Test
**Time:** 2 minutes

1. **Navigate to:** `http://localhost:3000/singup.html`
2. **Create a new account:**
   - Name: `Test User`
   - Email: `test@example.com` (use a test email)
   - Password: `TestPassword123!` (at least 8 characters)
3. **Click "Create Account"**

**Expected Result:**
- ✅ Account created successfully
- ✅ Redirected to account page
- ✅ No errors in console
- ✅ Password is hashed and stored in database

**If it fails:**
- Check server console for errors
- Check browser console for errors
- Verify database connection

---

### Step 3: New User Login Test
**Time:** 1 minute

1. **Logout** (if logged in from Step 2)
2. **Navigate to:** `http://localhost:3000/login.html`
3. **Login with the account you just created:**
   - Email: `test@example.com`
   - Password: `TestPassword123!`
4. **Click "Sign In"**

**Expected Result:**
- ✅ Login successful
- ✅ Redirected to account page
- ✅ Session created

**If it fails:**
- Check if password was hashed correctly in Step 2
- Check server console for bcrypt errors

---

### Step 4: Existing User Login Test (CRITICAL)
**Time:** 2 minutes

**⚠️ This is the most important test!**

1. **Try to login with an existing account** (one created before the bcrypt update)
   - Use an account that existed before updating dependencies
   - Or create one now, then test it works

**Expected Result (Best Case):**
- ✅ Login works (bcrypt v6 is backward compatible with v5 hashes)
- ✅ No password reset needed

**Expected Result (Worst Case):**
- ❌ Login fails with "Invalid email or password"
- This means bcrypt v6 can't verify v5 hashes
- **Solution:** See "If Login Fails" section below

---

### Step 5: Password Hashing Verification
**Time:** 1-2 minutes

**Quick Method:**
1. **Check database** (if you have sqlite3 installed):
   ```bash
   sqlite3 data.db "SELECT email, password_hash FROM users LIMIT 1;"
   ```
2. **Verify password hash looks correct:**
   - ✅ Should start with `$2b$`, `$2a$`, or `$2y$` (bcrypt format)
   - ✅ Should be exactly 60 characters long
   - ❌ Should NOT be the plaintext password (e.g., "MyPassword123!")

**Detailed Guide:**
See `PASSWORD_HASHING_VERIFICATION_GUIDE.md` for:
- Multiple verification methods
- Node.js verification script
- Manual bcrypt testing
- Troubleshooting tips

---

### Step 6: Full Booking Flow Test
**Time:** 5 minutes

Test the complete flow to ensure nothing broke:

1. **Login** (or use existing session)
2. **Navigate to booking page**
3. **Select a time slot**
4. **Complete booking** (or test payment flow)
5. **Check booking appears in "My Bookings"**

**Expected Result:**
- ✅ All steps work without errors
- ✅ No authentication issues
- ✅ Booking created successfully

---

## 🚨 If Login Fails for Existing Users

### Option 1: Stay on bcrypt v5 (Temporary)
If existing users can't login, you can temporarily revert:

```bash
npm install bcrypt@^5.1.1
```

**Pros:**
- Existing users can login immediately
- No password resets needed

**Cons:**
- Security vulnerability remains (high severity)
- Should migrate to v6 eventually

### Option 2: Force Password Reset (Recommended)
If you have few users, you can:

1. **Add a password reset feature** (if not already present)
2. **Notify users to reset passwords**
3. **New passwords will use bcrypt v6 format**

### Option 3: Migration Script (Advanced)
Create a script to rehash all passwords:

```javascript
// migration-script.js (run once)
import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';

const db = new Database('data.db');
const users = db.prepare('SELECT id, email, password_hash FROM users').all();

for (const user of users) {
  // Check if hash is old format, rehash if needed
  // This is complex - only do if necessary
}
```

---

## ✅ Success Criteria

All tests pass if:
- ✅ Server starts without errors
- ✅ New user signup works
- ✅ New user login works
- ✅ Existing user login works (or you have a plan to handle failures)
- ✅ Booking flow works end-to-end
- ✅ No console errors
- ✅ No security vulnerabilities (`npm audit` shows 0)

---

## 📊 Testing Results Template

Copy this and fill it out:

```
[ ] Step 1: Server Startup - PASS / FAIL
[ ] Step 2: New User Signup - PASS / FAIL
[ ] Step 3: New User Login - PASS / FAIL
[ ] Step 4: Existing User Login - PASS / FAIL
[ ] Step 5: Password Hashing - PASS / FAIL
[ ] Step 6: Full Booking Flow - PASS / FAIL

Notes:
- Existing users can login: YES / NO
- Any errors encountered: [describe]
- Next steps: [if any issues]
```

---

## 🎯 Next Steps After Testing

If all tests pass:
1. Commit the dependency updates
2. Move to Step 9: Test Everything (from FIX_IMPLEMENTATION_GUIDE.md)
3. Prepare for deployment

If tests fail:
1. Document the specific failure
2. Decide on solution (revert bcrypt or migrate passwords)
3. Fix the issue before proceeding

---

**Estimated Testing Time:** 10-15 minutes

**Start with Step 1 and work through sequentially!**
