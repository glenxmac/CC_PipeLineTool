/* global bootstrap */
// app.js

// import * as api from './api.mock.js' // later swap to ./api.sharepoint.js
import * as api from './api.sharepoint.js'

// ---- STATUS COLOUR MAPS ----
const STATUS_BADGE_CLASSES = {
  Enquiry: 'bg-secondary',
  Quote: 'bg-info text-dark',
  Approval: 'bg-warning text-dark',
  Committed: 'bg-primary',
  Invoiced: 'bg-success',
  Lost: 'bg-danger'
}

const STATUS_CARD_BORDER_CLASSES = {
  Enquiry: 'border-secondary',
  Quote: 'border-info',
  Approval: 'border-warning',
  Committed: 'border-primary',
  Invoiced: 'border-success',
  Lost: 'border-danger'
}

const URGENCY_COLORS = {
  Hot: 'bg-danger text-white',
  Warm: 'bg-warning text-dark',
  Cool: 'bg-info text-dark',
  'Long-term': 'bg-secondary'
}

const URGENCY_LEVELS = ['Hot', 'Warm', 'Cool']

const URGENCY_BADGE_CLASSES = {
  Hot: 'badge rounded-pill bg-danger',
  Warm: 'badge rounded-pill bg-secondary',
  Cool: 'badge rounded-pill bg-light text-dark border'
}

function renderUrgencyTag (urgency) {
  const cls = URGENCY_COLORS[urgency] || 'bg-secondary'
  return `<span class="badge ${cls}">${urgency}</span>`
}

const PIPELINE_STATUSES = ['Enquiry', 'Quote', 'Approval', 'Committed']

// function renderStatusBadge (status) {
//   const cls = STATUS_BADGE_CLASSES[status] || 'bg-secondary'
//   return `<span class="badge ${cls}">${status}</span>`
// }
// ---- DOM ELEMENTS ----

// Pipeline tab
const dealsTableBody = document.querySelector('#jobsTable tbody')
const salespersonFilter = document.querySelector('#employeeFilter')
const statusSummaryRow = document.querySelector('#summaryRow')

const newDealForm = document.getElementById('newJobForm')
const newDealModalEl = document.getElementById('newJobModal')
const btnShowNewDealModal = document.getElementById('btnShowNewJobModal')
const newDealModal = newDealModalEl ? new bootstrap.Modal(newDealModalEl) : null
const technicianSelect = document.getElementById('technicianSelect')
const existingNotesTextarea = document.getElementById('existingNotes')
const newNoteInput = document.getElementById('newNote')

// Summary tab
const summaryMonthInput = document.getElementById('summaryMonth')
const summaryContent = document.getElementById('summaryContent')
const monthlySummaryContainer = document.getElementById('monthlySummaryContainer')
const monthlyModeTabs = document.getElementById('monthlyModeTabs')

// ---- STATE ----
let allDeals = []
let allEmployees = []

let selectedStatusFilter = ''
let monthlyMode = 'Hot' // 'hot' | 'warm' | 'Cool'

// Closed Deals tab
const closedDealsTableBody = document.querySelector('#closedDealsTable tbody')
const closedMonthFilter = document.getElementById('closedMonthFilter')

const closeDealModalEl = document.getElementById('closeDealModal')
const closeDealModal = closeDealModalEl ? new bootstrap.Modal(closeDealModalEl) : null
const closeDealForm = document.getElementById('closeDealForm')
const closeDealIdInput = document.getElementById('closeDealId')
const closeDealSummary = document.getElementById('closeDealSummary')
const closeOutcomeSelect = document.getElementById('closeOutcome')
const closeDateInput = document.getElementById('closeDate')
const closeNotesInput = document.getElementById('closeNotes')
const reopenDealBtn = document.getElementById('reopenDealBtn')

const closedEmployeeFilter = document.getElementById('closedEmployeeFilter')
const closedStatusFilter = document.getElementById('closedStatusFilter')

// Employees tab
const employeeForm = document.getElementById('employeeForm')
const employeeNameInput = document.getElementById('employeeName')
const employeesTableBody = document.querySelector('#employeesTable tbody')

// ---- LOAD EVERYTHING ----

async function loadAll () {
  allEmployees = await api.getEmployees()
  allDeals = await api.getDeals()

  renderEmployeesUI()
  renderStatusSummary()
  renderDealsTable()
  renderWeeklySummary()
  renderMonthlySummary()
  renderClosedDealsTable()
}

// ---- EMPLOYEES UI ----

function renderEmployeesUI () {
  renderEmployeesTable()
  renderSalespersonFilter()
  renderTechnicianSelect()
  renderClosedEmployeeFilter()
}

function renderClosedEmployeeFilter () {
  if (!closedEmployeeFilter) return
  const names = allEmployees.map(e => e.name)

  closedEmployeeFilter.innerHTML =
    '<option value="">All salespeople</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('')
}

function formatCurrency (value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return ''
  return `R ${value.toFixed(2)}`
}

function shortenNotes (notes, maxLen = 40) {
  if (!notes) return ''
  const trimmed = notes.trim()
  if (trimmed.length <= maxLen) return trimmed
  return trimmed.slice(0, maxLen - 1) + '…'
}

function renderEmployeesTable () {
  if (!employeesTableBody) return

  employeesTableBody.innerHTML = allEmployees
    .map(emp => `
      <tr>
        <td>${emp.id}</td>
        <td>${emp.name}</td>
        <td>
          <span class="badge ${emp.role === 'Mechanic' ? 'bg-primary' : 'bg-secondary'}">
            ${emp.role}
          </span>
        </td>
      </tr>
    `)
    .join('')
}

function renderSalespersonFilter () {
  if (!salespersonFilter) return
  const names = allEmployees.map(e => e.name)

  salespersonFilter.innerHTML =
    '<option value="">All salespeople</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('')
}

function renderTechnicianSelect () {
  if (!technicianSelect) return
  const names = allEmployees.map(e => e.name)

  technicianSelect.innerHTML =
    '<option value="">Select salesperson</option>' +
    names.map(n => `<option value="${n}">${n}</option>`).join('')
}

// ---- PIPELINE TAB RENDERING ----

function renderStatusSummary () {
  if (!statusSummaryRow) return

  const byStatus = allDeals
    .filter(d => !d.closeDate) // only open deals in the top summary
    .reduce((acc, deal) => {
      const key = deal.status || 'Unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

  statusSummaryRow.innerHTML = Object.entries(byStatus)
    .map(([status, count]) => {
      const borderClass = STATUS_CARD_BORDER_CLASSES[status] || 'border-secondary'
      const isActive = selectedStatusFilter === status
      const activeClass = isActive ? 'bg-light border-3' : ''
      return `
        <div class="col-md-3 mb-2">
          <div class="card h-100 status-card ${borderClass} ${activeClass}"
               data-status="${status}"
               style="cursor:pointer">
            <div class="card-body py-2">
              <h6 class="card-title mb-1">${status}</h6>
              <p class="card-text mb-0 fw-bold">${count}</p>
            </div>
          </div>
        </div>
      `
    })
    .join('')
}

function renderDealsTable () {
  if (!dealsTableBody) return

  const selectedTech = salespersonFilter ? salespersonFilter.value : ''

  const openDeals = allDeals.filter(d => !d.closeDate)

  const filtered = openDeals.filter(d => {
    const matchesTech = selectedTech ? d.technician === selectedTech : true
    const matchesStatus = selectedStatusFilter ? d.status === selectedStatusFilter : true
    return matchesTech && matchesStatus
  })

  let rowsHtml = ''
  let totalValue = 0

  filtered.forEach(deal => {
    const openDateStr = deal.openDate
      ? new Date(deal.openDate).toLocaleDateString()
      : ''
    if (typeof deal.value === 'number') totalValue += deal.value

    const currentStatus = deal.status || 'Enquiry'
    const borderClass = STATUS_CARD_BORDER_CLASSES[currentStatus] || 'border-secondary'

    rowsHtml += `
        <tr data-id="${deal.id}" class="deal-row" style="cursor:pointer">
            <td>${deal.id}</td>
            <td>${deal.customer || ''}</td>
            <td>${deal.bike || ''}</td>
            <td>${deal.technician || ''}</td>

                    <!-- Status (inline editable) -->
            <td>
            <select
                class="form-select form-select-sm deal-status-select ${STATUS_CARD_BORDER_CLASSES[deal.status] || ''}"
                data-id="${deal.id}"
            >
                ${PIPELINE_STATUSES.map(
                s => `
                    <option value="${s}" ${s === (deal.status || 'Enquiry') ? 'selected' : ''}>
                    ${s}
                    </option>
                `
                ).join('')}
            </select>
            </td>

            <!-- Urgency (inline editable) -->
            <td>
            <select
                class="form-select form-select-sm deal-urgency-select"
                data-id="${deal.id}"
            >
                ${URGENCY_LEVELS.map(
                u => `
                    <option value="${u}" ${u === (deal.urgency || 'Warm') ? 'selected' : ''}>
                    ${u}
                    </option>
                `
                ).join('')}
            </select>
            </td>

            <td>${openDateStr}</td>
            <td>${formatCurrency(deal.value)}</td>
            <td>${shortenNotes(deal.notes)}</td>
            <td class="text-end">
            <button type="button"
                    class="btn btn-sm btn-outline-secondary btn-close-deal me-1">
                Close
            </button>
            <button type="button"
                    class="btn btn-sm btn-outline-danger btn-delete-deal">
                Delete
            </button>
            </td>
        </tr>
        `
  })

  // Total row: 10 cells total to match header
  rowsHtml += `
    <tr class="fw-bold table-light">
      <!-- ID .. Open date (7 columns) -->
      <td colspan="7" class="text-end">Total</td>
      <!-- Value -->
      <td>${formatCurrency(totalValue)}</td>
      <!-- Notes + Actions -->
      <td colspan="2"></td>
    </tr>
  `

  dealsTableBody.innerHTML = rowsHtml
}

function renderClosedDealsTable () {
  if (!closedDealsTableBody) return

  const monthFilter = closedMonthFilter ? closedMonthFilter.value : ''
  const selectedTech = closedEmployeeFilter ? closedEmployeeFilter.value : ''
  const selectedOutcome = closedStatusFilter ? closedStatusFilter.value : ''

  let closedDeals = allDeals.filter(d => d.closeDate)

  if (selectedTech) {
    closedDeals = closedDeals.filter(d => d.technician === selectedTech)
  }
  if (selectedOutcome) {
    closedDeals = closedDeals.filter(d => d.closedOutcome === selectedOutcome)
  }
  if (monthFilter) {
    closedDeals = closedDeals.filter(
      d => d.closeDate && d.closeDate.startsWith(monthFilter)
    )
  }

  let rowsHtml = ''
  let totalValue = 0

  closedDeals.forEach(deal => {
    const closeDateStr = deal.closeDate
      ? new Date(deal.closeDate).toLocaleDateString()
      : ''
    if (typeof deal.value === 'number') totalValue += deal.value

    const outcomeBadge =
      deal.closedOutcome === 'Invoiced'
        ? '<span class="badge bg-success">Invoiced</span>'
        : '<span class="badge bg-danger">Lost</span>'

    rowsHtml += `
    <tr data-id="${deal.id}" style="cursor:pointer">
        <td>${deal.id}</td>
        <td>${deal.customer || ''}</td>
        <td>${deal.bike || ''}</td>
        <td>${deal.technician || ''}</td>
        <td>${outcomeBadge}</td>
        <td>${closeDateStr}</td>
        <td>${formatCurrency(deal.value)}</td>
        <td>${shortenNotes(deal.notes)}</td>
    </tr>
    `
  })

  rowsHtml += `
        <tr class="fw-bold table-light">
            <td colspan="6" class="text-end">Total</td>
            <td>${formatCurrency(totalValue)}</td>
            <td></td>
        </tr>
        `

  closedDealsTableBody.innerHTML = rowsHtml
}

function openDealModalFor (deal) {
  // Reset form (clears inputs, including newNote)
  newDealForm.reset()

  const idInput = document.getElementById('dealId')
  const openDateInput = document.getElementById('openDateInput')
  const originalNotesInput = document.getElementById('originalNotes')
  const titleEl = document.getElementById('dealModalTitle')
  const submitBtn = document.getElementById('dealModalSubmitBtn')

  if (!deal) {
    // -------------------------
    // NEW DEAL
    // -------------------------
    idInput.value = ''
    originalNotesInput.value = ''

    if (existingNotesTextarea) existingNotesTextarea.value = ''
    if (newNoteInput) newNoteInput.value = ''

    // allow editing open date + default to today
    openDateInput.disabled = false
    openDateInput.value = new Date().toISOString().split('T')[0]

    titleEl.textContent = 'New Deal'
    submitBtn.textContent = 'Save'
  } else {
    // -------------------------
    // EDIT EXISTING DEAL
    // -------------------------
    idInput.value = deal.id

    newDealForm.customer.value = deal.customer
    newDealForm.bike.value = deal.bike
    newDealForm.technician.value = deal.technician
    newDealForm.status.value = deal.status
    newDealForm.value.value = deal.value ?? ''
    newDealForm.urgency.value = deal.urgency || 'Warm'

    // show full history as read-only
    if (existingNotesTextarea) existingNotesTextarea.value = deal.notes || ''
    // new update starts empty
    if (newNoteInput) newNoteInput.value = ''

    // store original notes (full history) for submit logic
    originalNotesInput.value = deal.notes || ''

    // disable open date editing
    openDateInput.disabled = true
    openDateInput.value = deal.openDate || ''

    titleEl.textContent = 'Edit Deal'
    submitBtn.textContent = 'Update'
  }

  newDealModal.show()
}

// ---- WEEKLY SUMMARY ----

function getIsoWeek (dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null

  const target = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  return weekNo
}

function buildWeeklySummary (deals, monthFilterStr) {
  const filtered = monthFilterStr
    ? deals.filter(d => {
      if (!d.openDate) return false
      const dealMonth = getMonthKeyFromDate(d.openDate) // -> "YYYY-MM"
      return dealMonth === monthFilterStr
    })
    : deals

  const matrix = {}
  const weekSet = new Set()

  filtered.forEach(deal => {
    const week = getIsoWeek(deal.openDate)
    if (!week) return

    weekSet.add(week)
    const salesperson = deal.technician || 'Unknown'
    if (!matrix[salesperson]) matrix[salesperson] = {}
    matrix[salesperson][week] = (matrix[salesperson][week] || 0) + 1
  })

  const weeks = Array.from(weekSet).sort((a, b) => a - b)
  return { matrix, weeks }
}

function renderWeeklySummary () {
  if (!summaryContent) return

  const monthFilter = summaryMonthInput ? summaryMonthInput.value : ''
  const { matrix, weeks } = buildWeeklySummary(allDeals, monthFilter)

  if (!weeks.length) {
    summaryContent.innerHTML =
      "<p class='text-muted'>No deals for this period.</p>"
    return
  }

  const headerRow =
    '<tr><th>Salesperson</th>' +
    weeks.map(w => `<th>Week ${w}</th>`).join('') +
    '<th>Grand total</th></tr>'

  const bodyRows = Object.entries(matrix)
    .map(([salesperson, byWeek]) => {
      let rowTotal = 0
      const cells = weeks.map(week => {
        const count = byWeek[week] || 0
        rowTotal += count
        return `<td>${count || ''}</td>`
      })
      return `<tr><td>${salesperson}</td>${cells.join('')}<td>${rowTotal}</td></tr>`
    })
    .join('')

  const grandTotalsByWeek = weeks.map(week => {
    let sum = 0
    Object.values(matrix).forEach(byWeek => {
      sum += byWeek[week] || 0
    })
    return `<td>${sum || ''}</td>`
  })

  const grandTotalAll = Object.values(matrix).reduce(
    (acc, byWeek) =>
      acc + Object.values(byWeek).reduce((s, c) => s + c, 0),
    0
  )

  const grandRow = `
    <tr class="fw-bold">
      <td>Grand total</td>
      ${grandTotalsByWeek.join('')}
      <td>${grandTotalAll}</td>
    </tr>
  `

  summaryContent.innerHTML = `
    <div class="table-responsive">
      <table class="table table-bordered table-sm">
        <thead class="table-light">
          ${headerRow}
        </thead>
        <tbody>
          ${bodyRows}
          ${grandRow}
        </tbody>
      </table>
    </div>
  `
}

function getMonthKeyFromDate (dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}` // e.g. "2025-11"
}

function getCurrentMonthKey () {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// fixed status order for snapshot
const FIXED_STATUSES = ['Enquiry', 'Quote', 'Approval', 'Committed']

function renderMonthlySummary () {
  if (!monthlySummaryContainer) return

  const baseMonth = getCurrentMonthKey()

  // -------------- HOT MODE: current month + HOT pipeline + closed --------------
  if (monthlyMode === 'Hot') {
    // HOT open deals in the selected month
    const openDeals = allDeals.filter(d => {
      if (d.closeDate) return false

      const urg = (d.urgency || 'Hot')
      return urg === 'Hot'
    })

    // Closed this month (Lost / Invoiced in the selected month)
    let closedForMonth = allDeals.filter(d => d.closeDate)
    closedForMonth = closedForMonth.filter(d => {
      if (!d.closeDate) return false
      const closeMonth = getMonthKeyFromDate(d.closeDate)
      return closeMonth === baseMonth
    })

    const summary = {} // name -> { statusValues, lostCount, lostValue, invoicedCount, invoicedValue }

    function ensurePerson (name) {
      if (!summary[name]) {
        summary[name] = {
          statusValues: {
            Enquiry: { count: 0, value: 0 },
            Quote: { count: 0, value: 0 },
            Approval: { count: 0, value: 0 },
            Committed: { count: 0, value: 0 }
          },
          lostCount: 0,
          lostValue: 0,
          invoicedCount: 0,
          invoicedValue: 0
        }
      }
    }

    // Open HOT deals: accumulate value per status
    openDeals.forEach(deal => {
      const name = deal.technician || 'Unknown'
      ensurePerson(name)

      const st = FIXED_STATUSES.includes(deal.status) ? deal.status : null
      const val = typeof deal.value === 'number' ? deal.value : 0

      if (st) {
        summary[name].statusValues[st].count += 1
        summary[name].statusValues[st].value += val
      }
    })

    // Closed this month: Lost / Invoiced (regardless of urgency)
    closedForMonth.forEach(deal => {
      const name = deal.technician || 'Unknown'
      ensurePerson(name)
      const val = typeof deal.value === 'number' ? deal.value : 0

      if (deal.closedOutcome === 'Lost') {
        summary[name].lostCount += 1
        summary[name].lostValue += val
      } else if (deal.closedOutcome === 'Invoiced') {
        summary[name].invoicedCount += 1
        summary[name].invoicedValue += val
      }
    })

    const salespeople = Object.keys(summary).sort()
    if (salespeople.length === 0) {
      monthlySummaryContainer.innerHTML =
        "<p class='text-muted'>No Hot deals for this month.</p>"
      return
    }

    // Grand totals
    const grandStatusTotals = {
      Enquiry: { count: 0, value: 0 },
      Quote: { count: 0, value: 0 },
      Approval: { count: 0, value: 0 },
      Committed: { count: 0, value: 0 }
    }
    let grandLostCount = 0
    let grandLostValue = 0
    let grandInvCount = 0
    let grandInvValue = 0

    const statusHeaders = FIXED_STATUSES
      .map(
        st => `
        <th class="text-center">
          <span class="status-tag status-${st}"></span>${st}
        </th>
      `
      )
      .join('')

    const header = `
      <h5 class="mb-3">Monthly snapshot – Hot (this month)</h5>
      <div class="table-responsive">
        <table class="table table-bordered table-sm">
          <thead class="table-light">
            <tr>
              <th>Salesperson</th>
              ${statusHeaders}
              <th class="text-center">
                <span class="status-tag status-Lost"></span>Lost (this month)
              </th>
              <th class="text-center">
                <span class="status-tag status-Invoiced"></span>Invoiced (this month)
              </th>
            </tr>
          </thead>
          <tbody>
    `

    let rows = ''

    salespeople.forEach(name => {
      const s = summary[name]

      FIXED_STATUSES.forEach(st => {
        grandStatusTotals[st].count += s.statusValues[st].count
        grandStatusTotals[st].value += s.statusValues[st].value
      })

      grandLostCount += s.lostCount
      grandLostValue += s.lostValue
      grandInvCount += s.invoicedCount
      grandInvValue += s.invoicedValue

      const statusCells = FIXED_STATUSES
        .map(st => {
          const cell = s.statusValues[st]
          return cell.value
            ? `<td class="text-end">
                 ${formatCurrency(cell.value)}
                 <div class="small text-muted">(${cell.count})</div>
               </td>`
            : '<td></td>'
        })
        .join('')

      rows += `
        <tr>
          <td>${name}</td>
          ${statusCells}
          <td class="text-end">
            ${s.lostValue ? formatCurrency(s.lostValue) : ''}
            ${s.lostCount ? `<div class="small text-muted">(${s.lostCount})</div>` : ''}
          </td>
          <td class="text-end">
            ${s.invoicedValue ? formatCurrency(s.invoicedValue) : ''}
            ${
              s.invoicedCount
                ? `<div class="small text-muted">(${s.invoicedCount})</div>`
                : ''
            }
          </td>
        </tr>
      `
    })

    const grandCells = FIXED_STATUSES
      .map(st => {
        const g = grandStatusTotals[st]
        return g.value
          ? `<td class="fw-bold text-end">
               ${formatCurrency(g.value)}
               <div class="small text-muted">(${g.count})</div>
             </td>`
          : '<td></td>'
      })
      .join('')

    const footer = `
        <tr class="fw-bold">
          <td>Grand total</td>
          ${grandCells}
          <td class="text-end">
            ${grandLostValue ? formatCurrency(grandLostValue) : ''}
            ${grandLostCount ? `<div class="small text-muted">(${grandLostCount})</div>` : ''}
          </td>
          <td class="text-end">
            ${grandInvValue ? formatCurrency(grandInvValue) : ''}
            ${grandInvCount ? `<div class="small text-muted">(${grandInvCount})</div>` : ''}
          </td>
        </tr>
          </tbody>
        </table>
      </div>
    `

    monthlySummaryContainer.innerHTML = header + rows + footer
    return
  }

  // -------------- WARM / COOL MODES: PIPELINE BY URGENCY --------------
  const targetUrgency = monthlyMode === 'Warm' ? 'Warm' : 'Cool'

  // All open deals with this urgency, regardless of month
  const futureDeals = allDeals.filter(d => {
    if (d.closeDate) return false
    const urg = d.urgency || ''
    return urg === targetUrgency
  })

  if (!futureDeals.length) {
    monthlySummaryContainer.innerHTML =
    `<p class='text-muted'>No ${targetUrgency} pipeline deals found.</p>`
    return
  }

  const summary = {} // name -> { statusValues }

  function ensureFuturePerson (name) {
    if (!summary[name]) {
      summary[name] = {
        Enquiry: { count: 0, value: 0 },
        Quote: { count: 0, value: 0 },
        Approval: { count: 0, value: 0 },
        Committed: { count: 0, value: 0 }
      }
    }
  }

  futureDeals.forEach(deal => {
    const name = deal.technician || 'Unknown'
    ensureFuturePerson(name)

    const st = FIXED_STATUSES.includes(deal.status) ? deal.status : null
    const val = typeof deal.value === 'number' ? deal.value : 0

    if (st) {
      summary[name][st].count += 1
      summary[name][st].value += val
    }
  })

  const salespeople = Object.keys(summary).sort()
  const grandStatusTotals = {
    Enquiry: { count: 0, value: 0 },
    Quote: { count: 0, value: 0 },
    Approval: { count: 0, value: 0 },
    Committed: { count: 0, value: 0 }
  }

  const statusHeaders = FIXED_STATUSES
    .map(
      st => `
      <th class="text-center">
        <span class="status-tag status-${st}"></span>${st}
      </th>
    `
    )
    .join('')

  const header = `
  <h5 class="mb-3">
    Pipeline – ${targetUrgency} deals (all open)
  </h5>
  <div class="table-responsive">
    <table class="table table-bordered table-sm">
      <thead class="table-light">
        <tr>
          <th>Salesperson</th>
          ${statusHeaders}
        </tr>
      </thead>
      <tbody>
`

  let rows = ''

  salespeople.forEach(name => {
    const s = summary[name]

    FIXED_STATUSES.forEach(st => {
      grandStatusTotals[st].count += s[st].count
      grandStatusTotals[st].value += s[st].value
    })

    const statusCells = FIXED_STATUSES
      .map(st => {
        const cell = s[st]
        return cell.value
          ? `<td class="text-end">
             ${formatCurrency(cell.value)}
             <div class="small text-muted">(${cell.count})</div>
           </td>`
          : '<td></td>'
      })
      .join('')

    rows += `
    <tr>
      <td>${name}</td>
      ${statusCells}
    </tr>
  `
  })

  const grandCells = FIXED_STATUSES
    .map(st => {
      const g = grandStatusTotals[st]
      return g.value
        ? `<td class="fw-bold text-end">
           ${formatCurrency(g.value)}
           <div class="small text-muted">(${g.count})</div>
         </td>`
        : '<td></td>'
    })
    .join('')

  const footer = `
    <tr class="fw-bold">
      <td>Grand total</td>
      ${grandCells}
    </tr>
      </tbody>
    </table>
  </div>
`

  monthlySummaryContainer.innerHTML = header + rows + footer
}

function showToast (message, type = 'info') {
  // type: 'success', 'danger', 'warning', 'info'
  const toastId = `toast-${Date.now()}`

  const bgClass = {
    success: 'bg-success text-white',
    danger: 'bg-danger text-white',
    warning: 'bg-warning text-dark',
    info: 'bg-primary text-white'
  }[type] || 'bg-secondary text-white'

  const container = document.getElementById('toastContainer')

  container.insertAdjacentHTML(
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
  const toast = new bootstrap.Toast(toastElem, { delay: 3000 })
  toast.show()
}

// ---- EVENT HANDLERS ----

// Filter by salesperson
if (salespersonFilter) {
  salespersonFilter.addEventListener('change', renderDealsTable)
}

// Click on status cards to filter by status (toggle)
if (statusSummaryRow) {
  statusSummaryRow.addEventListener('click', e => {
    const card = e.target.closest('.status-card')
    if (!card) return
    const status = card.dataset.status

    // toggle behaviour: click again to clear
    if (selectedStatusFilter === status) {
      selectedStatusFilter = ''
    } else {
      selectedStatusFilter = status
    }

    renderStatusSummary() // refresh highlighting
    renderDealsTable() // refresh table
  })
}

if (btnShowNewDealModal && newDealModal) {
  btnShowNewDealModal.addEventListener('click', () => {
    openDealModalFor(null) // new deal
  })
}

// Create new deal
if (newDealForm) {
  newDealForm.addEventListener('submit', async e => {
    e.preventDefault()

    const formData = new FormData(newDealForm)
    const id = formData.get('id')

    const newUpdate = (formData.get('notes') || '').trim() // only the new text
    const originalNotes = (formData.get('originalNotes') || '').trim() // full history

    const today = new Date().toISOString().split('T')[0]

    let notesToSave = originalNotes

    if (!id) {
    // NEW DEAL
      if (newUpdate) {
        notesToSave = `${today} – ${newUpdate}`
      } else {
        notesToSave = ''
      }
    } else {
    // EDIT EXISTING DEAL
      if (newUpdate) {
        notesToSave = originalNotes
          ? `${today} – ${newUpdate}\n${originalNotes}`
          : `${today} – ${newUpdate}`
      }
    // if no newUpdate, notesToSave stays as originalNotes
    }

    if (!id) {
      await api.createDeal({
        customer: formData.get('customer'),
        bike: formData.get('bike'),
        technician: formData.get('technician'),
        status: formData.get('status'),
        openDate: formData.get('openDate'),
        value: formData.get('value') ? Number(formData.get('value')) : null,
        notes: notesToSave,
        urgency: formData.get('urgency')
      })
    } else {
      await api.updateDeal(Number(id), {
        customer: formData.get('customer'),
        bike: formData.get('bike'),
        technician: formData.get('technician'),
        status: formData.get('status'),
        value: formData.get('value') ? Number(formData.get('value')) : null,
        notes: notesToSave,
        urgency: formData.get('urgency')
      })
    }

    await loadAll()
    newDealModal.hide()
  })
}

// --- INLINE STATUS SELECT HANDLER (NEW) ---
// --- INLINE STATUS & URGENCY HANDLER ---
if (dealsTableBody) {
  dealsTableBody.addEventListener('change', async e => {
    const statusSelect = e.target.closest('.deal-status-select')
    const urgencySelect = e.target.closest('.deal-urgency-select')

    // If the change wasn’t on either select, ignore
    if (!statusSelect && !urgencySelect) return

    const source = statusSelect || urgencySelect
    const id = Number(source.dataset.id)

    const patch = {}
    if (statusSelect) patch.status = statusSelect.value
    if (urgencySelect) patch.urgency = urgencySelect.value

    try {
      await api.updateDeal(id, patch)
      await loadAll()
      showToast('Deal updated', 'success')
    } catch (err) {
      console.error(err)
      showToast('Unable to update deal — please try again.', 'danger')
    }
  })
}

// Quick status button
if (dealsTableBody) {
  dealsTableBody.addEventListener('click', async e => {
    const row = e.target.closest('tr[data-id]')
    if (!row) return
    const id = Number(row.dataset.id)
    const deal = allDeals.find(d => d.id === id)
    if (!deal) return

    // 🚫 If click was on one of the inline selects, do NOT open the modal
    if (
      e.target.closest('.deal-status-select') ||
      e.target.closest('.deal-urgency-select')
    ) {
      return
    }

    // Delete button
    const deleteBtn = e.target.closest('.btn-delete-deal')
    if (deleteBtn) {
      const confirmDelete = window.confirm(
        `Delete deal #${deal.id} for ${deal.customer}?`
      )
      if (!confirmDelete) return
      await api.deleteDeal(id)
      await loadAll()
      return
    }

    // Close button
    const closeBtn = e.target.closest('.btn-close-deal')
    if (closeBtn) {
      if (!closeDealModal) return

      closeDealIdInput.value = deal.id
      closeOutcomeSelect.value = deal.closedOutcome || 'Invoiced'
      closeDateInput.value =
        deal.closeDate || new Date().toISOString().slice(0, 10)
      closeNotesInput.value = deal.notes || ''
      closeDealSummary.textContent =
        `${deal.customer} – ${deal.bike} (${deal.technician})`

      closeDealModal.show()
      return
    }

    // Otherwise: row click → edit
    openDealModalFor(deal)
  })
}

if (closeDealForm) {
  closeDealForm.addEventListener('submit', async e => {
    e.preventDefault()
    const id = Number(closeDealIdInput.value)
    if (!id) return

    const outcome = closeOutcomeSelect.value // 'Successful' or 'Lost'
    const closeDate = closeDateInput.value
    const extraNotes = closeNotesInput.value.trim()

    const deal = allDeals.find(d => d.id === id)

    await api.updateDeal(id, {
      closeDate,
      closedOutcome: outcome,
      status: outcome === 'Invoiced' ? 'Invoiced' : 'Lost',
      notes: extraNotes || deal.notes // keep old notes if empty
    })

    await loadAll()
    if (closeDealModal) closeDealModal.hide()
  })
}

if (closedDealsTableBody && closeDealModal) {
  closedDealsTableBody.addEventListener('click', e => {
    const row = e.target.closest('tr[data-id]')
    if (!row) return
    const id = Number(row.dataset.id)
    const deal = allDeals.find(d => d.id === id)
    if (!deal) return

    // Pre-fill close modal
    closeDealIdInput.value = deal.id
    closeOutcomeSelect.value = deal.closedOutcome || 'Invoiced'
    closeDateInput.value =
      deal.closeDate || new Date().toISOString().slice(0, 10)
    closeNotesInput.value = deal.notes || ''
    closeDealSummary.textContent =
      `${deal.customer} – ${deal.bike} (${deal.technician})`

    closeDealModal.show()
  })
}

if (closedEmployeeFilter) {
  closedEmployeeFilter.addEventListener('change', renderClosedDealsTable)
}
if (closedStatusFilter) {
  closedStatusFilter.addEventListener('change', renderClosedDealsTable)
}
if (closedMonthFilter) {
  closedMonthFilter.addEventListener('change', renderClosedDealsTable)
}

if (reopenDealBtn) {
  reopenDealBtn.addEventListener('click', async () => {
    const id = Number(closeDealIdInput.value)
    if (!id) return
    const deal = allDeals.find(d => d.id === id)
    if (!deal) return

    await api.updateDeal(id, {
      closeDate: null,
      closedOutcome: null,
      // put it back into an "open" stage
      status:
        deal.status === 'Lost' || deal.status === 'Invoiced'
          ? 'Enquiry'
          : deal.status
    })

    await loadAll()
    if (closeDealModal) closeDealModal.hide()
  })
}

// Employees tab: add salesperson
if (employeeForm && employeeNameInput) {
  employeeForm.addEventListener('submit', async e => {
    e.preventDefault()
    const name = employeeNameInput.value.trim()
    if (!name) return
    await api.createEmployee(name)
    allEmployees = await api.getEmployees()
    renderEmployeesUI()
    employeeForm.reset()
  })
}

// Month filter in summary tab
if (summaryMonthInput) {
  summaryMonthInput.addEventListener('change', () => {
    renderWeeklySummary()
  })
}

if (monthlyModeTabs) {
  monthlyModeTabs.addEventListener('click', e => {
    const btn = e.target.closest('button[data-mode]')
    if (!btn) return

    monthlyMode = btn.dataset.mode // 'hot' | 'warm' | 'Cool'

    // toggle active class
    monthlyModeTabs
      .querySelectorAll('button[data-mode]')
      .forEach(b => b.classList.toggle('active', b === btn))

    renderMonthlySummary()
  })
}

// ---- INITIAL LOAD ----
loadAll().catch(err => console.error(err))
