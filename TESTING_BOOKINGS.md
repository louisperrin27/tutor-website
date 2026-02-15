# Testing Bookings Guide

## 📋 Prerequisites

1. **Server must be running**: `npm start` (or `node server.js`)
2. **You must be logged in**: Create an account at `/singup.html` and login at `/login.html`
3. **Slots must exist**: For real bookings, you need available time slots in the database

---

## 🧪 Testing the My Bookings Page

### Test 1: View Bookings (Empty State)

1. **Log in** to your account
2. **Navigate to**: `http://localhost:3000/account.html`
3. **Click**: "My Bookings" link
4. **Expected result**:
   - Page loads without errors
   - Shows "Future bookings" table with "No future bookings"
   - Shows "Previous bookings" table with "No previous bookings"
   - "Book a slot" button is visible below "Previous bookings"

### Test 2: Verify Table Structure

1. **On my-bookings.html page**, check:
   - ✅ Table headers show: **Activity | Date | Time** (3 columns)
   - ✅ Both tables (Future and Previous) have the same structure
   - ✅ "Book a slot" button is below "Previous bookings" table
   - ✅ Page uses correct spacing (similar to contact.html)

---

## 🎯 Testing Activity Column Mapping

The Activity column maps `amount_pence` values to display labels:

- **0 pence** (Free Session) → Shows: **"Free Session"**
- **4000 pence** (£40 - 1-to-1) → Shows: **"1-1"**
- **2000 pence** (£20 - Group) → Shows: **"Group Session"**
- **Other values** → Shows: **"Unknown"** (logs warning in server console)

### How to Test Each Activity Type:

#### Option A: Manual Database Insert (Quick Testing)

You can manually insert test bookings into the database using SQLite:

```bash
# Navigate to your project directory
cd d:\code_projects

# Open SQLite database
sqlite3 data.db
```

Then run these SQL commands (replace with your actual email and future/past dates):

```sql
-- First, check if you have any slots (you need slot IDs)
SELECT id, start, end FROM slots LIMIT 5;

-- Get your user email (use the email you're logged in with)
SELECT email FROM users;

-- Insert a FREE session booking (0 pence) - FUTURE
-- Replace: <slot_id> with an actual slot ID, <your_email> with your email
INSERT INTO bookings (slot_id, user_email, amount_pence, created_at) 
VALUES (<slot_id>, '<your_email>', 0, datetime('now'));

-- Insert a 1-1 session booking (4000 pence) - FUTURE  
INSERT INTO bookings (slot_id, user_email, amount_pence, created_at) 
VALUES (<slot_id>, '<your_email>', 4000, datetime('now'));

-- Insert a GROUP session booking (2000 pence) - PAST (to test previous bookings)
-- Use a slot with a past date
INSERT INTO bookings (slot_id, user_email, amount_pence, created_at) 
VALUES (<slot_id>, '<your_email>', 2000, datetime('now', '-7 days'));

-- Exit SQLite
.quit
```

After inserting, refresh `my-bookings.html` to see the bookings appear.

#### Option B: Full Booking Flow (Recommended)

To test the complete booking flow:

1. **Generate Time Slots** (Admin required):
   - Visit: `http://localhost:3000/admin.html?adminKey=YOUR_ADMIN_KEY`
   - Use admin panel to generate slots for future dates

2. **Book a Free Session**:
   - Go to: `http://localhost:3000/tutoring.html`
   - Click: "Book Free Session" button
   - Select a time slot on `calendar.html`
   - Complete the booking flow
   - Expected Activity: **"Free Session"**

3. **Book a 1-to-1 Session**:
   - Go to: `http://localhost:3000/tutoring.html`
   - Click: "1-to-1" card → "Book Options" → "Single Session — £40"
   - Select a time slot
   - Complete payment/checkout
   - Expected Activity: **"1-1"**

4. **Book a Group Session**:
   - Go to: `http://localhost:3000/tutoring.html`
   - Click: "GROUP" card → "Book Now"
   - Select a time slot
   - Complete payment/checkout
   - Expected Activity: **"Group Session"**

5. **Verify in My Bookings**:
   - Navigate to: `http://localhost:3000/my-bookings.html`
   - Check that each booking shows the correct Activity label
   - Verify dates and times are displayed correctly

---

## ✅ Testing Checklist

### Basic Functionality
- [ ] Page loads without errors when logged in
- [ ] Logged-out users are redirected to `login.html`
- [ ] Tables display correctly with 3 columns (Activity, Date, Time)
- [ ] Empty state shows "No future bookings" / "No previous bookings"

### Activity Column
- [ ] Free Session (0 pence) shows **"Free Session"**
- [ ] 1-to-1 Session (4000 pence) shows **"1-1"**
- [ ] Group Session (2000 pence) shows **"Group Session"**
- [ ] Unknown amounts show **"Unknown"** (check server logs for warnings)

### Future/Previous Split
- [ ] Future bookings (start date >= now) appear in "Future bookings" table
- [ ] Past bookings (start date < now) appear in "Previous bookings" table
- [ ] Split is based on server time (not browser time)

### UI/UX
- [ ] Spacing matches contact.html style (generous margins)
- [ ] "Book a slot" button is below "Previous bookings" table
- [ ] Button links to `tutoring.html`
- [ ] Tables are readable with good padding

---

## 🔍 Debugging Tips

### Check Server Logs

Watch your server console for:
- Booking queries
- Unknown `amount_pence` warnings
- Authentication errors
- Database errors

### Check Browser Console

Open browser DevTools (F12) → Console tab:
- Check for JavaScript errors
- Verify API responses
- Check network requests to `/api/user-bookings`

### Verify Database

Check bookings in database:

```bash
sqlite3 data.db

-- See all bookings
SELECT b.id, b.user_email, b.amount_pence, s.start, s.end 
FROM bookings b 
JOIN slots s ON s.id = b.slot_id 
ORDER BY s.start;

-- Check specific user's bookings
SELECT b.id, b.user_email, b.amount_pence, s.start 
FROM bookings b 
JOIN slots s ON s.id = b.slot_id 
WHERE b.user_email = 'your@email.com' 
ORDER BY s.start;
```

---

## 📝 Notes

- **Free sessions** may not require payment (depending on implementation)
- **1-to-1 and Group sessions** require Stripe payment (unless testing in development mode)
- **Future/Previous split** uses server-side time comparison to avoid timezone issues
- **Activity mapping** happens server-side, so labels are consistent

---

## 🚨 Common Issues

1. **"Failed to load bookings" error**:
   - Check server is running
   - Check you're logged in (session exists)
   - Check server logs for errors

2. **All bookings show "Unknown"**:
   - Check `amount_pence` values in database
   - Verify they match: 0, 2000, or 4000
   - Check server logs for mapping warnings

3. **Bookings don't appear**:
   - Verify bookings exist in database with your email
   - Check bookings are linked to valid slots
   - Verify you're logged in with the correct email

4. **Wrong future/previous split**:
   - Check slot `start` dates in database
   - Verify server time is correct
   - Check timezone settings
