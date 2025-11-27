/* global bootstrap */
// app.js

import * as api from './api.mock.js' // later swap to ./api.sharepoint.js

// ---- STATUS COLOUR MAPS ----
const STATUS_BADGE_CLASSES = {
  Enquire: 'bg-secondary',
  Quote: 'bg-info text-dark',
  Approval: 'bg-warning text-dark',
  Committed: 'bg-primary',
  Delivered: 'bg-success',
  Lost: 'bg-danger'
}

const STATUS_CARD_BORDER_CLASSES = {
  Enquiry: 'border-secondary',
  Quote: 'border-info',
  Approval: 'border-warning',
  Committed: 'border-primary',
  Delivered: 'border-success',
  Lost: 'border-danger'
}

function renderStatusBadge (status) {
  const cls = STATUS_BADGE_CLASSES[status] || 'bg-secondary'
  return `<span class="badge ${cls}">${status}</span>`
}

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
const dealModalTitle = document.getElementById('dealModalTitle')
const dealModalSubmitBtn = document.getElementById('dealModalSubmitBtn')
const dealIdInput = document.getElementById('dealId')

// Summary tab
const summaryMonthInput = document.getElementById('summaryMonth')
const summaryContent = document.getElementById('summaryContent')

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

// ---- STATE ----
let allDeals = []
let allEmployees = []

// currently selected status filter from the cards ("" = all)
let selectedStatusFilter = ''

// ---- LOAD EVERYTHING ----

async function loadAll () {
  allEmployees = await api.getEmployees()
  allDeals = await api.getDeals()

  renderEmployeesUI()
  renderStatusSummary()
  renderDealsTable()
  renderWeeklySummary()
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
    .filter(d => !d.closedDate) // only open deals in the top summary
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

  const openDeals = allDeals.filter(d => !d.closedDate)

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

    rowsHtml += `
      <tr data-id="${deal.id}" class="deal-row" style="cursor:pointer">
        <td>${deal.id}</td>
        <td>${deal.customer || ''}</td>
        <td>${deal.bike || ''}</td>
        <td>${deal.technician || ''}</td>
        <td>${renderStatusBadge(deal.status || '')}</td>
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

  // Total row: 9 cells total to match header
  rowsHtml += `
    <tr class="fw-bold table-light">
      <!-- ID .. Open date (6 columns) -->
      <td colspan="6" class="text-end">Total</td>
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

  let closedDeals = allDeals.filter(d => d.closedDate)

  if (selectedTech) {
    closedDeals = closedDeals.filter(d => d.technician === selectedTech)
  }
  if (selectedOutcome) {
    closedDeals = closedDeals.filter(d => d.closedOutcome === selectedOutcome)
  }
  if (monthFilter) {
    closedDeals = closedDeals.filter(
      d => d.closedDate && d.closedDate.startsWith(monthFilter)
    )
  }

  let rowsHtml = ''
  let totalValue = 0

  closedDeals.forEach(deal => {
    const closedDateStr = deal.closedDate
      ? new Date(deal.closedDate).toLocaleDateString()
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
        <td>${closedDateStr}</td>
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
  if (!newDealModal || !newDealForm) return

  renderTechnicianSelect()

  if (deal) {
    // EDIT
    dealModalTitle.textContent = `Edit Deal #${deal.id}`
    dealModalSubmitBtn.textContent = 'Update'
    dealIdInput.value = deal.id

    newDealForm.elements.customer.value = deal.customer || ''
    newDealForm.elements.bike.value = deal.bike || ''
    newDealForm.elements.technician.value = deal.technician || ''
    newDealForm.elements.status.value = deal.status || 'Interested'
    newDealForm.elements.openDate.value = deal.openDate || ''
    newDealForm.elements.value.value =
      typeof deal.value === 'number' ? deal.value : ''
    newDealForm.elements.notes.value = deal.notes || ''
  } else {
    // NEW
    dealModalTitle.textContent = 'New Deal'
    dealModalSubmitBtn.textContent = 'Save'
    dealIdInput.value = ''
    newDealForm.reset()

    const today = new Date().toISOString().slice(0, 10)
    if (newDealForm.elements.openDate) {
      newDealForm.elements.openDate.value = today
    }
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
    ? deals.filter(d => d.openDate && d.openDate.startsWith(monthFilterStr))
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
    const idStr = formData.get('id')
    const payload = {
      customer: formData.get('customer'),
      bike: formData.get('bike'),
      technician: formData.get('technician'),
      status: formData.get('status'),
      openDate: formData.get('openDate') || null,
      value: formData.get('value') ? Number(formData.get('value')) : null,
      notes: formData.get('notes') || ''
    }

    if (idStr) {
      // edit existing
      const id = Number(idStr)
      await api.updateDeal(id, payload)
    } else {
      // new
      await api.createDeal(payload)
    }

    await loadAll()
    if (newDealModal) newDealModal.hide()
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
        deal.closedDate || new Date().toISOString().slice(0, 10)
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
    const closedDate = closeDateInput.value
    const extraNotes = closeNotesInput.value.trim()

    const deal = allDeals.find(d => d.id === id)

    await api.updateDeal(id, {
      closedDate,
      closedOutcome: outcome,
      status: outcome === 'Invoiced' ? 'Invoiced' : 'Lost',
      notes: extraNotes || deal.notes // keep old notes if empty
    })

    await loadAll()
    if (closeDealModal) closeDealModal.hide()
  })
}

if (closedMonthFilter) {
  closedMonthFilter.addEventListener('change', renderClosedDealsTable)
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
      deal.closedDate || new Date().toISOString().slice(0, 10)
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
      closedDate: null,
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
  summaryMonthInput.addEventListener('change', renderWeeklySummary)
}

// ---- INITIAL LOAD ----
loadAll().catch(err => console.error(err))
