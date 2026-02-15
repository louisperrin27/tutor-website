# Google Analytics 4 Setup Instructions

## Quick Start

1. **Get your GA4 Measurement ID:**
   - Go to [Google Analytics](https://analytics.google.com/)
   - Create a new GA4 property (or use an existing one)
   - Navigate to Admin → Data Streams → Web
   - Copy your Measurement ID (format: `G-XXXXXXXXXX`)

2. **Configure the Measurement ID:**
   - Open `analytics.js`
   - Replace `'G-XXXXXXXXXX'` on line 12 with your actual Measurement ID:
     ```javascript
     const GA_MEASUREMENT_ID = 'G-YOUR-ACTUAL-ID';
     ```

3. **Verify it's working:**
   - Deploy your site
   - Visit a few pages
   - Check Google Analytics Real-Time reports to see page views

## What's Being Tracked

### Automatic Tracking
- **Page Views**: Automatically tracked on every page load
  - Tracks: page path, page title, full URL

### Custom Events

#### Form Submissions
- **Contact Form** (`form_submit` event)
  - Parameters: `form_type: 'contact'`, `email`, `subject`
  - Triggered: When contact form is successfully submitted

- **Mailing List Signup** (`form_submit` event)
  - Parameters: `form_type: 'mailing_list'`, `email`, `source` (page where signup occurred)
  - Triggered: When user successfully joins mailing list

#### Bookings
- **Free Booking** (`booking_complete` event)
  - Parameters: `booking_type: 'free'`, `slot_id`, `value: 0`, `currency: 'GBP'`
  - Triggered: When a free session is successfully booked

- **Booking Confirmation** (`booking_confirmed` event)
  - Parameters: `email_provided: true`
  - Triggered: When user reaches confirmation page (indicates successful booking)

#### Payments
- **Payment Initiation** (`payment_initiated` event)
  - Parameters: `payment_method: 'stripe'`, `slot_id`, `plan`, `amount`, `currency: 'GBP'`
  - Triggered: When user is redirected to Stripe checkout

## Privacy Settings

The analytics implementation includes privacy-friendly settings:
- IP anonymization enabled
- Google signals disabled
- Ad personalization signals disabled

## Testing

To test analytics without affecting production data:
1. Use Google Analytics DebugView (in GA4 interface)
2. Enable debug mode by adding `?debug_mode=true` to your URL
3. Check browser console for analytics events

## Alternative: Plausible Analytics

If you prefer a privacy-friendly alternative to Google Analytics:

1. Sign up at [Plausible Analytics](https://plausible.io/)
2. Get your domain/script URL
3. Replace the GA4 script in `analytics.js` with Plausible's script
4. Update event tracking to use Plausible's API

Plausible is GDPR-compliant, doesn't use cookies, and is privacy-focused.
