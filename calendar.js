document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const calendar = params.get('calendar');
  const plan = params.get('plan');
  const priceParam = Number(params.get('price'));
  const weekParam = params.get('week');

  const planDetails = {
    free: { name: 'Free', price: 0, isFree: true, duration: 30 },
    one_to_one: { name: '1-to-1 Lesson', price: 40, isFree: false, duration: 60 },
    group: { name: 'Group Session', price: 20, isFree: false, duration: 60 },
    'gcse-free': { name: 'GCSE Free', price: 0, isFree: true, duration: 30 },
    'gcse-one_to_one': { name: 'GCSE 1-to-1', price: 35, isFree: false, duration: 60 },
    'gcse-group': { name: 'GCSE Group', price: 20, isFree: false, duration: 60 },
    'gcse-maths-bundle': { name: 'GCSE Maths Bundle', price: 175, isFree: false, duration: 60 },
    'gcse-physics-bundle': { name: 'GCSE Physics Bundle', price: 175, isFree: false, duration: 60 },
    'a-level-free': { name: 'A-Level Free', price: 0, isFree: true, duration: 30 },
    'a-level-one_to_one': { name: 'A-Level 1-to-1', price: 45, isFree: false, duration: 60 },
    'a-level-group': { name: 'A-Level Group', price: 25, isFree: false, duration: 60 },
    'alevel-maths-bundle': { name: 'A Level Maths Bundle', price: 225, isFree: false, duration: 60 },
    'alevel-further-maths-bundle': { name: 'A Level Further Maths Bundle', price: 225, isFree: false, duration: 60 },
    'alevel-physics-bundle': { name: 'A Level Physics Bundle', price: 225, isFree: false, duration: 60 }
  };

  // Require calendar for filtered slot display; require plan for pricing/flow
  if (!calendar || typeof calendar !== 'string' || !calendar.trim()) {
    window.location.replace('/tutoring.html');
    return;
  }
  const calendarKey = calendar.trim();
  if (!plan || !planDetails[plan]) {
    window.location.replace('/tutoring.html');
    return;
  }

  const selectedPlan = planDetails[plan];
  const planPrice = Number.isNaN(priceParam) ? selectedPlan.price : priceParam;

  const calendarGrid = document.getElementById('calendarGrid');
  const planNotice = document.getElementById('planNotice');
  const selectedSlotText = document.getElementById('selectedSlot');
  const continueBtn = document.getElementById('continueBtn');
  const todayBtn = document.getElementById('todayBtn');
  const prevWeekBtn = document.getElementById('prevWeekBtn');
  const nextWeekBtn = document.getElementById('nextWeekBtn');
  const currentWeekDisplay = document.getElementById('currentWeekDisplay');

  planNotice.textContent = `${selectedPlan.name} - £${planPrice}`;

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours = Array.from({ length: 9 }, (_, i) => 10 + i); // 10:00 to 18:00

  let selectedSlotButton = null;
  let selectedSlot = null;
  let currentWeekStart = null;
  let availableSlotsMap = new Map(); // Maps "YYYY-MM-DDTHH:MM" -> { id, start, end }

  function getStartOfWeek(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay(); // 0 (Sun) - 6 (Sat)
    const diff = day === 0 ? -6 : 1 - day; // move to Monday
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function initializeWeek() {
    if (weekParam) {
      // Parse week parameter (YYYY-MM-DD format)
      const [year, month, day] = weekParam.split('-').map(Number);
      currentWeekStart = getStartOfWeek(new Date(year, month - 1, day));
    } else {
      currentWeekStart = getStartOfWeek();
    }
    updateURL();
    renderCalendar();
    updateWeekDisplay();
  }

  function updateWeekDisplay() {
    const weekEnd = new Date(currentWeekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    
    const startMonth = currentWeekStart.toLocaleDateString(undefined, { month: 'short' });
    const endMonth = weekEnd.toLocaleDateString(undefined, { month: 'short' });
    const startDay = currentWeekStart.getDate();
    const endDay = weekEnd.getDate();
    const year = currentWeekStart.getFullYear();
    
    if (startMonth === endMonth) {
      currentWeekDisplay.textContent = `${startMonth} ${startDay} - ${endDay}, ${year}`;
    } else {
      currentWeekDisplay.textContent = `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
    }
  }

  function updateURL() {
    const weekStr = dateValue(currentWeekStart);
    const url = new URL(window.location.href);
    url.searchParams.set('week', weekStr);
    window.history.replaceState({ week: weekStr }, '', url.toString());
  }

  function navigateWeek(direction) {
    currentWeekStart = new Date(currentWeekStart);
    currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
    updateURL();
    renderCalendar();
    updateWeekDisplay();
    // Clear selection when navigating
    if (selectedSlotButton) {
      selectedSlotButton.classList.remove('selected');
      selectedSlotButton.setAttribute('aria-pressed', 'false');
      selectedSlotButton = null;
    }
    selectedSlot = null;
    selectedSlotText.textContent = 'Select an available time slot to continue.';
    continueBtn.disabled = true;
  }

  function goToToday() {
    currentWeekStart = getStartOfWeek();
    updateURL();
    renderCalendar();
    updateWeekDisplay();
    // Clear selection when navigating
    if (selectedSlotButton) {
      selectedSlotButton.classList.remove('selected');
      selectedSlotButton.setAttribute('aria-pressed', 'false');
      selectedSlotButton = null;
    }
    selectedSlot = null;
    selectedSlotText.textContent = 'Select an available time slot to continue.';
    continueBtn.disabled = true;
  }

  function formatDayLabel(dateObj) {
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function formatLongDate(dateObj) {
    return dateObj.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function dateValue(dateObj) {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Fetch available slots for this calendar
  async function fetchAvailableSlots() {
    try {
      const url = `/api/slots?calendar=${encodeURIComponent(calendarKey)}`;
      const res = await fetchWithTimeout(url, {}, 10000);
      if (!res.ok) {
        console.warn('Failed to fetch slots, will show all as unavailable');
        return new Map();
      }
      const slots = await res.json();
      const slotMap = new Map();
      
      // Create a map: "YYYY-MM-DDTHH:MM" -> slot info
      slots.forEach(slot => {
        const startDate = new Date(slot.start);
        const dateStr = startDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
        slotMap.set(dateStr, { id: slot.id, start: slot.start, end: slot.end });
      });
      
      return slotMap;
    } catch (err) {
      console.warn('Error fetching slots:', err);
      return new Map();
    }
  }

  // Check if a slot is available for the given date and hour
  function isSlotAvailable(dateObj, hour) {
    const slotDate = new Date(dateObj);
    slotDate.setHours(hour, 0, 0, 0);
    const slotKey = slotDate.toISOString().slice(0, 16); // "YYYY-MM-DDTHH:MM"
    return availableSlotsMap.get(slotKey);
  }

  const buildSlotButton = (dayName, dateObj, hour) => {
    const label = `${String(hour).padStart(2, '0')}:00`;
    const dateLabel = formatLongDate(dateObj);
    const slotButton = document.createElement('button');
    slotButton.type = 'button';
    slotButton.classList.add('slot');
    slotButton.textContent = label;
    slotButton.setAttribute('role', 'gridcell');
    
    // Check if slot exists in database
    const slotInfo = isSlotAvailable(dateObj, hour);
    const isAvailable = !!slotInfo;
    
    if (isAvailable) {
      slotButton.classList.add('available');
      slotButton.setAttribute('aria-pressed', 'false');
      slotButton.setAttribute('aria-label', `${label} on ${dateLabel} - Available`);
      slotButton.setAttribute('data-slot-id', slotInfo.id);
      slotButton.addEventListener('click', () => selectSlot(slotButton, dateObj, label, slotInfo.id));
      // Add keyboard support
      slotButton.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selectSlot(slotButton, dateObj, label, slotInfo.id);
        }
      });
    } else {
      slotButton.classList.add('unavailable');
      slotButton.disabled = true;
      slotButton.setAttribute('aria-disabled', 'true');
      slotButton.setAttribute('aria-label', `${label} on ${dateLabel} - Unavailable`);
    }

    return slotButton;
  };

  const selectSlot = (button, dateObj, label, slotId) => {
    if (selectedSlotButton) {
      selectedSlotButton.classList.remove('selected');
      selectedSlotButton.setAttribute('aria-pressed', 'false');
    }
    selectedSlotButton = button;
    button.classList.add('selected');
    button.setAttribute('aria-pressed', 'true');
    selectedSlot = {
      dateValue: dateValue(dateObj),
      dateLabel: formatLongDate(dateObj),
      time: label,
      slotId: slotId
    };
    selectedSlotText.textContent = `Selected: ${selectedSlot.dateLabel} at ${label}`;
    selectedSlotText.setAttribute('aria-label', `Selected time slot: ${selectedSlot.dateLabel} at ${label}`);
    continueBtn.disabled = false;
    continueBtn.setAttribute('aria-label', `Continue to payment with selected time slot: ${selectedSlot.dateLabel} at ${label}`);
    // Announce selection to screen readers
    selectedSlotText.setAttribute('role', 'status');
    // Focus continue button for keyboard users (optional - can be removed if not desired)
    // continueBtn.focus();
  };

  async function renderCalendar() {
    // Clear existing calendar
    calendarGrid.innerHTML = '';

    // Fetch available slots for current week
    availableSlotsMap = await fetchAvailableSlots();

    days.forEach((dayName, index) => {
      const column = document.createElement('div');
      column.classList.add('day-column');
      column.setAttribute('role', 'row');

      const currentDate = new Date(currentWeekStart);
      currentDate.setDate(currentWeekStart.getDate() + index);

      const header = document.createElement('div');
      header.classList.add('day-header');
      header.setAttribute('role', 'columnheader');
      header.setAttribute('aria-label', `${dayName}, ${formatDayLabel(currentDate)}`);
      
      // Highlight today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateToCheck = new Date(currentDate);
      dateToCheck.setHours(0, 0, 0, 0);
      if (dateToCheck.getTime() === today.getTime()) {
        header.classList.add('today');
      }
      
      const title = document.createElement('span');
      title.textContent = dayName;
      const dateLine = document.createElement('span');
      dateLine.classList.add('day-date');
      dateLine.textContent = formatDayLabel(currentDate);
      header.appendChild(title);
      header.appendChild(dateLine);
      column.appendChild(header);

      hours.forEach(hour => {
        column.appendChild(buildSlotButton(dayName, currentDate, hour));
      });

      calendarGrid.appendChild(column);
    });
  }

  // Initialize calendar
  initializeWeek();

  // Navigation event listeners
  todayBtn.addEventListener('click', goToToday);
  prevWeekBtn.addEventListener('click', () => navigateWeek(-1));
  nextWeekBtn.addEventListener('click', () => navigateWeek(1));

  continueBtn.addEventListener('click', async () => {
    if (!selectedSlot || !selectedSlot.slotId) {
      return;
    }
    
    // For free sessions, auto-book and skip payment
    if (selectedPlan.isFree) {
      continueBtn.disabled = true;
      continueBtn.textContent = 'Booking...';
      
      try {
        // Check if user is logged in
        const checkRes = await fetchWithTimeout('/api/user-bookings', {}, 2000);
        if (checkRes.ok) {
          // User is logged in - book directly using session email
          const bookRes = await fetchWithTimeout('/api/book', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slotId: selectedSlot.slotId, amount_pence: 0 })
          }, 10000);
          
          if (bookRes.ok) {
            // Track free booking completion
            if (window.trackBooking) {
              window.trackBooking('free', {
                slot_id: selectedSlot.slotId,
                value: 0,
                currency: 'GBP',
              });
            }
            // Redirect to confirmation page
            const confirmUrl = new URL('confirmation.html', window.location.href);
            // Email will be shown via session on confirmation page
            window.location.href = confirmUrl.toString();
            return;
          } else {
            const errorData = await bookRes.json().catch(() => ({}));
            alert(errorData.message || 'Booking failed. Please try again.');
            continueBtn.disabled = false;
            continueBtn.textContent = 'Go to Payment';
            return;
          }
        }
        // Not logged in - redirect to continue.html (though guests should be blocked on package page)
        const continueUrl = new URL('continue.html', window.location.href);
        continueUrl.searchParams.set('redirect', 'calendar');
        continueUrl.searchParams.set('plan', plan);
        continueUrl.searchParams.set('price', planPrice.toString());
        continueUrl.searchParams.set('date', selectedSlot.dateValue);
        continueUrl.searchParams.set('time', selectedSlot.time);
        continueUrl.searchParams.set('displayDate', selectedSlot.dateLabel);
        continueUrl.searchParams.set('slot_id', selectedSlot.slotId.toString());
        continueUrl.searchParams.set('auto_book', 'true');
        window.location.href = continueUrl.toString();
        return;
      } catch (err) {
        // If /api/user-bookings fails with 401, user is not logged in
        if (err.name === 'TimeoutError' || err.message?.includes('Failed to fetch')) {
          // Network error - try to continue to booking page
          const continueUrl = new URL('continue.html', window.location.href);
          continueUrl.searchParams.set('redirect', 'calendar');
          continueUrl.searchParams.set('plan', plan);
          continueUrl.searchParams.set('price', planPrice.toString());
          continueUrl.searchParams.set('date', selectedSlot.dateValue);
          continueUrl.searchParams.set('time', selectedSlot.time);
          continueUrl.searchParams.set('displayDate', selectedSlot.dateLabel);
          continueUrl.searchParams.set('slot_id', selectedSlot.slotId.toString());
          continueUrl.searchParams.set('auto_book', 'true');
          window.location.href = continueUrl.toString();
          return;
        }
        console.error('Free booking error:', err);
        continueBtn.disabled = false;
        continueBtn.textContent = 'Go to Payment';
        alert('An error occurred. Please try again.');
        return;
      }
    } else {
      // Paid sessions go to payment page
      const next = new URL('payment.html', window.location.href);
      next.searchParams.set('plan', plan);
      next.searchParams.set('price', planPrice.toString());
      next.searchParams.set('date', selectedSlot.dateValue);
      next.searchParams.set('time', selectedSlot.time);
      next.searchParams.set('displayDate', selectedSlot.dateLabel);
      next.searchParams.set('slot_id', selectedSlot.slotId.toString());
      window.location.href = next.toString();
    }
  });
});
