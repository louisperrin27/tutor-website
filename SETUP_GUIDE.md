# Account System Setup & Testing Guide

## 🔧 Setup Steps

### 1. Install Dependencies (if not already done)
```bash
npm install
```

This installs:
- `express-session` (for user sessions)
- `bcrypt` (for password hashing)
- Other existing dependencies

### 2. Configure Environment Variables

Edit your `.env` file and add the following line (if not already present):

```env
SESSION_SECRET=your-random-secret-key-change-this-in-production
```

**Important**: Replace `your-random-secret-key-change-this-in-production` with a long, random string. You can generate one using:
- Online generator: https://randomkeygen.com/
- Or run in Node.js: `require('crypto').randomBytes(32).toString('hex')`

**Example**:
```env
SESSION_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

### 3. Database Migration

The server will automatically migrate your existing database when it starts. The migration:
- Checks if the `users` table has the new columns (`password_hash`, `created_at`, `updated_at`)
- If not, adds them automatically
- Sets default timestamps for any existing user records

### 4. Start the Server

```bash
npm start
```

The server should start on `http://localhost:3000` (or the port specified in your `.env`).

**Watch the console output** - you should see:
- `Checking users table schema` (with existing columns listed)
- Either `Users table already has required columns` OR `Users table migration completed`

If you see migration errors, the server logs will show details.

---

## 🧪 Testing the Account System

### Test 1: Create Account (Signup)

1. **Navigate to**: `http://localhost:3000/singup.html`

2. **Fill in the form**:
   - Full Name: `John Doe` (minimum 2 characters)
   - Email: `john@example.com` (must be valid email format)
   - Password: `password123` (minimum 8 characters)

3. **Click "Create Account"**

4. **Expected result**:
   - Success message: "Account created successfully! Redirecting..."
   - Automatic redirect to `account.html` after ~1.5 seconds
   - Account page shows: "Logged in as: john@example.com"

### Test 2: Login

1. **Navigate to**: `http://localhost:3000/login.html`

2. **Fill in the form**:
   - Email: `john@example.com` (the email you just used)
   - Password: `password123` (the password you just used)

3. **Click "Sign In"**

4. **Expected result**:
   - Success message: "Logged in successfully! Redirecting..."
   - Automatic redirect to `account.html`
   - Account page shows your email

### Test 3: Account Page (Protected Route)

1. **Navigate to**: `http://localhost:3000/account.html`

2. **If logged in**: Should show your account info
   - Email address
   - Logout button

3. **If NOT logged in**: Should automatically redirect to `login.html`

### Test 4: Logout

1. **From account page**: Click "Logout" button

2. **Expected result**:
   - Redirected to `login.html`
   - Session is cleared
   - Cannot access `account.html` without logging in again

### Test 5: Session Persistence

1. **Login** at `login.html`
2. **Close the browser tab**
3. **Open a new tab** and navigate to `account.html`
4. **Expected**: Should still be logged in (session persists for 24 hours)

---

## 🐛 Troubleshooting

### Error: "Failed to create account. Please try again later."

**Check the server console** for detailed error messages. Common causes:

1. **Database schema issue**:
   - **Solution**: Restart the server. The migration should run automatically on startup.
   - Look for migration logs in the console

2. **Missing SESSION_SECRET**:
   - **Solution**: Add `SESSION_SECRET` to your `.env` file (see step 2 above)
   - Restart the server after adding it

3. **Port already in use**:
   - **Solution**: Stop any other instance of the server, or change the port in your `.env`

### Error: "Database schema error. Please restart the server to run migrations."

- **Solution**: Stop the server (Ctrl+C) and restart it with `npm start`
- Check the console logs for migration details

### Error: "An account with this email already exists"

- This means the email is already in the database
- Try with a different email address
- Or clear the database (backup first!) and try again

### Cannot see server logs

- Make sure you're running `npm start` (not `node server.js` directly)
- Check that `logger.js` is working correctly
- Logs should appear in the console where you started the server

---

## 📋 Quick Checklist

Before testing, ensure:
- [ ] `npm install` completed successfully
- [ ] `SESSION_SECRET` is added to `.env` file
- [ ] Server starts without errors (`npm start`)
- [ ] Migration logs appear in console (checking/migrating users table)
- [ ] Server is accessible at `http://localhost:3000`

---

## 🔐 Security Notes

- **Development**: The default `SESSION_SECRET` fallback is insecure. Always set a proper secret in `.env`
- **Production**: 
  - Use a strong, random `SESSION_SECRET`
  - Set `NODE_ENV=production` in `.env` to enable secure cookies (HTTPS only)
  - Use HTTPS in production

---

## 📝 Testing Different Scenarios

### Invalid Inputs:
- **Short name** (< 2 chars): Should show validation error
- **Invalid email**: Should show email validation error
- **Short password** (< 8 chars): Should show password length error
- **Existing email**: Should show "account already exists" error

### Edge Cases:
- **Very long names/emails**: Should be sanitized/truncated
- **Special characters in name**: Should be sanitized safely
- **Multiple browser tabs**: Sessions should persist across tabs

---

## 🆘 Still Having Issues?

1. **Check server logs**: Look for error messages in the console
2. **Verify database**: Check if `data.db` exists and is accessible
3. **Test database directly**: 
   ```bash
   sqlite3 data.db ".schema users"
   ```
   Should show columns: `id`, `email`, `name`, `password_hash`, `created_at`, `updated_at`
4. **Clear and restart**: 
   - Backup `data.db` if needed
   - Delete `data.db` to start fresh
   - Restart server (will recreate with correct schema)
