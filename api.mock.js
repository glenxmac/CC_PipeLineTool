// api.mock.js

// --- MOCK SALESPEOPLE ---
const employees = [
  { id: 1, name: 'John Gill' },
  { id: 2, name: 'Nick Campbell' }
]

export async function getEmployees () {
  return Promise.resolve(employees)
}

export async function createEmployee (name) {
  const trimmed = name.trim()
  if (!trimmed) return Promise.reject(new Error('Empty name'))
  const nextId = employees.length ? Math.max(...employees.map(e => e.id)) + 1 : 1
  const emp = { id: nextId, name: trimmed }
  employees.push(emp)
  return Promise.resolve(emp)
}

// --- MOCK DEALS ---
let deals = [
  {
    id: 1,
    customer: 'Ajay Naidoo',
    bike: 'SL8 Expert 54',
    technician: 'John Gill',
    status: 'Approval',
    openDate: '2025-08-04',
    value: 104347.83,
    notes: '10/11 – purchasing 2nd hand',
    closedDate: null,
    closedOutcome: null // 'Successful' | 'Lost'
  },
  {
    id: 2,
    customer: 'John Drennan',
    bike: 'Levo Expert S4',
    technician: 'John Gill',
    status: 'Quote',
    openDate: '2025-08-14',
    value: 173043.48,
    notes: '3/11 – not replying to messages',
    closedDate: null,
    closedOutcome: null
  },
  {
    id: 3,
    customer: 'Burger v/d Merwe',
    bike: 'Epic 8 Comp - M - AXS',
    technician: 'Nick Campbell',
    status: 'Committed',
    openDate: '2025-11-04',
    value: 91304.35,
    notes: '25/11 – follow up sent re options',
    closedDate: null,
    closedOutcome: null
  }
]

export async function deleteDeal (id) {
  deals = deals.filter(d => d.id !== id)
  return Promise.resolve()
}

export async function getDeals () {
  return Promise.resolve(deals)
}

export async function createDeal (newDeal) {
  const nextId = deals.length ? Math.max(...deals.map(d => d.id)) + 1 : 1
  const deal = { id: nextId, ...newDeal }
  deals.push(deal)
  return Promise.resolve(deal)
}

export async function updateDeal (id, partial) {
  const idx = deals.findIndex(d => d.id === id)
  if (idx < 0) return Promise.reject(new Error('Deal not found'))
  deals[idx] = { ...deals[idx], ...partial }
  return Promise.resolve(deals[idx])
}
