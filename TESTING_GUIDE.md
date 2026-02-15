# Booking System Testing Guide

This guide will help you test your booking system end-to-end.

## Prerequisites

1. **Stripe Test Mode Setup**
   - Sign up at https://stripe.com (if you haven't already)
   - Go to Developers → API Keys
   - Copy your **Test** secret key (starts with `sk_test_`)
   - Copy your **Test** publishable key (starts with `pk_test_`)

2. **Environment Variables**
   Create a `.env` file in your project root:
   ```env
   STRIPE_SECRET_KEY=sk_test_your_test_secret_key_here
   EMAIL_USER=your_email@example.com
   EMAIL_PASS=your_email_password
   EMAIL_TO=your_email@example.com
   PORT=3000
   NODE_ENV=development
   ```

3. **Stripe Webhook Testing** (for local testing)
   - Install Stripe CLI: https://stripe.com/docs/stripe-cli
   - Run: `stripe listen --forward-to localhost:3000/stripe/webhook`
   - Copy the webhook signing secret (starts with `whsec_`)
   - Add to `.env`: `STRIPE_WEBHOOK_SECRET=whsec_your_secret_here`

## Testing Flow

### Step 1: Start Your Server

```bash
npm start
```

Server should start on `http://localhost:3000`

### Step 2: Test Calendar Selection

1. Navigate to: `http://localhost:3000/calendar.html?plan=free&price=0`
2. **Test navigation:**
   - Click "Today" button
   - Click previous/next week arrows
   - Verify week display updates
   - Verify today's date is highlighted (blue circle)

3. **Test slot selection:**
   - Click a Saturday or Sunday time slot
   - Verify slot highlights/selects
   - Verify "Go to Payment" button becomes enabled
   - Verify selected slot text updates

### Step 3: Test Payment Page

1. After selecting a slot, click "Go to Payment"
2. **Verify URL parameters:**
   - Check URL contains: `plan`, `price`, `date`, `time`, `displayDate`
   - Example: `payment.html?plan=free&price=0&date=2026-01-11&time=10:00&displayDate=Saturday, January 11, 2026`

3. **Test form validation:**
   - Try submitting with empty fields → should show errors
   - Enter invalid email → should show email error
   - Enter valid email → error should clear

4. **Test order summary:**
   - Verify plan name displays correctly
   - Verify date and time display correctly
   - Verify price displays correctly (£0 for free, £40 for 1-to-1, etc.)

### Step 4: Test Stripe Checkout (Test Mode)

1. Fill out the payment form with test data:
   - Name: Test User
   - Email: test@example.com (use your real email to receive confirmation)

2. Click "Continue to Payment"

3. **Stripe Test Card Numbers:**
   - **Success:** `4242 4242 4242 4242`
   - **Decline:** `4000 0000 0000 0002`
   - **3D Secure:** `4000 0025 0000 3155`
   - Use any future expiry date (e.g., 12/34)
   - Use any 3-digit CVC (e.g., 123)
   - Use any postal code (e.g., 12345)

4. Complete the Stripe checkout:
   - Enter test card details
   - Click "Pay"
   - Should redirect to success page

### Step 5: Verify Database

1. Check your `data.db` file:
   ```bash
   # Using SQLite command line (if installed)
   sqlite3 data.db
   
   # Then run:
   SELECT * FROM bookings;
   SELECT * FROM slots WHERE status = 'booked';
   ```

2. **What to verify:**
   - Booking record created with correct email
   - Slot status changed to 'booked'
   - Payment intent ID stored
   - Timestamp recorded

### Step 6: Test Email Notifications

1. Check your email inbox (EMAIL_TO address)
2. You should receive:
   - Booking confirmation email
   - Email with booking details

### Step 7: Test Admin Features

1. Navigate to: `http://localhost:3000/admin.html`
2. Enter your admin key (from `.env` or set `ADMIN_KEY`)
3. **Test features:**
   - View all bookings
   - Generate slots
   - View calendar

### Step 8: Test My Bookings Page

1. Navigate to: `http://localhost:3000/my-bookings.html`
2. Enter the email you used for booking
3. Verify your booking appears
4. Verify booking details are correct

## Testing Different Scenarios

### Free Session
- URL: `calendar.html?plan=free&price=0`
- Should show £0.00 on payment page
- Should complete without payment

### 1-to-1 Session
- URL: `calendar.html?plan=one_to_one&price=40`
- Should show £40.00 on payment page
- Should require Stripe payment

### Group Session
- URL: `calendar.html?plan=group&price=20`
- Should show £20.00 on payment page
- Should require Stripe payment

### Pack of 5 Sessions
- URL: `payment.html?plan=pack-1-1&price=200&qty=6`
- Should show £200.00 for 6 sessions

## Testing Edge Cases

### 1. Expired Checkout Session
- Start checkout but don't complete
- Wait for session to expire (default 24 hours)
- Verify slot becomes available again

### 2. Double Booking Prevention
- Try to book the same slot twice
- Second attempt should fail or show slot unavailable

### 3. Invalid URL Parameters
- Navigate to `calendar.html` without plan parameter
- Should redirect to `tutoring.html`

### 4. Past Dates
- Navigate to a past week
- Verify slots are still selectable (or disabled if you add date validation)

### 5. Network Errors
- Disconnect internet during checkout
- Verify error messages display properly

## Stripe Webhook Testing

### Using Stripe CLI (Recommended for Local Testing)

1. **Start webhook listener:**
   ```bash
   stripe listen --forward-to localhost:3000/stripe/webhook
   ```

2. **Trigger test events:**
   ```bash
   # Test successful payment
   stripe trigger checkout.session.completed
   
   # Test expired session
   stripe trigger checkout.session.expired
   ```

3. **Check server logs** for webhook processing

### Using Stripe Dashboard

1. Go to Developers → Webhooks
2. Add endpoint: `https://your-domain.com/stripe/webhook`
3. Select events: `checkout.session.completed`, `checkout.session.expired`
4. Copy webhook signing secret to `.env`

## Common Issues & Solutions

### Issue: "Stripe not configured"
- **Solution:** Check `.env` file has `STRIPE_SECRET_KEY` set
- Verify key starts with `sk_test_` for test mode

### Issue: Webhook not working
- **Solution:** 
  - Check `STRIPE_WEBHOOK_SECRET` in `.env`
  - Verify webhook URL is accessible
  - Check server logs for webhook errors

### Issue: Email not sending
- **Solution:**
  - Check `EMAIL_USER` and `EMAIL_PASS` in `.env`
  - Verify SMTP settings (using iCloud: `smtp.mail.me.com:587`)
  - Check server logs for email errors

### Issue: Slot not booking
- **Solution:**
  - Check database: `SELECT * FROM slots WHERE id = ?`
  - Verify webhook received: Check server logs
  - Check slot status: Should be 'reserved' then 'booked'

## Test Checklist

- [ ] Calendar navigation works (Today, prev/next)
- [ ] Slot selection works
- [ ] Payment page loads with correct data
- [ ] Form validation works
- [ ] Stripe checkout opens
- [ ] Test payment succeeds
- [ ] Booking saved to database
- [ ] Email confirmation sent
- [ ] Admin can view bookings
- [ ] My Bookings page shows booking
- [ ] Webhook processes payment
- [ ] Expired sessions free up slots

## Production Testing

Before going live:

1. **Switch to Live Mode:**
   - Replace test keys with live keys in `.env`
   - Use live Stripe publishable key in payment page
   - Update webhook endpoint in Stripe dashboard

2. **Test with real payment:**
   - Use your own card (you can refund yourself)
   - Verify real email received
   - Check database with real booking

3. **Monitor:**
   - Check Stripe dashboard for payments
   - Monitor server logs
   - Check email delivery

## Need Help?

- Check server logs: Look for error messages
- Check browser console: F12 → Console tab
- Check network tab: F12 → Network tab (look for failed requests)
- Check database: Use SQLite browser or command line
