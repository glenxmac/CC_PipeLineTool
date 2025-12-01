// api.sharepoint.js

// ---- CONFIG ----
const IS_LOCAL =
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'

const MSAL_CONFIG = {
  auth: {
    clientId: '796b1ce0-8549-4cf5-b2af-0f15b6948458', // App registration
    authority: 'https://login.microsoftonline.com/d69ad18b-43e9-43bc-8ef5-0ef37b5a8d0c',
    redirectUri: IS_LOCAL
      ? window.location.origin // local dev, e.g. http://127.0.0.1:5500
      : 'https://glenxmac.github.io/CC_PipeLineTool/'
  }
}

const GRAPH_SCOPES = ['https://graph.microsoft.com/Sites.ReadWrite.All']

// HOST + SITE + LIST IDs
const GRAPH_SITE_ID =
  'completecyclist.sharepoint.com,96a4d39a-1fd7-4060-a116-c310fb39540c,bb7d28c5-27a4-4991-a726-f0e83946a8aa'

const GRAPH_DEALS_LIST_ID = '7a9d0573-f143-4314-b726-c8f0a7b8b2e7'
const GRAPH_EMP_LIST_ID = 'a3c95ce2-cbe9-4e23-8a9f-a58a128fead6'
const GRAPH_WORKSHOP_LIST_ID = '0373b889-ee0b-4ec6-b22a-2308e7b56e5f'

// ---- MSAL setup ----
const msalInstance = new msal.PublicClientApplication(MSAL_CONFIG)

async function getActiveAccount () {
  let account = msalInstance.getActiveAccount()
  if (!account) {
    const accounts = msalInstance.getAllAccounts()
    if (accounts.length > 0) {
      account = accounts[0]
      msalInstance.setActiveAccount(account)
    }
  }
  return account
}

function isInPopup () {
  // True when running inside the MSAL login popup window
  return !!window.opener && window.opener !== window
}

async function loginIfNeeded () {
  if (isInPopup()) {
    // In this window we just let MSAL finish its flow and notify the opener.
    return getActiveAccount()
  }

  const account = await getActiveAccount()
  if (account) return account

  const loginResponse = await msalInstance.loginPopup({
    scopes: GRAPH_SCOPES
  })
  msalInstance.setActiveAccount(loginResponse.account)
  return loginResponse.account
}

async function getAccessToken () {
  let account = await getActiveAccount()

  if (!account) {
    if (isInPopup()) {
      throw new Error('No account in popup context')
    }
    account = await loginIfNeeded()
  }

  const request = {
    scopes: GRAPH_SCOPES,
    account
  }

  try {
    const result = await msalInstance.acquireTokenSilent(request)
    return result.accessToken
  } catch (e) {
    if (!isInPopup()) {
      const result = await msalInstance.acquireTokenPopup(request)
      return result.accessToken
    }
    throw e
  }
}

// ---- Helper: call Graph ----
async function graphFetch (path, options = {}) {
  const token = await getAccessToken()
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Graph error ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// ---------- DEALS (PipelineDeals) ----------

function listItemToDeal (item) {
  const f = item.fields
  return {
    id: Number(item.id),
    customer: f.Customer || '',
    bike: f.Bike || '',
    technician: f.Technician || '',
    status: f.Status || 'Enquiry',
    openDate: f.OpenDate || null,
    value: typeof f.Value === 'number' ? f.Value : null,
    notes: f.Notes || '',
    closeDate: f.CloseDate || null,
    closedOutcome: f.ClosedOutcome || null,
    urgency: f.Urgency || 'Warm'
  }
}

export async function getDeals () {
  const data = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items?expand=fields`
  )
  return data.value.map(listItemToDeal)
}

export async function createDeal (newDeal) {
  const fields = {
    Title: `${newDeal.customer} - ${newDeal.bike}`,
    Customer: newDeal.customer,
    Bike: newDeal.bike,
    Technician: newDeal.technician,
    Status: newDeal.status,
    OpenDate: newDeal.openDate || new Date().toISOString().split('T')[0],
    Value: newDeal.value || null,
    Notes: newDeal.notes || '',
    CloseDate: newDeal.closeDate || null,
    ClosedOutcome: newDeal.closedOutcome || null,
    Urgency: newDeal.urgency || 'Warm'
  }

  const body = { fields }

  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  )

  return listItemToDeal(item)
}

export async function updateDeal (id, partial) {
  const fieldsPatch = {}

  if (partial.customer !== undefined) fieldsPatch.Customer = partial.customer
  if (partial.bike !== undefined) fieldsPatch.Bike = partial.bike
  if (partial.technician !== undefined) fieldsPatch.Technician = partial.technician
  if (partial.status !== undefined) fieldsPatch.Status = partial.status
  if (partial.openDate !== undefined) fieldsPatch.OpenDate = partial.openDate
  if (partial.value !== undefined) fieldsPatch.Value = partial.value
  if (partial.notes !== undefined) fieldsPatch.Notes = partial.notes
  if (partial.closeDate !== undefined) fieldsPatch.CloseDate = partial.closeDate
  if (partial.closedOutcome !== undefined) fieldsPatch.ClosedOutcome = partial.closedOutcome
  if (partial.urgency !== undefined) fieldsPatch.Urgency = partial.urgency

  if (Object.keys(fieldsPatch).length === 0) {
    return getDealById(id)
  }

  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items/${id}/fields`,
    {
      method: 'PATCH',
      body: JSON.stringify(fieldsPatch)
    }
  )

  return getDealById(id)
}

async function getDealById (id) {
  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items/${id}?expand=fields`
  )
  return listItemToDeal(item)
}

export async function deleteDeal (id) {
  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items/${id}`,
    { method: 'DELETE' }
  )
}

// ---------- EMPLOYEES (Salespeople / Mechanics) ----------

// map Salespeople list item to { id, name, role }
function listItemToEmployee (item) {
  const f = item.fields
  return {
    id: Number(item.id),
    name: f.Title || '',
    role: f.Role || 'Salesperson'
  }
}

export async function getEmployees () {
  const data = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_EMP_LIST_ID}/items?expand=fields`
  )
  return data.value.map(listItemToEmployee)
}

// Convenience helpers: filtered views
export async function getMechanics () {
  const all = await getEmployees()
  return all.filter(e => e.role === 'Mechanic')
}

export async function getSalespeople () {
  const all = await getEmployees()
  return all.filter(e => e.role === 'Salesperson')
}

// createEmployee now optionally takes a role (default "Salesperson")
export async function createEmployee (name, role) {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('Empty name')

  const body = {
    fields: {
      Title: trimmed,
      Role: role || 'Salesperson'
    }
  }

  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_EMP_LIST_ID}/items`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  )

  return listItemToEmployee(item)
}

// ---------- WORKSHOP BOOKINGS (WorkshopBookings) ----------

function listItemToWorkshopBooking (item) {
  const f = item.fields
  return {
    id: Number(item.id),
    date: f.BookingDate || null, // 'yyyy-MM-dd'
    mechanic: f.Mechanic || '',
    serviceType: f.ServiceType || '',
    startTime: f.StartTime || '', // 'HH:mm'
    durationHours: typeof f.DurationHours === 'number' ? f.DurationHours : 0,
    customerLabel: f.CustomerLabel || f.Title || '',
    notes: f.Notes || ''
  }
}

export async function getWorkshopBookings () {
  const data = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_WORKSHOP_LIST_ID}/items?expand=fields`
  )
  return data.value.map(listItemToWorkshopBooking)
}

export async function createWorkshopBooking (booking) {
  const fields = {
    // Title is required, everything else we *skip* for now
    Title: booking.customerLabel || booking.serviceType || 'Workshop booking'
  }

  console.log('TEST createWorkshopBooking payload:', { fields })

  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_WORKSHOP_LIST_ID}/items`,
    {
      method: 'POST',
      body: JSON.stringify({ fields })
    }
  )

  return listItemToWorkshopBooking(item)
}

export async function updateWorkshopBooking (id, partial) {
  const fieldsPatch = {}

  if (partial.date !== undefined) fieldsPatch.BookingDate = partial.date
  if (partial.mechanic !== undefined) fieldsPatch.Mechanic = partial.mechanic
  if (partial.serviceType !== undefined) fieldsPatch.ServiceType = partial.serviceType
  if (partial.startTime !== undefined) fieldsPatch.StartTime = partial.startTime

  if (partial.durationHours !== undefined) {
    const duration =
      typeof partial.durationHours === 'number'
        ? partial.durationHours
        : partial.durationHours
          ? Number(partial.durationHours)
          : null

    fieldsPatch.DurationHours =
      duration != null && !Number.isNaN(duration) ? duration : null
  }

  if (partial.customerLabel !== undefined) {
    fieldsPatch.CustomerLabel = partial.customerLabel
    fieldsPatch.Title = partial.customerLabel
  }
  if (partial.notes !== undefined) fieldsPatch.Notes = partial.notes

  if (Object.keys(fieldsPatch).length === 0) {
    return getWorkshopBookingById(id)
  }

  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_WORKSHOP_LIST_ID}/items/${id}/fields`,
    {
      method: 'PATCH',
      body: JSON.stringify(fieldsPatch)
    }
  )

  return getWorkshopBookingById(id)
}

async function getWorkshopBookingById (id) {
  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_WORKSHOP_LIST_ID}/items/${id}?expand=fields`
  )
  return listItemToWorkshopBooking(item)
}

export async function deleteWorkshopBooking (id) {
  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_WORKSHOP_LIST_ID}/items/${id}`,
    { method: 'DELETE' }
  )
}
