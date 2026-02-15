// Shared email validation utility
// Matches backend validation in server.js

/**
 * Validates email format (RFC 5322 compliant, simplified)
 * @param {string} email - Email address to validate
 * @returns {boolean} - True if email is valid
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {return false;}
  const trimmed = email.trim();
  if (trimmed.length === 0 || trimmed.length > 254) {return false;} // RFC 5321 max length
  // Simplified regex matching backend: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validates and sanitizes email (trims and lowercases)
 * @param {string} email - Email address to validate and sanitize
 * @returns {string|null} - Sanitized email or null if invalid
 * @exports - Used by other scripts that load this file
 */
// eslint-disable-next-line no-unused-vars
function validateAndSanitizeEmail(email) {
  if (!email || typeof email !== 'string') {return null;}
  const trimmed = email.trim().toLowerCase();
  if (!isValidEmail(trimmed)) {return null;}
  return trimmed;
}

/**
 * Shows email validation error message
 * @param {HTMLElement} input - Email input element
 * @param {HTMLElement} errorEl - Error message element (optional)
 * @param {string} message - Custom error message (optional)
 * @returns {boolean} - True if email is valid
 * @exports - Used by other scripts that load this file
 */
// eslint-disable-next-line no-unused-vars
function validateEmailInput(input, errorEl, message) {
  const email = input.value.trim();
  const isValid = isValidEmail(email);
  
  if (errorEl) {
    if (!isValid && email.length > 0) {
      errorEl.textContent = message || 'Please enter a valid email address (e.g., name@example.com)';
      errorEl.style.display = 'block';
      errorEl.style.color = '#c33';
      input.setAttribute('aria-invalid', 'true');
    } else {
      errorEl.style.display = 'none';
      input.setAttribute('aria-invalid', 'false');
    }
  }
  
  // Add/remove visual feedback classes
  if (email.length > 0) {
    if (isValid) {
      input.classList.remove('invalid');
      input.classList.add('valid');
    } else {
      input.classList.remove('valid');
      input.classList.add('invalid');
    }
  } else {
    input.classList.remove('valid', 'invalid');
  }
  
  return isValid;
}
