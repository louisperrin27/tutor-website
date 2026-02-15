# Booking System - Simple Explanation

## 🔄 How It Works (Simple Overview)

**Yes, the admin needs to generate slots first!** Here's the flow:

```
1. Admin generates time slots (dates/times)
   ↓
2. User selects a plan (Free, 1-1, or Group)
   ↓
3. User picks an available slot from calendar
   ↓
4. User pays (if required) or completes booking
   ↓
5. Booking is created and stored in database
   ↓
6. User views their bookings in "My Bookings"
```

---

## 📋 Step-by-Step Flow

### Step 1: Admin Generates Slots

**Who:** Admin (you)
**Where:** `http://localhost:3000/admin.html?adminKey=YOUR_ADMIN_KEY`

**What happens:**
- Admin enters:
  - **Admin Key** (from `.env` file: `ADMIN_KEY=...`)
  - **Start Date** (e.g., 2025-01-15)
  - **End Date** (e.g., 2025-01-31)
  - **Times** (e.g., `17:00,19:00` - comma separated)
- Clicks "Generate Slots"
- System creates time slots in the database (only weekends are bookable)

**Result:** Available time slots are created for users to book

---

### Step 2: User Selects a Plan

**Who:** Customer
**Where:** `http://localhost:3000/tutoring.html`

**What happens:**
- User sees 3 options:
  - **FREE** - £0 (Free Session)
  - **1-to-1** - £40 per session (1-1)
  - **GROUP** - £20 per session (Group Session)
- User clicks "Book Now" or "Book Options"
- Redirected to calendar page

---

### Step 3: User Picks a Slot

**Who:** Customer
**Where:** `calendar.html?plan=free&price=0` (or similar)

**What happens:**
- Calendar shows available time slots (weekend times only)
- User clicks on a time slot (e.g., "Saturday 10:00")
- Slot is selected
- User clicks "Continue" button
- Redirected to payment/checkout page

---

### Step 4: Payment/Checkout

**Who:** Customer
**Where:** Payment page (Stripe Checkout)

**What happens:**
- **For Free sessions:** May skip payment or go straight to confirmation
- **For Paid sessions (1-1, Group):**
  - User enters payment details
  - Stripe processes payment
  - Payment webhook confirms the booking
  - Booking is saved to database

---

### Step 5: Booking Saved

**What happens in database:**
- Slot status changes: `available` → `reserved` → `booked`
- Booking record created with:
  - User email
  - Slot ID (which time slot)
  - Amount paid (0, 2000, or 4000 pence)
  - Date/time of booking

---

### Step 6: User Views Bookings

**Who:** Customer
**Where:** `http://localhost:3000/my-bookings.html`

**What happens:**
- User must be logged in
- System fetches bookings for logged-in user's email
- Bookings are split into:
  - **Future bookings** (start date >= now)
  - **Previous bookings** (start date < now)
- Each booking shows:
  - **Activity** (Free Session, 1-1, or Group Session)
  - **Date** (formatted)
  - **Time** (formatted)

---

## 🧪 How to Test (Quick Guide)

### Prerequisites
1. **Server running:** `npm start`
2. **Admin key configured:** Check `.env` file has `ADMIN_KEY=...`
3. **User account created:** Sign up at `/singup.html`

---

### Test Scenario: Complete Booking Flow

#### 1. Generate Slots (Admin)

```
1. Go to: http://localhost:3000/admin.html?adminKey=YOUR_ADMIN_KEY
2. Fill in:
   - Admin Key: (from .env file)
   - Start Date: (pick a future date, e.g., tomorrow)
   - End Date: (pick a date 2 weeks later)
   - Times: 17:00,19:00
3. Click "Generate Slots"
4. Should see success message
```

#### 2. Login as User

```
1. Go to: http://localhost:3000/login.html
2. Login with your test account
3. Should redirect to account.html
```

#### 3. Book a Free Session

```
1. Go to: http://localhost:3000/tutoring.html
2. Click "Book Free Session" (big button at top)
3. Calendar page loads
4. Click on a weekend time slot (e.g., Saturday 17:00)
5. Click "Continue"
6. Complete the booking flow
```

#### 4. View Your Booking

```
1. Go to: http://localhost:3000/account.html
2. Click "My Bookings"
3. Should see your booking in "Future bookings" table
4. Activity column should show "Free Session"
5. Date and Time should be correct
```

---

### Test Scenario: Quick Database Test (Skip Payment)

If you want to test the Activity column mapping without going through the full payment flow:

```bash
# Open SQLite database
sqlite3 data.db

# Check what slots exist
SELECT id, start, end, status FROM slots WHERE status='available' LIMIT 5;

# Get your email (the one you're logged in with)
SELECT email FROM users;

# Insert a test booking (replace values)
INSERT INTO bookings (slot_id, user_email, amount_pence, created_at) 
VALUES (1, 'your@email.com', 0, datetime('now'));

# Test different amounts:
# 0 = Free Session
# 4000 = 1-1
# 2000 = Group Session

# Exit
.quit
```

Then refresh `my-bookings.html` to see the booking appear.

---

## 🗄️ Database Structure (Simplified)

### Tables

1. **`slots`** - Available time slots
   - `id` - Slot ID
   - `start` - Start date/time (ISO format)
   - `end` - End date/time
   - `status` - `available`, `reserved`, or `booked`

2. **`bookings`** - User bookings
   - `id` - Booking ID
   - `slot_id` - Which slot was booked
   - `user_email` - Who booked it
   - `amount_pence` - How much paid (0, 2000, or 4000)
   - `created_at` - When booking was created

3. **`users`** - User accounts
   - `email` - User email (used to match bookings)
   - `name` - User name

---

## 🔍 Key Concepts

### Slots vs Bookings

- **Slots** = Available time slots (created by admin)
- **Bookings** = Reserved/booked slots (created when user books)

### Activity Mapping

The Activity column in "My Bookings" is determined by `amount_pence`:
- `0` pence → "Free Session"
- `4000` pence (£40) → "1-1"
- `2000` pence (£20) → "Group Session"

### Weekend-Only Booking

The calendar only shows weekend slots as bookable (Saturday/Sunday). Weekday slots exist but aren't selectable.

### Future vs Previous

- **Future bookings:** Slot start date/time >= current server time
- **Previous bookings:** Slot start date/time < current server time

---

## ❓ Common Questions

**Q: Do I need to generate slots for every date?**
A: Yes, slots must be generated before users can book them. Generate slots for date ranges you want to offer.

**Q: Can users book any time?**
A: No, only weekend slots (Saturday/Sunday) at the times you specified when generating slots.

**Q: What if I don't have Stripe set up?**
A: Free sessions may work, but paid sessions (1-1, Group) require Stripe payment processing.

**Q: Can I test without payment?**
A: Yes, use the database insert method shown above, or book a Free session.

**Q: Why don't my bookings show up?**
A: Check:
- You're logged in with the same email used for booking
- Bookings exist in database with your email
- Server is running
- Check browser console for errors

---

## 🎯 Quick Test Checklist

- [ ] Admin can generate slots
- [ ] User can see available slots on calendar
- [ ] User can select a slot
- [ ] Booking is created (check database or "My Bookings" page)
- [ ] Activity column shows correct label (Free Session, 1-1, or Group Session)
- [ ] Future/Previous split works correctly
- [ ] Logged-out users are redirected to login
