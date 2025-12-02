// schedule.js
// Workshop schedule (front-end only, localStorage storage for now)
/* global bootstrap */

// For now, use the mock API. Later you can swap back to sharepoint:
import * as api from './api.sharepoint.js'
// import * as api from './api.mock.js'

// ------------------ state ------------------
let mechanics = []
// [{ id, date, mechanic, serviceType, startTime, durationHours, customerLabel, notes }]
let bookings = []
let currentWeekStart = getMonday(new Date()) // Date object (Monday of current week)

// Time slots (08:00–18:00 in 30-minute steps)
const TIME_SLOTS = buildTimeSlots()
// Booking types → CSS class
const SERVICE_CLASS_MAP = {
  'Pro Service': 'booking-service-pro',
  'Major Service': 'booking-service-major',
  'Expert Service': 'booking-service-expert',
  'Minimum Charge': 'booking-service-min'
}

// Map service type -> default duration (hours)
function getDefaultDurationHours (serviceType) {
  switch (serviceType) {
    case 'Pro Service':
      return 5
    case 'Major Service':
      return 3
    case 'Expert Service':
      return 2
    case 'Minimum Charge':
      return 0.5
    default:
      return 1
  }
}

// DOM hooks
const weekLabelEl = document.getElementById('weekLabel')
const scheduleGridContainer = document.getElementById('scheduleGridContainer')
const scheduleLoadingEl = document.getElementById('scheduleLoading')

const btnPrevWeek = document.getElementById('btnPrevWeek')
const btnNextWeek = document.getElementById('btnNextWeek')
const btnThisWeek = document.getElementById('btnThisWeek')
const btnNewBooking = document.getElementById('btnNewBooking')

// Modal + form
const bookingModalEl = document.getElementById('bookingModal')
const bookingModal = bookingModalEl ? new bootstrap.Modal(bookingModalEl) : null

const bookingForm = document.getElementById('bookingForm')
const bookingIdInput = document.getElementById('bookingId')
const bookingDateInput = document.getElementById('bookingDate')
const bookingMechanicSelect = document.getElementById('bookingMechanic')
const bookingServiceTypeSelect = document.getElementById('bookingServiceType')
const bookingStartTimeSelect = document.getElementById('bookingStartTime')
const bookingCustomerInput = document.getElementById('bookingCustomer')
const bookingNotesInput = document.getElementById('bookingNotes')
const bookingDeleteBtn = document.getElementById('bookingDeleteBtn')
const bookingModalLabel = document.getElementById('bookingModalLabel')

// Toast container (same idea as app.js)
const toastContainer = document.getElementById('toastContainer')

// --- time grid settings ---
const DAY_START_HOUR = 8 // 08:00
const DAY_END_HOUR = 18 // 18:00
const SLOT_MINUTES = 30 // 30-min grid

const TOTAL_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60
const SLOTS_PER_DAY = TOTAL_MINUTES / SLOT_MINUTES

const dragPreviewEl = null

// ------------------ date & time helpers ------------------

function getMonday (date) {
  const d = new Date(date)
  const day = d.getDay() || 7 // Sunday → 7
  if (day !== 1) {
    d.setDate(d.getDate() - (day - 1))
  }
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDateISO (date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function addDays (date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDayHeader (date) {
  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short'
  })
}

function formatWeekLabel (weekStart) {
  const monday = new Date(weekStart)
  const friday = addDays(monday, 4)
  const opts = { day: '2-digit', month: 'short', year: 'numeric' }
  const startStr = monday.toLocaleDateString(undefined, opts)
  const endStr = friday.toLocaleDateString(undefined, opts)
  return `Week of ${startStr} – ${endStr}`
}

// Build 30-minute slots from 08:00 to 18:00 (last slot starts at 17:30)
function buildTimeSlots () {
  const times = []
  for (let h = 8; h <= 18; h++) {
    for (let m = 0; m < 60; m += 30) {
      if (h === 18 && m > 0) break // don't go beyond 18:00
      const hh = String(h).padStart(2, '0')
      const mm = String(m).padStart(2, '0')
      times.push(`${hh}:${mm}`)
    }
  }
  return times
}

// ------------------ UI helpers ------------------

function showToast (message, type = 'info') {
  if (!toastContainer) {
    console.log(`[${type}] ${message}`)
    return
  }

  const toastId = `toast-${Date.now()}`
  const bgClass = {
    success: 'bg-success text-white',
    danger: 'bg-danger text-white',
    warning: 'bg-warning text-dark',
    info: 'bg-primary text-white'
  }[type] || 'bg-secondary text-white'

  toastContainer.insertAdjacentHTML(
    'beforeend',
    `
    <div id="${toastId}" class="toast align-items-center ${bgClass}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="d-flex">
        <div class="toast-body">
          ${message}
        </div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    </div>
  `
  )

  const toastElem = document.getElementById(toastId)
  const toast = new bootstrap.Toast(toastElem, { delay: 2500 })
  toast.show()
}

// Check if a booking overlaps with any others for the same mechanic & date
function hasOverlap (booking, allBookings) {
  const { mechanic, date, startTime, durationHours } = booking
  if (!mechanic || !date || !startTime || !durationHours) return false

  const [startH, startM] = startTime.split(':').map(Number)
  const startMinutes = startH * 60 + startM
  const endMinutes = startMinutes + durationHours * 60

  return allBookings.some(b => {
    if (b.id === booking.id) return false
    if (b.mechanic !== mechanic || b.date !== date) return false
    if (!b.startTime || !b.durationHours) return false

    const [bh, bm] = b.startTime.split(':').map(Number)
    const bStart = bh * 60 + bm
    const bEnd = bStart + b.durationHours * 60

    // standard overlap check
    return startMinutes < bEnd && endMinutes > bStart
  })
}

// Ensure a booking stays within the day's working hours based on TIME_SLOTS
function fitsInDay (booking) {
  const { startTime, durationHours } = booking
  if (!startTime || !durationHours) return false

  const startIndex = TIME_SLOTS.indexOf(startTime)
  if (startIndex === -1) return false

  const span = Math.round(durationHours * 2) // 0.5 hr slots
  const endIndex = startIndex + span
  return endIndex <= TIME_SLOTS.length
}

// Generate time options for the select (08:00–18:00)
function buildTimeOptions () {
  if (!bookingStartTimeSelect) return
  bookingStartTimeSelect.innerHTML =
    '<option value="">Select…</option>' +
    TIME_SLOTS.map(t => `<option value="${t}">${t}</option>`).join('')
}

// ------------------ rendering ------------------

function renderMechanicOptions () {
  if (!bookingMechanicSelect) return
  bookingMechanicSelect.innerHTML =
    '<option value="">Select mechanic…</option>' +
    mechanics.map(m => `<option value="${m.name}">${m.name}</option>`).join('')
}

function renderWeek () {
  if (!scheduleGridContainer) return

  if (weekLabelEl) {
    weekLabelEl.textContent = formatWeekLabel(currentWeekStart)
  }

  const days = []
  for (let i = 0; i < 5; i++) {
    const d = addDays(currentWeekStart, i)
    days.push({
      date: d,
      iso: formatDateISO(d),
      label: formatDayHeader(d)
    })
  }

  if (!mechanics.length) {
    scheduleGridContainer.innerHTML = `
      <div class="text-muted text-center py-4">
        No mechanics found. Add employees in the main Pipeline app.
      </div>
    `
    if (scheduleLoadingEl) scheduleLoadingEl.remove()
    return
  }

  let html = ''

  // One table per weekday: rows = time slots, columns = mechanics
  days.forEach(day => {
    const bookingsForDay = bookings.filter(b => b.date === day.iso)
    console.log('bookings for day:')
    console.log(bookingsForDay)
    // Prebuild grid per mechanic & time index with booking/skip info
    const grid = {}
    mechanics.forEach(mech => {
      grid[mech.name] = Array(TIME_SLOTS.length).fill(null)
    })

    bookingsForDay.forEach(b => {
      const mechName = b.mechanic
      if (!grid[mechName]) return
      const startIndex = TIME_SLOTS.indexOf(b.startTime)
      if (startIndex === -1) return
      const span = Math.max(1, Math.round(b.durationHours * 2)) // 0.5h increments
      const endIndex = Math.min(TIME_SLOTS.length, startIndex + span)

      // mark main cell
      grid[mechName][startIndex] = { type: 'booking', booking: b, rowSpan: endIndex - startIndex }

      // mark covered rows as skip
      for (let i = startIndex + 1; i < endIndex; i++) {
        grid[mechName][i] = { type: 'skip' }
      }
    })

    html += `
      <div class="day-section mb-4">
        <div class="day-header">${day.label}</div>
        <div class="table-responsive">
          <table class="schedule-grid" data-day="${day.iso}">
            <thead>
              <tr>
                <th class="time-col">Time</th>
                ${mechanics
                  .map(m => `<th class="text-center mechanic-col">${m.name}</th>`)
                  .join('')}
              </tr>
            </thead>
            <tbody>
    `

    TIME_SLOTS.forEach((slotTime, timeIdx) => {
      html += `
        <tr>
          <td class="time-cell">${slotTime}</td>
      `

      mechanics.forEach(mech => {
        const cell = grid[mech.name][timeIdx]

        if (!cell) {
          // empty slot = available booking spot
          html += `
            <td
              class="schedule-slot"
              data-date="${day.iso}"
              data-mechanic="${mech.name}"
              data-time="${slotTime}"
            ></td>
          `
        } else if (cell.type === 'booking') {
          const b = cell.booking
          const serviceClass = SERVICE_CLASS_MAP[b.serviceType] || ''
          const label =
            b.customerLabel ||
            `${b.serviceType || ''}`.trim() ||
            'Booking'

          html += `
            <td
              class="schedule-slot"
              data-date="${day.iso}"
              data-mechanic="${mech.name}"
              data-time="${slotTime}"
              rowspan="${cell.rowSpan}"
            >
              <div
                class="booking-block ${serviceClass}"
                data-booking-id="${b.id}"
                title="${label}"
                draggable="true"
              >
                ${slotTime} • ${label}
              </div>
            </td>
          `
        } else if (cell.type === 'skip') {
          // Covered by rowspan above – no <td> for this mechanic in this row
        }
      })

      html += '</tr>'
    })

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `
  })

  scheduleGridContainer.innerHTML = html
  if (scheduleLoadingEl) scheduleLoadingEl.remove()

  attachGridHandlers()
  scrollToToday()
}

// ------------------ interaction handlers ------------------

let handlersAttached = false
// Global state to track the drag details (since dataTransfer is hidden in dragover)
let dragGhostState = null

function attachGridHandlers () {
  if (!scheduleGridContainer || handlersAttached) return
  handlersAttached = true

  // --- Helper: Clear all existing drop targets ---
  const clearDropTargets = () => {
    scheduleGridContainer.querySelectorAll('.drop-target').forEach(el => {
      el.classList.remove('drop-target')
    })
  }

  // Click handler (Unchanged)
  scheduleGridContainer.addEventListener('click', e => {
    const bookingBlock = e.target.closest('.booking-block')
    const slotCell = e.target.closest('.schedule-slot')

    if (bookingBlock) {
      const id = Number(bookingBlock.dataset.bookingId)
      const booking = bookings.find(b => b.id === id)
      if (booking) openBookingModal(booking)
      return
    }

    if (slotCell) {
      const { date, mechanic, time } = slotCell.dataset
      openBookingModal(null, { date, mechanic, startTime: time })
    }
  })

  // --- DRAG START ---
  scheduleGridContainer.addEventListener('dragstart', e => {
    const block = e.target.closest('.booking-block')
    if (!block) return

    const id = Number(block.dataset.bookingId)
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    // 1. Calculate how tall the block is (in slots)
    const span = Math.max(1, Math.round((booking.durationHours || 0.5) * 2))

    // 2. Calculate offset (where did we click inside the block?)
    const rect = block.getBoundingClientRect()
    const relY = (e.clientY - rect.top) / rect.height
    let offsetSlots = Math.round(relY * (span - 1))

    // Clamp offset to stay within bounds
    if (offsetSlots < 0) offsetSlots = 0
    if (offsetSlots > span - 1) offsetSlots = span - 1

    // 3. Save state globally for use in dragover
    dragGhostState = { id, span, offsetSlots, booking }

    const payload = { id, offsetSlots }
    e.dataTransfer.setData('text/plain', JSON.stringify(payload))
    e.dataTransfer.effectAllowed = 'move'
  })

  // --- DRAG END ---
  scheduleGridContainer.addEventListener('dragend', () => {
    clearDropTargets()
    dragGhostState = null
  })

  // --- DRAG OVER (The Ghost Logic) ---
  scheduleGridContainer.addEventListener('dragover', e => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'

    const slot = e.target.closest('.schedule-slot')

    // Safety check
    if (!slot || !dragGhostState) {
      clearDropTargets()
      return
    }

    // 1. Where is the mouse currently?
    const currentMechanic = slot.dataset.mechanic
    const currentDate = slot.dataset.date
    const dropIndex = TIME_SLOTS.indexOf(slot.dataset.time)

    if (dropIndex === -1) return

    // 2. Calculate the Start Time based on the mouse offset
    // (e.g., if holding the bottom of the block, start time is higher up)
    let startIndex = dropIndex - dragGhostState.offsetSlots
    if (startIndex < 0) startIndex = 0

    // 3. Clear previous shadows before drawing new ones
    clearDropTargets()

    // 4. Loop through the span and apply your CSS class
    for (let i = 0; i < dragGhostState.span; i++) {
      const timeIndex = startIndex + i

      // Stop if we run past the end of the day
      if (timeIndex >= TIME_SLOTS.length) break

      const timeStr = TIME_SLOTS[timeIndex]

      // Find the specific slot in the DOM
      const targetSlot = scheduleGridContainer.querySelector(
        `.schedule-slot[data-mechanic="${currentMechanic}"][data-date="${currentDate}"][data-time="${timeStr}"]`
      )

      if (targetSlot) {
        // Apply your existing CSS class
        targetSlot.classList.add('drop-target')
      }
    }
  })

  // --- DRAG LEAVE ---
  scheduleGridContainer.addEventListener('dragleave', e => {
    // Only clear if leaving the grid container entirely
    if (!scheduleGridContainer.contains(e.relatedTarget)) {
      clearDropTargets()
    }
  })

  // --- DROP ---
  scheduleGridContainer.addEventListener('drop', async e => {
    e.preventDefault()
    clearDropTargets()

    const slot = e.target.closest('.schedule-slot')
    if (!slot) return

    const raw = e.dataTransfer.getData('text/plain')
    if (!raw) return

    let payload
    try { payload = JSON.parse(raw) } catch { payload = { id: Number(raw), offsetSlots: 0 } }

    const id = Number(payload.id)
    const offsetSlots = Number(payload.offsetSlots || 0)
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    const dropIndex = TIME_SLOTS.indexOf(slot.dataset.time)
    if (dropIndex === -1) return

    let newStartIndex = dropIndex - offsetSlots
    if (newStartIndex < 0) newStartIndex = 0
    const newStartTime = TIME_SLOTS[newStartIndex]

    const updated = {
      ...booking,
      date: slot.dataset.date,
      mechanic: slot.dataset.mechanic,
      startTime: newStartTime
    }

    if (!fitsInDay(updated)) {
      showToast('Outside working hours.', 'danger')
      return
    }
    if (hasOverlap(updated, bookings)) {
      showToast('Overlaps with another job.', 'danger')
      return
    }

    const idx = bookings.findIndex(b => b.id === id)
    if (idx !== -1) {
      try {
        const saved = await api.updateWorkshopBooking(id, updated)
        bookings = bookings.map(b => (b.id === id ? saved : b))
        renderWeek()
        showToast('Booking moved', 'success')
      } catch (err) {
        console.error(err)
        showToast('Could not move booking (SharePoint error).', 'danger')
      }
    }
  })
}

function scrollToToday () {
  const container = document.getElementById('scheduleGridContainer')
  if (!container) return

  const today = new Date()
  const isoToday = formatDateISO(today)

  // Find matching column
  const th = container.querySelector(`th[data-date="${isoToday}"]`)
  if (!th) return

  // Scroll smoothly so this column is centered in the viewport
  th.scrollIntoView({
    behavior: 'smooth',
    block: 'nearest',
    inline: 'center'
  })
}

// ------------------ modal logic ------------------

function openBookingModal (booking, defaults = {}) {
  if (!bookingModal || !bookingForm) return

  bookingForm.reset()
  bookingIdInput.value = ''
  bookingDeleteBtn.classList.add('d-none')

  let dateVal = defaults.date || formatDateISO(new Date())
  let mechVal = defaults.mechanic || (mechanics[0] ? mechanics[0].name : '')
  let serviceTypeVal = ''
  let startTimeVal = defaults.startTime || '08:00'
  let customerVal = ''
  let notesVal = ''

  if (booking) {
    bookingIdInput.value = booking.id
    dateVal = booking.date
    mechVal = booking.mechanic
    serviceTypeVal = booking.serviceType || ''
    startTimeVal = booking.startTime || '08:00'
    customerVal = booking.customerLabel || ''
    notesVal = booking.notes || ''
    bookingDeleteBtn.classList.remove('d-none')
    bookingModalLabel.textContent = 'Edit booking'
  } else {
    bookingModalLabel.textContent = 'New booking'
  }

  bookingDateInput.value = dateVal
  bookingMechanicSelect.value = mechVal
  bookingServiceTypeSelect.value = serviceTypeVal
  bookingStartTimeSelect.value = startTimeVal
  bookingCustomerInput.value = customerVal
  bookingNotesInput.value = notesVal

  bookingModal.show()
}

// ------------------ form handlers ------------------

if (bookingForm) {
  bookingForm.addEventListener('submit', async e => {
    e.preventDefault()

    const idRaw = bookingIdInput.value
    const isEdit = !!idRaw
    const id = isEdit ? Number(idRaw) : undefined

    const serviceType = bookingServiceTypeSelect.value
    const durationHours = getDefaultDurationHours(serviceType)

    const booking = {
      id,
      date: bookingDateInput.value,
      mechanic: bookingMechanicSelect.value,
      serviceType,
      startTime: bookingStartTimeSelect.value,
      durationHours,
      customerLabel: bookingCustomerInput.value.trim(),
      notes: bookingNotesInput.value.trim()
    }

    if (!booking.date || !booking.mechanic || !booking.serviceType) {
      showToast('Please fill in date, mechanic and service type.', 'warning')
      return
    }

    if (hasOverlap(booking, bookings)) {
      showToast(
        'This booking overlaps an existing job for that mechanic on that day.',
        'danger'
      )
      return
    }

    try {
      if (isEdit) {
        const updated = await api.updateWorkshopBooking(id, booking)
        bookings = bookings.map(b => (b.id === id ? updated : b))
      } else {
        const created = await api.createWorkshopBooking(booking)
        bookings.push(created)
      }

      renderWeek()
      bookingModal.hide()
      showToast(isEdit ? 'Booking updated' : 'Booking created', 'success')
    } catch (err) {
      console.error(err)
      showToast('Could not save booking to SharePoint.', 'danger')
    }
  })
}

if (bookingDeleteBtn) {
  bookingDeleteBtn.addEventListener('click', async () => {
    const idRaw = bookingIdInput.value
    if (!idRaw) return
    const id = Number(idRaw)

    const confirmDelete = window.confirm('Delete this booking?')
    if (!confirmDelete) return

    try {
      await api.deleteWorkshopBooking(id)
      bookings = bookings.filter(b => b.id !== id)
      renderWeek()
      bookingModal.hide()
      showToast('Booking deleted', 'success')
    } catch (err) {
      console.error(err)
      showToast('Could not delete booking from SharePoint.', 'danger')
    }
  })
}

// ------------------ week nav ------------------

if (btnPrevWeek) {
  btnPrevWeek.addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, -7)
    renderWeek()
  })
}

if (btnNextWeek) {
  btnNextWeek.addEventListener('click', () => {
    currentWeekStart = addDays(currentWeekStart, 7)
    renderWeek()
  })
}

if (btnThisWeek) {
  btnThisWeek.addEventListener('click', () => {
    currentWeekStart = getMonday(new Date())
    renderWeek()
  })
}

if (btnNewBooking) {
  btnNewBooking.addEventListener('click', () => {
    openBookingModal(null, {
      date: formatDateISO(currentWeekStart),
      mechanic: mechanics[0] ? mechanics[0].name : '',
      startTime: '08:00'
    })
  })
}

// ------------------ initial load ------------------

async function init () {
  try {
    // Mechanics from the Salespeople list
    const employees = await api.getEmployees()

    // Only keep role === 'Mechanic' and write into the global array
    mechanics = employees
      .filter(e => e.role === 'Mechanic')
      .map(e => ({ id: e.id, name: e.name }))

    // Bookings from SharePoint
    bookings = await api.getWorkshopBookings()

    renderMechanicOptions()
    buildTimeOptions()
    renderWeek()
  } catch (err) {
    console.error(err)
    if (scheduleGridContainer) {
      scheduleGridContainer.innerHTML =
        "<p class='text-danger'>Unable to load workshop schedule. Please refresh.</p>"
    }
  }
}

init()
