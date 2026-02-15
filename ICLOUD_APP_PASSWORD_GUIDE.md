# iCloud App-Specific Password Setup

## 🔐 The Problem

You're seeing this error:
```
Invalid login: 535 5.7.8 Error: authentication failed
```

This happens because **iCloud requires an app-specific password** for SMTP, not your regular iCloud password.

---

## ✅ Solution: Generate an App-Specific Password

### Step 1: Go to Apple ID Settings
1. Visit: https://appleid.apple.com
2. Sign in with your Apple ID (`louperrin@icloud.com`)

### Step 2: Generate App-Specific Password
1. Go to **"Sign-In and Security"** section
2. Scroll down to **"App-Specific Passwords"**
3. Click **"Generate an app-specific password"**
4. Enter a label (e.g., "Tutoring Website SMTP")
5. Click **"Create"**
6. **Copy the password** (it will look like: `abcd-efgh-ijkl-mnop`)

### Step 3: Update Your .env File
1. Open your `.env` file
2. Find the line: `EMAIL_PASS=...`
3. Replace it with:
   ```env
   EMAIL_PASS=abcd-efgh-ijkl-mnop
   ```
   (Use the actual password you just generated)

### Step 4: Restart Server
1. Stop the server (Ctrl+C)
2. Start it again: `npm start`
3. Try password reset again

---

## 📋 Important Notes

### App-Specific Password Format
- Format: `xxxx-xxxx-xxxx-xxxx` (4 groups of 4 characters)
- No spaces needed in `.env` file
- Example: `EMAIL_PASS=abcd-efgh-ijkl-mnop`

### Security
- App-specific passwords are **one-time use** (you can only see them once)
- If you lose it, generate a new one
- You can revoke app-specific passwords at any time
- Each app should have its own password

### Two-Factor Authentication Required
- You **must** have 2FA enabled on your Apple ID
- If you don't have 2FA, enable it first at appleid.apple.com

---

## 🧪 Test After Fixing

1. Update `.env` with app-specific password
2. Restart server
3. Request password reset again
4. Check server logs - should see:
   ```
   "password reset email sent"
   ```
   Instead of:
   ```
   "Password reset email send failed"
   ```

---

## 🔍 Verify Your .env File

Your `.env` should have:
```env
EMAIL_USER=louperrin@icloud.com
EMAIL_PASS=your-app-specific-password-here
EMAIL_TO=your-inbox@example.com
```

**Make sure:**
- ✅ `EMAIL_PASS` is an app-specific password (not your regular password)
- ✅ No quotes around the password
- ✅ No extra spaces
- ✅ Password is the full 16-character code (with or without dashes)

---

## ❓ Still Not Working?

If you still get authentication errors after using an app-specific password:

1. **Verify 2FA is enabled:**
   - Go to appleid.apple.com
   - Check "Sign-In and Security"
   - Make sure "Two-Factor Authentication" is ON

2. **Generate a new app-specific password:**
   - Old passwords might be revoked
   - Generate a fresh one

3. **Check .env file:**
   - Make sure there are no extra spaces
   - Make sure password is on one line
   - Restart server after changes

4. **Test SMTP connection:**
   ```bash
   node test-email-config.js
   ```
   This will verify your SMTP credentials work.

---

**Once you update `EMAIL_PASS` with an app-specific password and restart the server, the password reset emails should work!**
