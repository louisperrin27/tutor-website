// Minimal admin functions: generate slots and view all bookings

// Load fetch timeout utility
const fetchTimeoutScript = document.createElement('script');
fetchTimeoutScript.src = 'fetch-with-timeout.js';
document.head.appendChild(fetchTimeoutScript);

async function generateSlots() {
  const slotCalendarEl = document.getElementById('slotCalendar');
  const slotDateRaw = document.getElementById('slotDate').value.trim();
  const slotTime = document.getElementById('slotTime').value;
  const statusEl = document.getElementById('status');
  const genBtn = document.getElementById('genBtn');
  
  statusEl.textContent = 'Generating slots...';
  if (genBtn) {
    genBtn.disabled = true;
    genBtn.textContent = 'Generating...';
  }
  
  try {
    const calendarKey = slotCalendarEl && slotCalendarEl.value ? slotCalendarEl.value.trim() : '';
    if (!calendarKey) {
      throw new Error('Please select a Calendar (session type).');
    }
    if (!slotDateRaw) {
      throw new Error('Date is required.');
    }
    if (!slotTime) {
      throw new Error('Time is required.');
    }
    const startDate = slotDateRaw;
    const endDate = startDate;
    const times = [slotTime];
    
    const res = await fetchWithTimeout(`/admin/generate-slots`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startDate, endDate, times, calendarKey })
    }, 10000);
    
    if (!res.ok) {
      let errorMessage = 'Failed to generate slots.';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        if (res.status === 401 || res.status === 403) {
          errorMessage = 'Authentication required. Please sign in again.';
          window.location.href = '/admin-login.html';
          return;
        } else if (res.status === 400) {
          errorMessage = 'Invalid input. Please check your dates and times.';
        } else if (res.status >= 500) {
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
    
    if (data && typeof data.added === 'number') {
      statusEl.textContent = `✓ Added ${data.added} slots.`;
      statusEl.classList.add('status-success');
      statusEl.classList.remove('status-error');
    } else {
      throw new Error('Unexpected response from server.');
    }
  } catch (err) {
    if (window.clientLogger) {
      window.clientLogger.error('Slot generation failed', {
        error: err,
        slotDateRaw,
        slotTime,
      });
    } else {
      console.error(err);
    }
    let errorMsg = err.message || 'Error generating slots. Please check your inputs.';
    if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
      errorMsg = 'Request timed out. Please check your internet connection and try again.';
    }
    statusEl.textContent = '✗ ' + errorMsg;
    statusEl.classList.add('status-error');
    statusEl.classList.remove('status-success');
  } finally {
    if (genBtn) {
      genBtn.disabled = false;
      genBtn.textContent = 'Generate Slots';
    }
  }
}

async function refreshBookings() {
  const body = document.getElementById('bookingsBody');
  const refreshBtn = document.getElementById('refreshBtn');
  
  // Clear and show loading state safely
  body.textContent = '';
  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 4;
  loadingCell.style.textAlign = 'center';
  loadingCell.style.padding = '20px';
  loadingCell.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading bookings...';
  loadingRow.appendChild(loadingCell);
  body.appendChild(loadingRow);
  
  // Disable button during load
  if (refreshBtn) {
    refreshBtn.disabled = true;
    refreshBtn.textContent = 'Loading...';
  }
  
  try {
    const res = await fetchWithTimeout(`/admin/bookings`, {}, 10000);
    
    if (!res.ok) {
      let errorMessage = 'Failed to load bookings.';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        if (res.status === 401 || res.status === 403) {
          errorMessage = 'Authentication required. Please sign in again.';
          window.location.href = '/admin-login.html';
          return;
        } else if (res.status >= 500) {
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
      emptyCell.colSpan = 4;
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
      title.textContent = 'No bookings found';
      
      const message = document.createElement('div');
      message.className = 'empty-state-message';
      message.style.fontSize = '0.95rem';
      message.textContent = 'There are no bookings in the system yet. Generate time slots to start accepting bookings.';
      
      emptyState.appendChild(icon);
      emptyState.appendChild(title);
      emptyState.appendChild(message);
      emptyCell.appendChild(emptyState);
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
      return;
    }
    
    // Safely create table rows using DOM methods
    data.forEach(b => {
      const row = document.createElement('tr');
      
      const when = new Date(b.start).toLocaleString();
      const price = `£${(b.amount_pence/100).toFixed(2)}`;
      
      // Create cells and set text content (safe - automatically escapes HTML)
      const whenCell = document.createElement('td');
      whenCell.textContent = when;
      
      const serviceCell = document.createElement('td');
      serviceCell.textContent = b.service_name || 'Unknown Service';
      
      const emailCell = document.createElement('td');
      emailCell.textContent = b.user_email || 'No email';
      
      const priceCell = document.createElement('td');
      priceCell.textContent = price;
      
      row.appendChild(whenCell);
      row.appendChild(serviceCell);
      row.appendChild(emailCell);
      row.appendChild(priceCell);
      
      body.appendChild(row);
    });
  } catch (err) {
    if (window.clientLogger) {
      window.clientLogger.apiError('GET', '/admin/bookings', err, {});
    } else {
      console.error(err);
    }
    // Clear and show error state safely
    body.textContent = '';
    const errorRow = document.createElement('tr');
    const errorCell = document.createElement('td');
    errorCell.colSpan = 4;
    errorCell.style.color = '#c33';
    errorCell.style.padding = '20px';
    errorCell.style.textAlign = 'center';
    if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
      errorCell.textContent = 'Request timed out. Please check your internet connection and try again.';
    } else if (err.message && err.message.includes('Failed to fetch')) {
      errorCell.textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
    } else {
      errorCell.textContent = err.message || 'Failed to load bookings. Please try again.';
    }
    errorRow.appendChild(errorCell);
    body.appendChild(errorRow);
  } finally {
    if (refreshBtn) {
      refreshBtn.disabled = false;
      refreshBtn.textContent = 'Refresh Bookings';
    }
  }
}

async function viewSlots() {
  const dateInput = document.getElementById('slotViewDate').value;
  const slotsBody = document.getElementById('slotsBody');
  const slotsStatus = document.getElementById('slotsStatus');
  const viewSlotsBtn = document.getElementById('viewSlotsBtn');
  
  if (!dateInput) {
    slotsStatus.textContent = '✗ Please select a date.';
    slotsStatus.classList.add('status-error');
    slotsStatus.classList.remove('status-success');
    return;
  }
  
  // Show loading state
  slotsBody.textContent = '';
  const loadingRow = document.createElement('tr');
  const loadingCell = document.createElement('td');
  loadingCell.colSpan = 4;
  loadingCell.style.textAlign = 'center';
  loadingCell.style.padding = '20px';
  loadingCell.innerHTML = '<i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>Loading slots...';
  loadingRow.appendChild(loadingCell);
  slotsBody.appendChild(loadingRow);
  
  if (viewSlotsBtn) {
    viewSlotsBtn.disabled = true;
    viewSlotsBtn.textContent = 'Loading...';
  }
  
  try {
    const res = await fetchWithTimeout(`/admin/slots?startDate=${dateInput}&endDate=${dateInput}`, {}, 10000);
    
    if (!res.ok) {
      let errorMessage = 'Failed to load slots.';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        if (res.status === 401 || res.status === 403) {
          errorMessage = 'Authentication required. Please sign in again.';
          window.location.href = '/admin-login.html';
          return;
        } else if (res.status >= 500) {
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
    
    slotsBody.textContent = '';
    
    if (!Array.isArray(data)) {
      throw new Error('Unexpected response format from server.');
    }
    
    if (data.length === 0) {
      const emptyRow = document.createElement('tr');
      const emptyCell = document.createElement('td');
      emptyCell.colSpan = 4;
      emptyCell.style.textAlign = 'center';
      emptyCell.style.padding = '40px 20px';
      
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.style.padding = '0';
      
      const icon = document.createElement('div');
      icon.className = 'empty-state-icon';
      icon.style.fontSize = '2.5rem';
      icon.innerHTML = '<i class="fas fa-calendar-times"></i>';
      
      const title = document.createElement('div');
      title.className = 'empty-state-title';
      title.textContent = 'No slots found';
      
      const message = document.createElement('div');
      message.className = 'empty-state-message';
      message.style.fontSize = '0.95rem';
      message.textContent = `No slots exist for ${dateInput}. Generate slots to create them.`;
      
      emptyState.appendChild(icon);
      emptyState.appendChild(title);
      emptyState.appendChild(message);
      emptyCell.appendChild(emptyState);
      emptyRow.appendChild(emptyCell);
      slotsBody.appendChild(emptyRow);
      
      slotsStatus.textContent = `No slots found for ${dateInput}`;
      slotsStatus.classList.remove('status-error');
      slotsStatus.classList.add('status-success');
      return;
    }
    
    // Create table rows
    data.forEach(slot => {
      const row = document.createElement('tr');
      
      const startDate = new Date(slot.start);
      const dateTimeStr = startDate.toLocaleString();
      
      const dateTimeCell = document.createElement('td');
      dateTimeCell.textContent = dateTimeStr;
      
      const serviceCell = document.createElement('td');
      serviceCell.textContent = slot.service_name || 'Unknown Service';
      
      const statusCell = document.createElement('td');
      statusCell.textContent = slot.status || 'available';
      
      const actionCell = document.createElement('td');
      if (slot.status === 'booked') {
        actionCell.textContent = 'Cannot delete';
        actionCell.style.color = '#999';
      } else {
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = 'Delete';
        deleteBtn.className = 'btn btn-secondary';
        deleteBtn.style.padding = '4px 12px';
        deleteBtn.style.fontSize = '0.9rem';
        deleteBtn.setAttribute('aria-label', `Delete slot at ${dateTimeStr}`);
        deleteBtn.addEventListener('click', () => deleteSlot(slot.id, dateTimeStr, row));
        actionCell.appendChild(deleteBtn);
      }
      
      row.appendChild(dateTimeCell);
      row.appendChild(serviceCell);
      row.appendChild(statusCell);
      row.appendChild(actionCell);
      
      slotsBody.appendChild(row);
    });
    
    slotsStatus.textContent = `Loaded ${data.length} slot(s) for ${dateInput}`;
    slotsStatus.classList.remove('status-error');
    slotsStatus.classList.add('status-success');
  } catch (err) {
    if (window.clientLogger) {
      window.clientLogger.apiError('GET', '/admin/slots', err, {});
    } else {
      console.error(err);
    }
    
    slotsBody.textContent = '';
    const errorRow = document.createElement('tr');
    const errorCell = document.createElement('td');
    errorCell.colSpan = 4;
    errorCell.style.color = '#c33';
    errorCell.style.padding = '20px';
    errorCell.style.textAlign = 'center';
    if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
      errorCell.textContent = 'Request timed out. Please check your internet connection and try again.';
    } else if (err.message && err.message.includes('Failed to fetch')) {
      errorCell.textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
    } else {
      errorCell.textContent = err.message || 'Failed to load slots. Please try again.';
    }
    errorRow.appendChild(errorCell);
    slotsBody.appendChild(errorRow);
    
    slotsStatus.textContent = '✗ ' + (err.message || 'Failed to load slots');
    slotsStatus.classList.add('status-error');
    slotsStatus.classList.remove('status-success');
  } finally {
    if (viewSlotsBtn) {
      viewSlotsBtn.disabled = false;
      viewSlotsBtn.textContent = 'View Slots';
    }
  }
}

async function deleteSlot(slotId, slotTime, rowElement) {
  const slotsStatus = document.getElementById('slotsStatus');
  
  if (!confirm(`Delete slot at ${slotTime}?`)) {
    return;
  }
  
  try {
    const res = await fetchWithTimeout(`/admin/slots/${slotId}`, {
      method: 'DELETE'
    }, 10000);
    
    if (!res.ok) {
      let errorMessage = 'Failed to delete slot.';
      try {
        const errorData = await res.json();
        errorMessage = errorData.message || errorMessage;
      } catch {
        if (res.status === 401 || res.status === 403) {
          errorMessage = 'Authentication required. Please sign in again.';
          window.location.href = '/admin-login.html';
          return;
        } else if (res.status === 404) {
          errorMessage = 'Slot not found.';
        } else if (res.status === 400) {
          errorMessage = 'Cannot delete this slot (may be booked).';
        }
      }
      throw new Error(errorMessage);
    }
    
    // Remove row from table
    rowElement.remove();
    
    slotsStatus.textContent = `✓ Slot deleted successfully.`;
    slotsStatus.classList.remove('status-error');
    slotsStatus.classList.add('status-success');
  } catch (err) {
    if (window.clientLogger) {
      window.clientLogger.apiError('DELETE', `/admin/slots/${slotId}`, err, {});
    } else {
      console.error(err);
    }
    slotsStatus.textContent = '✗ ' + (err.message || 'Failed to delete slot');
    slotsStatus.classList.add('status-error');
    slotsStatus.classList.remove('status-success');
  }
}

document.getElementById('genBtn').addEventListener('click', generateSlots);
document.getElementById('refreshBtn').addEventListener('click', refreshBookings);
document.getElementById('viewSlotsBtn').addEventListener('click', viewSlots);
document.getElementById('refreshSlotsBtn').addEventListener('click', viewSlots);

