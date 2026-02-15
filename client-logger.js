/**
 * Client-Side Structured Logging Utility
 * Provides consistent, structured logging for browser-side code
 */

const CLIENT_LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Get log level from localStorage or default to WARN (only show warnings and errors in production)
const getMinLogLevel = () => {
  const stored = localStorage.getItem('LOG_LEVEL');
  if (stored) {
    return CLIENT_LOG_LEVELS[stored.toUpperCase()] ?? CLIENT_LOG_LEVELS.WARN;
  }
  // In production, only show warnings and errors
  return window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? CLIENT_LOG_LEVELS.DEBUG
    : CLIENT_LOG_LEVELS.WARN;
};

/**
 * Format log entry as structured JSON
 */
function formatClientLogEntry(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    url: window.location.href,
    userAgent: navigator.userAgent,
    ...context,
  };

  // Add error details if error object is provided
  if (context.error && context.error instanceof Error) {
    entry.error = {
      name: context.error.name,
      message: context.error.message,
      stack: context.error.stack,
    };
    // Remove raw error from context to avoid duplication
    const { error: _error, ...restContext } = context;
    Object.assign(entry, restContext);
  }

  return JSON.stringify(entry);
}

/**
 * Log to console with structured format
 */
function clientLog(level, message, context = {}) {
  const levelNum = CLIENT_LOG_LEVELS[level.toUpperCase()];
  const minLevel = getMinLogLevel();
  
  if (levelNum === undefined || levelNum < minLevel) {
    return;
  }

  const formatted = formatClientLogEntry(level, message, context);
  
  // Use appropriate console method based on level
  switch (level.toUpperCase()) {
    case 'ERROR':
      console.error(formatted);
      break;
    case 'WARN':
      console.warn(formatted);
      break;
    case 'DEBUG':
      console.debug(formatted);
      break;
    default:
      console.log(formatted);
  }
}

/**
 * Client logger object with convenience methods
 */
const clientLogger = {
  debug: (message, context) => clientLog('DEBUG', message, context),
  info: (message, context) => clientLog('INFO', message, context),
  warn: (message, context) => clientLog('WARN', message, context),
  error: (message, context) => clientLog('ERROR', message, context),

  /**
   * Log API request
   */
  apiRequest: (method, url, context = {}) => {
    clientLog('DEBUG', `API Request: ${method} ${url}`, {
      method,
      url,
      ...context,
    });
  },

  /**
   * Log API response
   */
  apiResponse: (method, url, status, duration, context = {}) => {
    const level = status >= 400 ? 'ERROR' : 'DEBUG';
    clientLog(level, `API Response: ${method} ${url}`, {
      method,
      url,
      statusCode: status,
      duration: `${duration}ms`,
      ...context,
    });
  },

  /**
   * Log API error
   */
  apiError: (method, url, error, context = {}) => {
    clientLog('ERROR', `API Error: ${method} ${url}`, {
      method,
      url,
      error,
      ...context,
    });
  },

  /**
   * Log form submission
   */
  formSubmit: (formId, context = {}) => {
    clientLog('INFO', `Form submitted: ${formId}`, {
      formId,
      ...context,
    });
  },

  /**
   * Log form validation error
   */
  formValidation: (formId, field, error, context = {}) => {
    clientLog('WARN', `Form validation error: ${formId}`, {
      formId,
      field,
      error,
      ...context,
    });
  },
};

// Make logger available globally
if (typeof window !== 'undefined') {
  window.clientLogger = clientLogger;
}
