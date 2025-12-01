// schedule.js
// Workshop schedule (front-end only, localStorage storage for now)
/* global bootstrap */

// For now, use the mock API. Later you can swap back to sharepoint:
// import * as api from './api.sharepoint.js'
import * as api from './api.mock.js'

// ------------------ state ------------------

let mechanics = [] // [{ id, name }]
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

// ------------------ local storage helpers ------------------

const STORAGE_KEY = 'cc_workshop_bookings_v1'

function loadBookingsFromStorage () {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch (e) {
    console.error('Failed to read bookings from storage', e)
    return []
  }
}

function saveBookingsToStorage () {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings))
  } catch (e) {
    console.error('Failed to save bookings to storage', e)
  }
}

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
}

// ------------------ interaction handlers ------------------

let handlersAttached = false

function attachGridHandlers () {
  if (!scheduleGridContainer || handlersAttached) return
  handlersAttached = true

  // Click handler for slots and booking blocks
  scheduleGridContainer.addEventListener('click', e => {
    const bookingBlock = e.target.closest('.booking-block')
    const slotCell = e.target.closest('.schedule-slot')

    if (bookingBlock) {
      const id = Number(bookingBlock.dataset.bookingId)
      const booking = bookings.find(b => b.id === id)
      if (booking) {
        openBookingModal(booking)
      }
      return
    }

    if (slotCell) {
      const date = slotCell.dataset.date
      const mechanic = slotCell.dataset.mechanic
      const time = slotCell.dataset.time
      openBookingModal(null, { date, mechanic, startTime: time })
    }
  })

  // Drag start
  scheduleGridContainer.addEventListener('dragstart', e => {
    const block = e.target.closest('.booking-block')
    if (!block) return
    e.dataTransfer.setData('text/plain', block.dataset.bookingId)
    e.dataTransfer.effectAllowed = 'move'
  })

  // Drag over / leave / drop on slots
  scheduleGridContainer.addEventListener('dragover', e => {
    const slot = e.target.closest('.schedule-slot')
    if (!slot) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    slot.classList.add('drop-target')
  })

  scheduleGridContainer.addEventListener('dragleave', e => {
    const slot = e.target.closest('.schedule-slot')
    if (!slot) return
    slot.classList.remove('drop-target')
  })

  scheduleGridContainer.addEventListener('drop', e => {
    const slot = e.target.closest('.schedule-slot')
    if (!slot) return
    e.preventDefault()
    slot.classList.remove('drop-target')

    const idStr = e.dataTransfer.getData('text/plain')
    if (!idStr) return
    const id = Number(idStr)
    const booking = bookings.find(b => b.id === id)
    if (!booking) return

    const newDate = slot.dataset.date
    const newMechanic = slot.dataset.mechanic
    const newTime = slot.dataset.time

    const updated = {
      ...booking,
      date: newDate,
      mechanic: newMechanic,
      startTime: newTime
    }

    if (hasOverlap(updated, bookings)) {
      showToast('Cannot move booking – overlaps with another job.', 'danger')
      return
    }

    const idx = bookings.findIndex(b => b.id === id)
    if (idx !== -1) {
      bookings[idx] = updated
      saveBookingsToStorage()
      renderWeek()
      showToast('Booking moved', 'success')
    }
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
  bookingForm.addEventListener('submit', e => {
    e.preventDefault()

    const idRaw = bookingIdInput.value
    const isEdit = !!idRaw
    const id = isEdit ? Number(idRaw) : Date.now()

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

    if (!booking.date || !booking.mechanic || !booking.serviceType || !booking.startTime) {
      showToast('Please fill in date, mechanic, service type and start time.', 'warning')
      return
    }

    if (hasOverlap(booking, bookings)) {
      showToast(
        'This booking overlaps an existing job for that mechanic on that day.',
        'danger'
      )
      return
    }

    if (isEdit) {
      const idx = bookings.findIndex(b => b.id === id)
      if (idx !== -1) {
        bookings[idx] = booking
      }
    } else {
      bookings.push(booking)
    }

    saveBookingsToStorage()
    renderWeek()
    bookingModal.hide()
    showToast(isEdit ? 'Booking updated' : 'Booking created', 'success')
  })
}

if (bookingDeleteBtn) {
  bookingDeleteBtn.addEventListener('click', () => {
    const idRaw = bookingIdInput.value
    if (!idRaw) return
    const id = Number(idRaw)
    const confirmDelete = window.confirm('Delete this booking?')
    if (!confirmDelete) return

    bookings = bookings.filter(b => b.id !== id)
    saveBookingsToStorage()
    renderWeek()
    bookingModal.hide()
    showToast('Booking deleted', 'success')
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
    const employees = await api.getEmployees()
    mechanics = employees.map(e => ({ id: e.id, name: e.name }))

    bookings = loadBookingsFromStorage()

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
