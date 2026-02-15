# Signup Debugging Guide

## 🔍 Quick Checks

### 1. Check Browser Console (F12 → Console)
Look for:
- JavaScript errors
- Network errors (red entries)
- Validation errors

### 2. Check Server Console
Look for:
- Error messages when you submit
- "Signup failed" logs
- Database errors
- bcrypt errors

### 3. Common Issues & Fixes

#### Issue: "An account with this email already exists"
**Fix:** Use a different email:
- `test2@example.com`
- `test3@example.com`
- `testuser@example.com`

#### Issue: bcrypt Error (after dependency update)
**Fix:** Rebuild bcrypt:
```bash
npm rebuild bcrypt
```
Then restart server.

#### Issue: Database Schema Error
**Fix:** Restart the server (migrations run on startup):
```bash
# Stop server (Ctrl+C)
npm start
```

#### Issue: "Password hashing error"
**Fix:** This might be bcrypt v6 issue. Try:
1. Rebuild: `npm rebuild bcrypt`
2. Restart server
3. If still fails, temporarily revert: `npm install bcrypt@^5.1.1`

---

## 🧪 Test Steps

1. **Open browser DevTools** (F12)
2. **Go to Console tab**
3. **Try signup** with:
   - Name: `test one`
   - Email: `test1@example.com`
   - Password: `test1111!!`
4. **Check Console for errors**
5. **Check Network tab** → Find `/api/signup` request
   - Click on it
   - Check "Response" tab for error message

---

## 📋 What Error Are You Seeing?

Please check and tell me:

1. **Browser Console Error:**
   - What does it say?

2. **Server Console Error:**
   - What does it say when you submit?

3. **Network Response:**
   - In DevTools → Network → `/api/signup`
   - What status code? (200, 400, 409, 500?)
   - What response body?

---

## 🔧 Quick Fixes to Try

### Fix 1: Rebuild bcrypt
```bash
npm rebuild bcrypt
npm start
```

### Fix 2: Use Different Email
Try:
- `test2@example.com` (if test1 already exists)
- `testuser@example.com`
- `testaccount@example.com`

### Fix 3: Check Server Logs
When you submit, watch the server console. You should see:
- Either: "User account created" (success)
- Or: "Signup failed" with error details

### Fix 4: Clear Browser Cache
Sometimes cached JavaScript can cause issues:
- Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

---

## 🎯 Most Likely Issues

1. **User already exists** (409 error)
   - Solution: Use different email

2. **bcrypt not rebuilt** (after v6 update)
   - Solution: `npm rebuild bcrypt`

3. **Server not running**
   - Solution: `npm start`

4. **Database locked** (if multiple instances)
   - Solution: Stop all server instances, restart one

---

## 📞 What to Report

If it still doesn't work, please provide:

1. **Browser Console Error** (copy/paste)
2. **Server Console Error** (copy/paste)
3. **Network Response** (status code + response body)
4. **Steps you took** (what you entered, what happened)

This will help identify the exact issue!
