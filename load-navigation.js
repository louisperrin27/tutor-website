/**
 * Load Navigation Include
 * Loads the shared navigation HTML into elements with data-include="navigation"
 * Supports custom navigation types via data-nav-type attribute
 */

(function() {
  'use strict';

  // Navigation templates
  const navTemplates = {
    // Standard full navigation (default) - filename for fetch
    standard: 'navigation.html',
    // CHANGED: Inline fallback HTML when fetch fails (e.g. Safari iOS) so header still appears
    standardFallbackHtml: `<header role="banner">
    <nav role="navigation" aria-label="Main navigation">
        <ul class="nav-links" role="menubar">
            <li role="none"><a href="/index.html" aria-label="Home" class="home-icon" role="menuitem"><i class="fa fa-home" aria-hidden="true"></i></a></li>
            <li role="none"><a href="/maths.html" role="menuitem">Maths</a></li>
            <li role="none"><a href="/physics.html" role="menuitem">Physics</a></li>
            <li role="none"><a href="/further_maths.html" role="menuitem">Further Maths</a></li>
            <li role="none"><a href="/tutoring.html" role="menuitem">Tutoring</a></li>
            <li role="none"><a href="/contact.html" role="menuitem">Contact</a></li>
        </ul>
        <div style="display: flex; align-items: center; gap: 1rem;">
          <a href="/free-content.html" class="btn btn-primary join-btn" aria-label="Get free content">Get free content</a>
          <a href="/account-entry" class="account-icon" aria-label="Sign in or access account" role="menuitem">
            <i class="fas fa-user-circle" aria-hidden="true"></i>
          </a>
        </div>
    </nav>
</header>`,
    
    // Minimal navigation (admin pages)
    minimal: `
      <header role="banner">
        <nav role="navigation" aria-label="Admin navigation">
          <ul class="nav-links" role="menubar">
            <li role="none"><a href="index.html" aria-label="Home" class="home-icon" role="menuitem"><i class="fa fa-home" aria-hidden="true"></i></a></li>
          </ul>
        </nav>
      </header>
    `,
    
    // Bookings navigation
    bookings: `
      <header role="banner">
        <nav role="navigation" aria-label="Booking navigation">
          <ul class="nav-links" role="menubar">
            <li role="none"><a href="index.html" aria-label="Home" class="home-icon" role="menuitem"><i class="fa fa-home" aria-hidden="true"></i></a></li>
            <li role="none"><a href="tutoring.html" role="menuitem">Book a Slot</a></li>
          </ul>
        </nav>
      </header>
    `,
    
    // Confirmation page navigation (can use bookings type or create separate)
    confirmation: `
      <header role="banner">
        <nav role="navigation" aria-label="Confirmation navigation">
          <ul class="nav-links" role="menubar">
            <li role="none"><a href="index.html" aria-label="Home" class="home-icon" role="menuitem"><i class="fa fa-home" aria-hidden="true"></i></a></li>
            <li role="none"><a href="tutoring.html" role="menuitem">Book Another Slot</a></li>
          </ul>
        </nav>
      </header>
    `
  };

  /**
   * Load navigation from file or template
   */
  function loadNavigation(element) {
    const navType = element.getAttribute('data-nav-type') || 'standard';
    
    if (navType === 'standard') {
      // Load from external file
      // CHANGED: Root-relative URL so Safari iOS resolves correctly from any page path
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      fetch('/navigation.html', { signal: controller.signal })
        .then(response => {
          clearTimeout(timeoutId);
          if (!response.ok) {
            throw new Error('Failed to load navigation');
          }
          return response.text();
        })
        .then(html => {
          element.innerHTML = html;
          // Mark as loaded
          element.setAttribute('data-nav-loaded', 'true');
        })
        .catch(error => {
          clearTimeout(timeoutId);
          if (window.clientLogger) {
            window.clientLogger.error('Navigation load failed', {
              error: error,
              navType: navType,
              path: 'navigation.html',
            });
          } else {
            console.error('Error loading navigation:', error);
          }
          // CHANGED: Use inline HTML fallback so header/nav still appears (e.g. when fetch fails on Safari iOS)
          element.innerHTML = navTemplates.standardFallbackHtml || '';
          element.setAttribute('data-nav-loaded', 'true');
        });
    } else {
      // Use inline template
      element.innerHTML = navTemplates[navType] || navTemplates.standard;
      element.setAttribute('data-nav-loaded', 'true');
    }
  }

  /**
   * Initialize navigation loading
   */
  function initNavigation() {
    // Find all elements that should include navigation
    const navContainers = document.querySelectorAll('[data-include="navigation"]');
    
    navContainers.forEach(container => {
      loadNavigation(container);
    });
  }

  // Load navigation when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation);
  } else {
    // DOM already loaded
    initNavigation();
  }
})();
