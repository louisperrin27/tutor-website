// Admin mailing list subscriber viewer

// Load fetch timeout utility
const fetchTimeoutScript = document.createElement('script');
fetchTimeoutScript.src = 'fetch-with-timeout.js';
document.head.appendChild(fetchTimeoutScript);

let debounceTimer = null;

// Format datetime for display
function formatDateTime(isoString) {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-GB', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  } catch (e) {
    return isoString;
  }
}

async function refreshSubscribers() {
  const emailSearch = document.getElementById('emailSearch')?.value.trim() || '';
  const sourceFilter = document.getElementById('sourceFilter')?.value || '';
  const body = document.getElementById('subscribersBody');
  const statusEl = document.getElementById('status');
  const refreshBtn = document.getElementById('refreshBtn');
  
  // Clear and show loading state safely
  body.textContent = '';
  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 6;
  loadingCell.style.textAlign = 'center';
  loadingCell.style.padding = '20px';
  loadingCell.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading subscribers...';
  loadingRow.appendChild(loadingCell);
  body.appendChild(loadingRow);
  
  // Disable button during load
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Loading...';
  }
  
  // Hide status
  if (statusEl) {
    statusEl.style.display = 'none';
  }
  
  try {
    // Build query params
    const params = new URLSearchParams();
    if (emailSearch) params.set('search', emailSearch);
    if (sourceFilter) params.set('source', sourceFilter);
    
    const url = `/admin/mailing-list${params.toString() ? '?' + params.toString() : ''}`;
    const res = await fetchWithTimeout(url, {}, 10000);
    
    if (res.status === 401 || res.status === 403) {
      // Not authenticated - redirect to login
      window.location.href = '/admin-login.html';
      return;
    }
    
    if (!res.ok) {
      let errorMessage = 'Failed to load subscribers.';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        if (res.status >= 500) {
          errorMessage = 'Server error. Please try again later.';
        }
      }
      throw new Error(errorMessage);
    }
    
    let data;
    try {
      data = await res.json();
    } catch {
      throw new Error('Invalid response from server. Please try again.');
    }
    
    // Clear loading state
    body.textContent = '';
    
    if (!Array.isArray(data)) {
      throw new Error('Unexpected response format from server.');
    }
    
    if (data.length === 0) {
      body.textContent = '';
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 6;
      emptyCell.style.textAlign = 'center';
      emptyCell.style.padding = '40px 20px';
      
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.style.padding = '0';
      
      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      icon.style.fontSize = '2.5rem';
      icon.innerHTML = '<i class="fas fa-inbox"></i>';
      
      const title = document.createElement('div');
      title.className = 'empty-state-title';
      title.textContent = 'No subscribers found';
      
      const message = document.createElement('div');
      message.className = 'empty-state-message';
      message.style.fontSize = '0.95rem';
      message.textContent = emailSearch || sourceFilter 
        ? 'No subscribers match your search criteria. Try adjusting your filters.'
        : 'There are no subscribers in the mailing list yet.';
      
      emptyState.appendChild(icon);
      emptyState.appendChild(title);
      emptyState.appendChild(message);
      emptyCell.appendChild(emptyState);
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
      
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = '<i class="fas fa-sync-alt" aria-hidden="true"></i> Refresh';
      }
      return;
    }
    
    // Safely create table rows using DOM methods
    data.forEach(sub => {
      const row = document.createElement('tr');
      
      // Email
      const emailCell = document.createElement('td');
      emailCell.textContent = sub.email || 'No email';
      
      // Consent Given
      const consentCell = document.createElement('td');
      consentCell.textContent = sub.consent_given ? 'Yes' : 'No';
      consentCell.className = sub.consent_given ? 'consent-yes' : 'consent-no';
      
      // Consent Timestamp
      const consentTimestampCell = document.createElement('td');
      consentTimestampCell.textContent = formatDateTime(sub.consent_timestamp);
      
      // Source
      const sourceCell = document.createElement('td');
      sourceCell.textContent = sub.source || 'unknown';
      
      // Created At
      const createdAtCell = document.createElement('td');
      createdAtCell.textContent = formatDateTime(sub.created_at);
      
      // Updated At
      const updatedAtCell = document.createElement('td');
      updatedAtCell.textContent = formatDateTime(sub.updated_at);
      
      row.appendChild(emailCell);
      row.appendChild(consentCell);
      row.appendChild(consentTimestampCell);
      row.appendChild(sourceCell);
      row.appendChild(createdAtCell);
      row.appendChild(updatedAtCell);
      
      body.appendChild(row);
    });
    
    // Show success status
    if (statusEl) {
      statusEl.textContent = `Loaded ${data.length} subscriber${data.length !== 1 ? 's' : ''}.`;
      statusEl.className = 'admin-status status-success';
      statusEl.style.display = 'block';
      setTimeout(() => {
        statusEl.style.display = 'none';
      }, 3000);
    }
  } catch (err) {
    if (window.clientLogger) {
      window.clientLogger.apiError('GET', '/admin/mailing-list', err, { 
        emailSearch,
        sourceFilter,
      });
    } else {
      console.error(err);
    }
    // Clear and show error state safely
    body.textContent = '';
    const errorRow = document.createElement('tr');
    const errorCell = document.createElement('td');
    errorCell.colSpan = 6;
    errorCell.style.color = '#c33';
    errorCell.style.padding = '20px';
    errorCell.style.textAlign = 'center';
    if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
      errorCell.textContent = 'Request timed out. Please check your internet connection and try again.';
    } else if (err.message && err.message.includes('Failed to fetch')) {
      errorCell.textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
    } else {
      errorCell.textContent = err.message || 'Failed to load subscribers. Please try again.';
    }
    errorRow.appendChild(errorCell);
    body.appendChild(errorRow);
    
    // Show error status
    if (statusEl) {
      statusEl.textContent = err.message || 'Failed to load subscribers.';
      statusEl.className = 'admin-status status-error';
      statusEl.style.display = 'block';
    }
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = '<i class="fas fa-sync-alt" aria-hidden="true"></i> Refresh';
    }
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('refreshBtn');
  const emailSearch = document.getElementById('emailSearch');
  const sourceFilter = document.getElementById('sourceFilter');
  
  // Refresh button listener
  if (refreshBtn) {
    refreshBtn.addEventListener('click', refreshSubscribers);
  }
  
  // Search with debounce
  if (emailSearch) {
    emailSearch.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        refreshSubscribers();
      }, 500);
    });
  }
  
  // Source filter listener
  if (sourceFilter) {
    sourceFilter.addEventListener('change', refreshSubscribers);
  }
  
  // Auto-load subscribers on page load
  refreshSubscribers();
});
