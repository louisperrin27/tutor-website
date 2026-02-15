# Password Reset Email - Debugging Guide

## 🔍 Quick Checks

### 1. Check Server Logs
When you request a password reset, look for these log messages:

**Success:**
```
{"level":"INFO","message":"Password reset requested",...}
{"level":"INFO","message":"Email password reset email sent",...}
```

**Email Not Configured:**
```
{"level":"WARN","message":"Email not configured - cannot send password reset email",...}
```

**Email Send Failed:**
```
{"level":"ERROR","message":"Password reset email send failed",...}
```

### 2. Check Environment Variables
Verify these are set in your `.env` file:
```env
EMAIL_USER=your-email@icloud.com
EMAIL_PASS=your-app-specific-password
EMAIL_TO=your-inbox@example.com
```

### 3. Check Email Configuration
The email function checks:
- `EMAIL_USER` must be set
- `EMAIL_PASS` must be set
- If either is missing, email won't send (but request still succeeds for security)

---

## 🐛 Common Issues & Fixes

### Issue 1: "Email not configured" Warning
**Symptom:** Server logs show: `"Email not configured - cannot send password reset email"`

**Cause:** `EMAIL_USER` or `EMAIL_PASS` not set in `.env`

**Fix:**
1. Open `.env` file
2. Add/verify:
   ```env
   EMAIL_USER=your-email@icloud.com
   EMAIL_PASS=your-app-specific-password
   ```
3. Restart server: `npm start`

---

### Issue 2: Email Send Failed
**Symptom:** Server logs show: `"Password reset email send failed"` with error details

**Common Causes:**
1. **Wrong SMTP credentials** - Check EMAIL_USER and EMAIL_PASS
2. **SMTP server blocked** - Firewall or network issue
3. **App-specific password required** - iCloud/Gmail need app passwords
4. **Wrong SMTP host/port** - Check EMAIL_HOST and EMAIL_PORT

**Fix:**
1. Check server logs for specific error message
2. Verify SMTP credentials are correct
3. For iCloud: Generate app-specific password at appleid.apple.com
4. For Gmail: Enable 2FA and create app password
5. Test SMTP connection manually

---

### Issue 3: Email Goes to Spam
**Symptom:** Email sent successfully but not in inbox

**Fix:**
1. Check spam/junk folder
2. Check email filters
3. Add sender to contacts
4. Check email provider's spam settings

---

### Issue 4: Token Created But No Email
**Symptom:** Server logs show "Password reset requested" but no email log

**Check:**
1. Look for "password reset email sent" log message
2. If missing, check for "Email not configured" warning
3. Check for "Password reset email send failed" error

---

## 🧪 Testing Email Configuration

### Test 1: Check Environment Variables
```bash
# In PowerShell, check if variables are loaded:
node -e "require('dotenv').config(); console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET'); console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? 'SET' : 'NOT SET');"
```

### Test 2: Check Server Startup
When server starts, you should see:
```
{"level":"INFO","message":"Environment variables loaded","emailTo":"configured"}
```

If you see `"emailTo":"not configured"`, EMAIL_TO is missing (but EMAIL_USER/PASS might still be set).

### Test 3: Request Password Reset
1. Request password reset
2. Check server console for:
   - `"Password reset requested"` - ✅ Request received
   - `"password reset email sent"` - ✅ Email sent successfully
   - `"Email not configured"` - ❌ EMAIL_USER/PASS missing
   - `"Password reset email send failed"` - ❌ SMTP error

---

## 🔧 Manual Email Test

You can test email sending directly by checking if other emails work:

1. **Test Contact Form:**
   - Go to `/contact.html`
   - Submit contact form
   - Check if email is received
   - If contact form emails work, password reset should work too

2. **Check Booking Emails:**
   - Complete a booking
   - Check if booking confirmation email is received
   - If booking emails work, password reset should work too

---

## 📋 What to Check Right Now

1. **Server Console:**
   - When you request password reset, what log messages appear?
   - Copy/paste the relevant log lines

2. **Environment Variables:**
   - Open `.env` file
   - Verify `EMAIL_USER` and `EMAIL_PASS` are set
   - Are they correct values?

3. **Email Provider:**
   - Are you using iCloud? (needs app-specific password)
   - Are you using Gmail? (needs app password with 2FA)
   - Have you tested email sending from other parts of the site?

---

## 🚨 Quick Fixes

### Fix 1: Add Missing Email Config
If `EMAIL_USER` or `EMAIL_PASS` is missing:

1. Edit `.env` file
2. Add:
   ```env
   EMAIL_USER=your-email@icloud.com
   EMAIL_PASS=your-app-specific-password
   ```
3. Restart server

### Fix 2: Test SMTP Connection
If emails aren't sending, test the SMTP connection:

```javascript
// Create test-email.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.mail.me.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('SMTP connection failed:', error);
  } else {
    console.log('✅ SMTP connection successful!');
  }
});
```

Run: `node test-email.js`

---

## 📞 What to Report

If email still doesn't work, please provide:

1. **Server Log Output:**
   - Copy the log messages when you request password reset
   - Look for: "Password reset requested", "password reset email sent", or error messages

2. **Environment Variables Status:**
   - Are EMAIL_USER and EMAIL_PASS set in `.env`?
   - What email provider are you using? (iCloud, Gmail, etc.)

3. **Other Emails Working?**
   - Do contact form emails work?
   - Do booking confirmation emails work?

4. **Error Messages:**
   - Any specific error messages in server logs?

---

## ✅ Expected Behavior

**When email is configured correctly:**
1. Request password reset → Server logs: "Password reset requested"
2. Email sent → Server logs: "password reset email sent"
3. Email received in inbox (check spam if not in inbox)

**When email is NOT configured:**
1. Request password reset → Server logs: "Password reset requested"
2. Email NOT sent → Server logs: "Email not configured - cannot send password reset email"
3. User still sees success message (security - generic response)
4. No email received

---

**Check your server console logs first - they will tell you exactly what's happening!**
