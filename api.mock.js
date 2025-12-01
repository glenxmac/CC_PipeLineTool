// api.mock.js
// Simple in-memory mock API for pipeline + workshop schedule

// --------- MOCK DATA ---------

const EMPLOYEES = [
  { id: 1, name: 'Brian' },
  { id: 2, name: 'Sibs' },
  { id: 3, name: 'Dallas' },
  { id: 4, name: 'Bongs' }
]

let DEALS = [
  {
    id: 1,
    customer: 'John Plant',
    bike: 'Epic',
    technician: 'Brian',
    status: 'Enquiry',
    openDate: '2025-11-17',
    value: 100000,
    notes: 'Example mock deal',
    closeDate: null,
    closedOutcome: null,
    urgency: 'Hot'
  }
]

// Simple auto-increment IDs
let nextDealId = DEALS.length ? Math.max(...DEALS.map(d => d.id)) + 1 : 1
let nextEmployeeId = EMPLOYEES.length ? Math.max(...EMPLOYEES.map(e => e.id)) + 1 : 1

// Small helper to simulate async calls
function delay (ms = 50) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// --------- DEALS (Pipeline) ---------

export async function getDeals () {
  await delay()
  // return a shallow copy
  return DEALS.map(d => ({ ...d }))
}

export async function createDeal (newDeal) {
  await delay()
  const deal = {
    id: nextDealId++,
    customer: newDeal.customer || '',
    bike: newDeal.bike || '',
    technician: newDeal.technician || '',
    status: newDeal.status || 'Enquiry',
    openDate: newDeal.openDate || new Date().toISOString().split('T')[0],
    value:
      typeof newDeal.value === 'number'
        ? newDeal.value
        : newDeal.value
          ? Number(newDeal.value)
          : null,
    notes: newDeal.notes || '',
    closeDate: newDeal.closeDate || null,
    closedOutcome: newDeal.closedOutcome || null,
    urgency: newDeal.urgency || 'Warm'
  }
  DEALS.push(deal)
  return { ...deal }
}

export async function updateDeal (id, partial) {
  await delay()
  const idx = DEALS.findIndex(d => d.id === id)
  if (idx === -1) throw new Error('Deal not found')

  DEALS[idx] = { ...DEALS[idx], ...partial }
  return { ...DEALS[idx] }
}

export async function deleteDeal (id) {
  await delay()
  DEALS = DEALS.filter(d => d.id !== id)
}

// --------- EMPLOYEES (Salespeople / Mechanics) ---------

// This is what schedule.js uses
export async function getEmployees () {
  await delay()
  // pipeline + schedule both treat employees as { id, name }
  return EMPLOYEES.map(e => ({ ...e }))
}

export async function createEmployee (name) {
  await delay()
  const trimmed = (name || '').trim()
  if (!trimmed) throw new Error('Empty name')

  const emp = { id: nextEmployeeId++, name: trimmed }
  EMPLOYEES.push(emp)
  return { ...emp }
}
