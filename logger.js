/**
 * Structured Logging Utility
 * Provides consistent, structured logging with timestamps, log levels, and context
 */

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
};

// Get log level from environment or default to INFO
const MIN_LOG_LEVEL = LOG_LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LOG_LEVELS.INFO;

/**
 * Format log entry as structured JSON
 */
function formatLogEntry(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
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
function log(level, message, context = {}) {
  const levelNum = LOG_LEVELS[level.toUpperCase()];
  if (levelNum === undefined || levelNum < MIN_LOG_LEVEL) {
    return;
  }

  const formatted = formatLogEntry(level, message, context);
  
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
 * Logger object with convenience methods
 */
const logger = {
  debug: (message, context) => log('DEBUG', message, context),
  info: (message, context) => log('INFO', message, context),
  warn: (message, context) => log('WARN', message, context),
  error: (message, context) => log('ERROR', message, context),

  /**
   * Log HTTP request
   */
  request: (req, res, duration) => {
    const context = {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('user-agent'),
    };
    log('INFO', 'HTTP Request', context);
  },

  /**
   * Log HTTP error
   */
  httpError: (req, err, statusCode = 500) => {
    const context = {
      method: req.method,
      path: req.path,
      statusCode,
      ip: req.ip || req.connection?.remoteAddress,
      error: err,
    };
    log('ERROR', 'HTTP Error', context);
  },

  /**
   * Log database operation
   */
  db: (operation, context = {}) => {
    log('DEBUG', `DB ${operation}`, context);
  },

  /**
   * Log email operation
   */
  email: (operation, context = {}) => {
    log('INFO', `Email ${operation}`, context);
  },

  /**
   * Log payment/Stripe operation
   */
  payment: (operation, context = {}) => {
    log('INFO', `Payment ${operation}`, context);
  },
};

export default logger;
