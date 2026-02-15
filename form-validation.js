/**
 * Form Validation Utility
 * Provides visual and accessible validation feedback for form fields
 */

(function() {
  'use strict';

  /**
   * Initialize form validation for a form element
   * @param {HTMLFormElement} form - The form element to validate
   */
  function initFormValidation(form) {
    if (!form) {return;}

    const fields = form.querySelectorAll('input[required], textarea[required], select[required]');
    
    fields.forEach(field => {
      // Find or create error message container
      let errorContainer = null;
      if (field.id) {
        // Check for existing error container (could be .field-error or .email-error)
        errorContainer = field.parentElement.querySelector(`.field-error[data-field="${field.id}"], .email-error[data-field="${field.id}"], #${field.id}Error`);
        
        if (!errorContainer) {
          // Create new error container
          errorContainer = document.createElement('span');
          errorContainer.className = 'field-error';
          errorContainer.id = `${field.id}Error`;
          errorContainer.setAttribute('data-field', field.id);
          errorContainer.setAttribute('role', 'alert');
          errorContainer.setAttribute('aria-live', 'polite');
          field.parentElement.appendChild(errorContainer);
        } else {
          // Ensure existing container has proper attributes
          if (!errorContainer.classList.contains('field-error')) {
            errorContainer.classList.add('field-error');
          }
          if (!errorContainer.hasAttribute('data-field')) {
            errorContainer.setAttribute('data-field', field.id);
          }
          if (!errorContainer.hasAttribute('role')) {
            errorContainer.setAttribute('role', 'alert');
          }
          if (!errorContainer.hasAttribute('aria-live')) {
            errorContainer.setAttribute('aria-live', 'polite');
          }
        }

        // Link field to error message for accessibility
        const describedBy = field.getAttribute('aria-describedby') || '';
        const errorId = errorContainer.id;
        if (errorId && !describedBy.includes(errorId)) {
          field.setAttribute('aria-describedby', (describedBy + ' ' + errorId).trim());
        }
      }

      // Real-time validation on blur
      field.addEventListener('blur', function() {
        validateField(field);
      });

      // Clear validation on input (for better UX)
      field.addEventListener('input', function() {
        if (this.classList.contains('invalid')) {
          clearFieldError(field);
        }
      });

      // Validate on form submit
      form.addEventListener('submit', function(e) {
        let isValid = true;
        fields.forEach(f => {
          if (!validateField(f)) {
            isValid = false;
          }
        });

        if (!isValid) {
          e.preventDefault();
          // Focus first invalid field
          const firstInvalid = form.querySelector('.invalid');
          if (firstInvalid) {
            firstInvalid.focus();
            firstInvalid.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      });
    });
  }

  /**
   * Validate a single field
   * @param {HTMLElement} field - The field to validate
   * @returns {boolean} - True if valid
   */
  function validateField(field) {
    const isRequired = field.hasAttribute('required');
    const value = field.value.trim();
    let isValid = true;
    let errorMessage = '';

    // Check required fields
    if (isRequired && !value) {
      isValid = false;
      errorMessage = getRequiredErrorMessage(field);
    }
    // Check email format
    else if (field.type === 'email' && value) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(value)) {
        isValid = false;
        errorMessage = 'Please enter a valid email address (e.g., name@example.com)';
      }
    }
    // Check pattern
    else if (field.hasAttribute('pattern') && value) {
      const pattern = new RegExp(field.getAttribute('pattern'));
      if (!pattern.test(value)) {
        isValid = false;
        errorMessage = field.getAttribute('title') || 'Please match the required format';
      }
    }
    // Check minlength
    else if (field.hasAttribute('minlength') && value) {
      const minLength = parseInt(field.getAttribute('minlength'));
      if (value.length < minLength) {
        isValid = false;
        errorMessage = `Please enter at least ${minLength} characters`;
      }
    }
    // Check maxlength
    else if (field.hasAttribute('maxlength') && value) {
      const maxLength = parseInt(field.getAttribute('maxlength'));
      if (value.length > maxLength) {
        isValid = false;
        errorMessage = `Please enter no more than ${maxLength} characters`;
      }
    }

    // Update field state
    if (isValid) {
      clearFieldError(field);
    } else {
      showFieldError(field, errorMessage);
    }

    return isValid;
  }

  /**
   * Get error message for required field
   * @param {HTMLElement} field - The field element
   * @returns {string} - Error message
   */
  function getRequiredErrorMessage(field) {
    const label = field.parentElement.querySelector('label');
    const fieldName = label ? label.textContent.replace('*', '').trim() : 'This field';
    return `${fieldName} is required`;
  }

  /**
   * Show error for a field
   * @param {HTMLElement} field - The field element
   * @param {string} message - Error message
   */
  function showFieldError(field, message) {
    field.classList.remove('valid');
    field.classList.add('invalid');
    field.setAttribute('aria-invalid', 'true');

    // Find error container (could be .field-error or .email-error)
    let errorContainer = null;
    if (field.id) {
      errorContainer = field.parentElement.querySelector(`.field-error[data-field="${field.id}"], .email-error[data-field="${field.id}"], #${field.id}Error`);
    }
    if (errorContainer) {
      errorContainer.textContent = message;
      errorContainer.style.display = 'block';
      // Ensure it has proper attributes
      if (!errorContainer.hasAttribute('role')) {
        errorContainer.setAttribute('role', 'alert');
      }
      if (!errorContainer.hasAttribute('aria-live')) {
        errorContainer.setAttribute('aria-live', 'polite');
      }
    }
  }

  /**
   * Clear error for a field
   * @param {HTMLElement} field - The field element
   */
  function clearFieldError(field) {
    field.classList.remove('invalid');
    field.setAttribute('aria-invalid', 'false');

    // Only add valid class if field has value
    if (field.value.trim().length > 0) {
      field.classList.add('valid');
    } else {
      field.classList.remove('valid');
    }

    // Find error container (could be .field-error or .email-error)
    let errorContainer = null;
    if (field.id) {
      errorContainer = field.parentElement.querySelector(`.field-error[data-field="${field.id}"], .email-error[data-field="${field.id}"], #${field.id}Error`);
    }
    if (errorContainer) {
      errorContainer.textContent = '';
      errorContainer.style.display = 'none';
    }
  }

  /**
   * Initialize all forms on page load
   */
  function initAllForms() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
      initFormValidation(form);
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllForms);
  } else {
    initAllForms();
  }

  // Export for manual use if needed
  window.FormValidation = {
    init: initFormValidation,
    validateField: validateField,
    clearFieldError: clearFieldError
  };
})();
