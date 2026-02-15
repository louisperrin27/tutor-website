# Password Hashing Verification Guide

## Step 5: Password Hashing Verification

This guide shows you how to verify that passwords are properly hashed in the database after the bcrypt v6 update.

---

## Method 1: Direct Database Query (Recommended)

### Prerequisites
- SQLite3 command-line tool installed
- Access to `data.db` file

### Steps

1. **Open terminal/command prompt** in your project directory

2. **Query the database:**
   ```bash
   sqlite3 data.db "SELECT id, email, password_hash FROM users LIMIT 5;"
   ```

   Or for a specific user:
   ```bash
   sqlite3 data.db "SELECT id, email, password_hash FROM users WHERE email = 'test@example.com';"
   ```

3. **Verify the hash format:**
   - ✅ **Correct:** Hash starts with `$2b$` or `$2a$` (bcrypt format)
   - ✅ **Correct:** Hash is approximately 60 characters long
   - ❌ **Wrong:** Hash is the plaintext password (e.g., "MyPassword123!")
   - ❌ **Wrong:** Hash is shorter than 50 characters
   - ❌ **Wrong:** Hash doesn't start with `$2`

### Example Output

**✅ Good (Properly Hashed):**
```
1|test@example.com|$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy
```

**❌ Bad (Plaintext - NOT HASHED):**
```
1|test@example.com|TestPassword123!
```

---

## Method 2: Using Node.js Script (More Detailed)

Create a verification script to check password hashing:

### Create `verify-passwords.js`:

```javascript
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';

const db = new Database('data.db');

console.log('Checking password hashes in database...\n');

const users = db.prepare('SELECT id, email, password_hash FROM users').all();

let allValid = true;

for (const user of users) {
  const hash = user.password_hash;
  
  // Check hash format
  const isBcryptFormat = hash.startsWith('$2a$') || hash.startsWith('$2b$') || hash.startsWith('$2y$');
  const isCorrectLength = hash.length >= 59 && hash.length <= 61;
  
  console.log(`User: ${user.email}`);
  console.log(`  Hash: ${hash.substring(0, 20)}...`);
  console.log(`  Length: ${hash.length} characters`);
  console.log(`  Format: ${isBcryptFormat ? '✅ Valid bcrypt format' : '❌ Invalid format'}`);
  console.log(`  Length check: ${isCorrectLength ? '✅ Correct length' : '❌ Wrong length'}`);
  
  if (!isBcryptFormat || !isCorrectLength) {
    console.log(`  ⚠️  WARNING: This password may not be properly hashed!`);
    allValid = false;
  }
  
  console.log('');
}

if (allValid) {
  console.log('✅ All passwords are properly hashed!');
} else {
  console.log('❌ Some passwords may not be properly hashed. Check the warnings above.');
}

db.close();
```

### Run the script:

```bash
node verify-passwords.js
```

---

## Method 3: Verify Hash Can Be Used for Login

The best way to verify hashing works is to test the actual login flow:

1. **Create a test user** (if you haven't already):
   - Sign up at `/singup.html`
   - Email: `test@example.com`
   - Password: `TestPassword123!`

2. **Check the database:**
   ```bash
   sqlite3 data.db "SELECT password_hash FROM users WHERE email = 'test@example.com';"
   ```
   - Verify it's a bcrypt hash (starts with `$2b$`)

3. **Try to login:**
   - Go to `/login.html`
   - Use email: `test@example.com`
   - Use password: `TestPassword123!`
   - If login succeeds, the hash is working correctly ✅

4. **Try wrong password:**
   - Use wrong password: `WrongPassword123!`
   - Should fail with "Invalid email or password" ✅

---

## Method 4: Manual bcrypt Verification (Advanced)

If you want to manually verify a hash matches a password:

### Create `test-hash.js`:

```javascript
import bcrypt from 'bcrypt';

// Get hash from database first
const hashFromDB = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
const testPassword = 'TestPassword123!';

// Verify the password matches the hash
bcrypt.compare(testPassword, hashFromDB)
  .then(match => {
    if (match) {
      console.log('✅ Password matches hash!');
    } else {
      console.log('❌ Password does NOT match hash!');
    }
  })
  .catch(err => {
    console.error('Error:', err);
  });
```

---

## What to Look For

### ✅ Valid bcrypt Hash Characteristics:

1. **Prefix:** Starts with `$2a$`, `$2b$`, or `$2y$`
   - `$2a$` = Original bcrypt
   - `$2b$` = Current bcrypt (most common)
   - `$2y$` = PHP bcrypt compatibility

2. **Structure:** `$2b$10$[22-char-salt][31-char-hash]`
   - Format: `$version$cost$salt+hash`
   - Example: `$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy`
   - `10` = cost factor (2^10 = 1024 rounds)

3. **Length:** Exactly 60 characters
   - `$2b$10$` = 7 characters
   - Salt = 22 characters
   - Hash = 31 characters
   - Total = 60 characters

### ❌ Invalid Hash (NOT HASHED):

- Plaintext password: `MyPassword123!`
- Too short: `abc123`
- Wrong format: `sha256:abc123...`
- Empty: `(empty string)`

---

## Quick Verification Checklist

- [ ] Hash starts with `$2b$`, `$2a$`, or `$2y$`
- [ ] Hash is exactly 60 characters long
- [ ] Hash is NOT the plaintext password
- [ ] Login works with correct password
- [ ] Login fails with wrong password

---

## Troubleshooting

### If hash looks wrong:

1. **Check server logs** when user signs up:
   - Look for "User account created" log entry
   - Check for any bcrypt errors

2. **Verify bcrypt is working:**
   ```javascript
   // In server.js, check line ~1073 (signup route)
   const passwordHash = await bcrypt.hash(password, saltRounds);
   ```
   - Should use `bcrypt.hash()` with 10 salt rounds

3. **Check database write:**
   - Verify `INSERT INTO users` statement includes `password_hash`
   - Check for any database errors

### If login fails but hash looks correct:

1. **Check bcrypt version compatibility:**
   - bcrypt v6 should verify v5 hashes (backward compatible)
   - If not, see "If Login Fails" section in DEPENDENCY_UPDATE_TESTING_CHECKLIST.md

2. **Verify password comparison:**
   ```javascript
   // In server.js, check line ~1182 (login route)
   const passwordMatch = await bcrypt.compare(password, user.password_hash);
   ```
   - Should use `bcrypt.compare()` not `===`

---

## Code References

**Password Hashing (Signup):**
- File: `server.js`
- Lines: ~1073-1074
- Code:
  ```javascript
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);
  ```

**Password Verification (Login):**
- File: `server.js`
- Lines: ~1182
- Code:
  ```javascript
  const passwordMatch = await bcrypt.compare(password, user.password_hash);
  ```

**Database Storage:**
- File: `server.js`
- Lines: ~1080-1083
- Code:
  ```javascript
  db.prepare(
    'INSERT INTO users (email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(validatedEmail, validatedName, passwordHash, createdAt, updatedAt);
  ```

---

**Last Updated:** 2026-02-01
