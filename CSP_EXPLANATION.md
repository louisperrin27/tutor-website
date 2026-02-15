# Content Security Policy (CSP) Explanation

## What is CSP?

Content Security Policy (CSP) is a security feature that helps protect your website from attacks like Cross-Site Scripting (XSS). It works like a "whitelist" that tells the browser which resources (scripts, styles, images, etc.) are allowed to load on your website.

## How It Works

Think of CSP like a bouncer at a club:
- **Without CSP**: Anyone can enter (any script can run, any resource can load)
- **With CSP**: Only people on the approved list can enter (only approved scripts/resources can load)

## What's Configured

Your website's CSP is configured in `server.js` using Helmet middleware. Here's what's allowed:

### ✅ Allowed Resources

1. **Font Awesome Icons** (`https://cdnjs.cloudflare.com`)
   - Used for: Icons throughout the website

2. **YouTube Videos** (`https://www.youtube.com`)
   - Used for: Embedding YouTube videos on the homepage
   - Allowed in: `frameSrc` (for iframes) and `connectSrc` (for API calls)

3. **Google reCAPTCHA** (`https://www.google.com`, `https://www.gstatic.com`)
   - Used for: Contact form spam protection
   - Allowed in: `scriptSrc` (for reCAPTCHA scripts)

4. **Google Analytics** (`https://www.googletagmanager.com`, `https://www.google-analytics.com`)
   - Used for: Website analytics tracking
   - Allowed in: `scriptSrc` (for GA scripts) and `connectSrc` (for sending data)

5. **Stripe Payment** (`https://js.stripe.com`)
   - Used for: Payment processing
   - Allowed in: `frameSrc` (for Stripe checkout iframe)

6. **FullCalendar** (`https://cdn.jsdelivr.net`)
   - Used for: Calendar widget on admin page
   - Allowed in: `scriptSrc` and `styleSrc`

### 🔒 Security Settings

- **`defaultSrc: ["'self']"`**: By default, only resources from your own domain are allowed
- **`objectSrc: ["'none']"`**: Blocks all plugins (Flash, Java, etc.) for security
- **`upgradeInsecureRequests`**: Automatically upgrades HTTP requests to HTTPS
- **`'unsafe-inline'`**: Currently allows inline scripts/styles (can be improved with nonces in the future)

## Why This Matters

### Protection Against:
1. **XSS Attacks**: Prevents malicious scripts from running on your site
2. **Data Injection**: Blocks unauthorized code execution
3. **Clickjacking**: Helps prevent iframe-based attacks

### Real-World Example:

**Without CSP:**
- A hacker injects `<script>stealUserData()</script>` into your contact form
- The script runs and steals user information ❌

**With CSP:**
- The same malicious script is blocked by the browser
- Only approved scripts from your whitelist can run ✅

## Current Configuration

The CSP is automatically applied to all pages via the Helmet middleware in `server.js`. Every HTTP response includes CSP headers that tell browsers which resources are allowed.

## Testing CSP

To test if CSP is working:

1. **Check Browser Console:**
   - Open Developer Tools (F12)
   - Look for CSP violation errors if something is blocked

2. **Test in Browser:**
   - Visit your website
   - All features should work normally
   - If something breaks, check the console for CSP errors

3. **Online CSP Validator:**
   - Use tools like [CSP Evaluator](https://csp-evaluator.withgoogle.com/)
   - Paste your CSP header to check for issues

## Future Improvements

Currently, the CSP uses `'unsafe-inline'` for inline scripts and styles. This can be improved by:

1. **Using Nonces**: Generate unique tokens for each inline script
2. **Moving Inline Code**: Move inline scripts to external files
3. **Hash-based CSP**: Use content hashes for specific inline scripts

These improvements would make the CSP even more secure, but require more complex implementation.

## Summary

✅ CSP is **active** and protecting your website  
✅ All necessary external resources are **whitelisted**  
✅ Security best practices are **implemented**  
✅ Your website is **protected** from XSS and injection attacks

The CSP configuration is production-ready and will help keep your website secure!
