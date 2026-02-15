/**
 * Google Analytics 4 (GA4) Integration
 * Provides analytics tracking for page views and custom events
 * 
 * Usage:
 * - Page views are tracked automatically when analytics.js loads
 * - Use trackEvent() to track custom events
 */

// Google Analytics Measurement ID (replace with your actual GA4 ID)
// Format: G-XXXXXXXXXX
const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // TODO: Replace with your actual GA4 Measurement ID

/**
 * Initialize Google Analytics 4
 */
function initAnalytics() {
  // Only initialize if Measurement ID is configured
  if (!GA_MEASUREMENT_ID || GA_MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    console.warn('Google Analytics: Measurement ID not configured. Analytics disabled.');
    return;
  }

  // Load Google Analytics script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`;
  document.head.appendChild(script1);

  // Initialize gtag
  window.dataLayer = window.dataLayer || [];
  function gtag() {
    window.dataLayer.push(arguments);
  }
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', GA_MEASUREMENT_ID, {
    // Privacy-friendly settings
    anonymize_ip: true,
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
  });

  // Track page view
  trackPageView();
}

/**
 * Track a page view
 */
function trackPageView() {
  if (typeof window.gtag === 'undefined') {
    return;
  }
  
  const pagePath = window.location.pathname + window.location.search;
  const pageTitle = document.title;
  
  window.gtag('event', 'page_view', {
    page_path: pagePath,
    page_title: pageTitle,
    page_location: window.location.href,
  });
}

/**
 * Track a custom event
 * @param {string} eventName - Name of the event (e.g., 'form_submit', 'booking_complete')
 * @param {Object} eventParams - Additional parameters for the event
 */
function trackEvent(eventName, eventParams = {}) {
  if (typeof window.gtag === 'undefined') {
    console.debug('Analytics: Event not tracked (GA not initialized)', eventName, eventParams);
    return;
  }
  
  window.gtag('event', eventName, eventParams);
}

/**
 * Track form submission
 * @param {string} formType - Type of form (e.g., 'contact', 'mailing_list', 'booking')
 * @param {Object} additionalData - Additional data to track
 */
function trackFormSubmit(formType, additionalData = {}) {
  trackEvent('form_submit', {
    form_type: formType,
    ...additionalData,
  });
}

/**
 * Track booking completion
 * @param {string} bookingType - Type of booking (e.g., 'free', 'paid', 'group')
 * @param {Object} bookingData - Booking details (price, plan, etc.)
 */
function trackBooking(bookingType, bookingData = {}) {
  trackEvent('booking_complete', {
    booking_type: bookingType,
    ...bookingData,
  });
}

/**
 * Track payment initiation
 * @param {string} paymentMethod - Payment method (e.g., 'stripe', 'free')
 * @param {Object} paymentData - Payment details (amount, plan, etc.)
 */
function trackPayment(paymentMethod, paymentData = {}) {
  trackEvent('payment_initiated', {
    payment_method: paymentMethod,
    ...paymentData,
  });
}

// Make functions available globally
if (typeof window !== 'undefined') {
  window.trackEvent = trackEvent;
  window.trackFormSubmit = trackFormSubmit;
  window.trackBooking = trackBooking;
  window.trackPayment = trackPayment;
}

// Initialize analytics when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
  // DOM already loaded
  initAnalytics();
}
