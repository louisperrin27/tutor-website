// Load authenticated user's bookings and display in two tables (future/previous)

document.addEventListener('DOMContentLoaded', async () => {
  const loadingState = document.getElementById('loadingState');
  const bookingsContent = document.getElementById('bookingsContent');
  const errorState = document.getElementById('errorState');
  const errorMessage = document.getElementById('errorMessage');
  const futureBookingsBody = document.getElementById('futureBookingsBody');
  const previousBookingsBody = document.getElementById('previousBookingsBody');

  async function loadBookings() {
    loadingState.style.display = 'block';
    bookingsContent.style.display = 'none';
    errorState.style.display = 'none';

    try {
      const res = await fetchWithTimeout('/api/user-bookings', {}, 10000);

      if (res.status === 401) {
        // Not logged in - redirect to login
        window.location.href = 'login.html';
        return;
      }

      if (!res.ok) {
        let errorData;
        try {
          errorData = await res.json();
        } catch {
          // If JSON parsing fails, use default message
          if (res.status === 404) {
            throw new Error('Bookings endpoint not found. Please restart the server.');
          } else if (res.status >= 500) {
            throw new Error('Server error. Please try again later.');
          } else {
            throw new Error(`Failed to load bookings (status: ${res.status}).`);
          }
        }
        throw new Error(errorData.message || 'Failed to load bookings.');
      }

      const data = await res.json();
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response from server.');
      }

      const future = Array.isArray(data.future) ? data.future : [];
      const previous = Array.isArray(data.previous) ? data.previous : [];

      // Clear existing rows
      futureBookingsBody.innerHTML = '';
      previousBookingsBody.innerHTML = '';

      // Render future bookings
      if (future.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="4" style="text-align: center; color: var(--text-secondary, #666); padding: 2rem;">No future bookings</td>';
        futureBookingsBody.appendChild(row);
      } else {
        future.forEach(booking => {
          const row = document.createElement('tr');
          const date = new Date(booking.start);
          const dateStr = date.toLocaleDateString();
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const activity = booking.activity || booking.service_name || 'Unknown';
          
          const activityCell = document.createElement('td');
          activityCell.textContent = activity;
          
          const dateCell = document.createElement('td');
          dateCell.textContent = dateStr;
          
          const timeCell = document.createElement('td');
          timeCell.textContent = timeStr;
          
          const actionCell = document.createElement('td');
          const deleteBtn = document.createElement('button');
          deleteBtn.textContent = 'Delete';
          deleteBtn.className = 'btn btn-secondary';
          deleteBtn.style.padding = '4px 12px';
          deleteBtn.style.fontSize = '0.9rem';
          deleteBtn.setAttribute('aria-label', `Delete booking for ${activity} on ${dateStr} at ${timeStr}`);
          deleteBtn.addEventListener('click', () => deleteBooking(booking.id, activity, dateStr, timeStr, row));
          actionCell.appendChild(deleteBtn);
          
          row.appendChild(activityCell);
          row.appendChild(dateCell);
          row.appendChild(timeCell);
          row.appendChild(actionCell);
          futureBookingsBody.appendChild(row);
        });
      }

      // Render previous bookings
      if (previous.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = '<td colspan="3" style="text-align: center; color: var(--text-secondary, #666); padding: 2rem;">No previous bookings</td>';
        previousBookingsBody.appendChild(row);
      } else {
        previous.forEach(booking => {
          const row = document.createElement('tr');
          const date = new Date(booking.start);
          const dateStr = date.toLocaleDateString();
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const activity = booking.activity || booking.service_name || 'Unknown';
          
          const activityCell = document.createElement('td');
          activityCell.textContent = activity;
          
          const dateCell = document.createElement('td');
          dateCell.textContent = dateStr;
          
          const timeCell = document.createElement('td');
          timeCell.textContent = timeStr;
          
          row.appendChild(activityCell);
          row.appendChild(dateCell);
          row.appendChild(timeCell);
          previousBookingsBody.appendChild(row);
        });
      }

      loadingState.style.display = 'none';
      bookingsContent.style.display = 'block';
    } catch (err) {
      if (window.clientLogger) {
        window.clientLogger.apiError('GET', '/api/user-bookings', err, {});
      } else {
        console.error('Failed to load bookings', err);
      }
      
      loadingState.style.display = 'none';
      errorState.style.display = 'block';
      
      if (err.name === 'TimeoutError' || err.message.includes('timed out')) {
        errorMessage.textContent = 'Request timed out. Please check your internet connection and try again.';
      } else if (err.message && err.message.includes('Failed to fetch')) {
        errorMessage.textContent = 'Unable to connect to the server. Please check your internet connection and try again.';
      } else {
        errorMessage.textContent = err.message || 'Failed to load bookings. Please try again.';
      }
    }
  }

  async function deleteBooking(bookingId, activity, dateStr, timeStr, rowElement) {
    if (!confirm(`Delete booking for ${activity} on ${dateStr} at ${timeStr}?`)) {
      return;
    }

    try {
      const res = await fetchWithTimeout(`/api/user-bookings/${bookingId}`, {
        method: 'DELETE'
      }, 10000);

      if (res.status === 401) {
        window.location.href = 'login.html';
        return;
      }

      if (!res.ok) {
        let errorMessage = 'Failed to delete booking.';
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          if (res.status === 404) {
            errorMessage = 'Booking not found.';
          } else if (res.status === 403) {
            errorMessage = 'You do not have permission to delete this booking.';
          }
        }
        throw new Error(errorMessage);
      }

      // Remove row from table and reload bookings
      rowElement.remove();
      await loadBookings();
    } catch (err) {
      if (window.clientLogger) {
        window.clientLogger.apiError('DELETE', `/api/user-bookings/${bookingId}`, err, {});
      } else {
        console.error('Failed to delete booking', err);
      }
      alert(err.message || 'Failed to delete booking. Please try again.');
    }
  }

  loadBookings();
});