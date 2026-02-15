/**
 * Fetch with timeout utility
 * Wraps fetch() with AbortController to add timeout handling
 * 
 * @param {string|Request} url - The URL to fetch
 * @param {Object} options - Fetch options (will be extended with signal)
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10000)
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    // If aborted, it's a timeout
    if (error.name === 'AbortError') {
      const timeoutError = new Error('Request timed out. Please check your internet connection and try again.');
      timeoutError.name = 'TimeoutError';
      throw timeoutError;
    }
    throw error;
  }
}

// Make available globally
if (typeof window !== 'undefined') {
  window.fetchWithTimeout = fetchWithTimeout;
}
