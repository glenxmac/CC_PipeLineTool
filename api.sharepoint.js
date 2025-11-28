// api.sharepoint.js

// ---- CONFIG ----
const MSAL_CONFIG = {
  auth: {
    clientId: '796b1ce0-8549-4cf5-b2af-0f15b6948458', // App registration
    authority: 'https://login.microsoftonline.com/d69ad18b-43e9-43bc-8ef5-0ef37b5a8d0c',
    redirectUri: 'https://glenxmac.github.io/CC_PipeLineTool/' // TODO: replace
  }
}

const GRAPH_SCOPES = ['https://graph.microsoft.com/Sites.ReadWrite.All']

// HOST + SITE + LIST IDs
const GRAPH_SITE_ID =
  'completecyclist.sharepoint.com,96a4d39a-1fd7-4060-a116-c310fb39540c,bb7d28c5-27a4-4991-a726-f0e83946a8aa'

const GRAPH_DEALS_LIST_ID = '7a9d0573-f143-4314-b726-c8f0a7b8b2e7'

// TODO: replace with the Id of your Salespeople list
const GRAPH_EMP_LIST_ID = 'a3c95ce2-cbe9-4e23-8a9f-a58a128fead6'

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

async function loginIfNeeded () {
  let account = await getActiveAccount()
  if (!account) {
    const loginResponse = await msalInstance.loginPopup({
      scopes: GRAPH_SCOPES
    })
    msalInstance.setActiveAccount(loginResponse.account)
    account = loginResponse.account
  }
  return account
}

async function getAccessToken () {
  const account = await loginIfNeeded()
  const request = {
    scopes: GRAPH_SCOPES,
    account
  }

  try {
    const result = await msalInstance.acquireTokenSilent(request)
    return result.accessToken
  } catch (e) {
    const result = await msalInstance.acquireTokenPopup(request)
    return result.accessToken
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
  // DELETE responses have no body
  if (res.status === 204) return null
  return res.json()
}

// ---------- DEALS (PipelineDeals) ----------

function listItemToDeal (item) {
  const f = item.fields
  return {
    // make sure id is a number, like in the mock
    id: Number(item.id),
    customer: f.Customer || '',
    bike: f.Bike || '',
    technician: f.Technician || '',
    status: f.Status || 'Enquiry',
    openDate: f.OpenDate || null,
    value: typeof f.Value === 'number' ? f.Value : null,
    notes: f.Notes || '',
    closedDate: f.ClosedDate || null,
    closedOutcome: f.ClosedOutcome || null
  }
}

// mirror: export async function getDeals()
export async function getDeals () {
  const data = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items?expand=fields`
  )
  return data.value.map(listItemToDeal)
}

// mirror: export async function createDeal(newDeal)
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
    ClosedDate: newDeal.closedDate || null,
    ClosedOutcome: newDeal.closedOutcome || null
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

// mirror: export async function updateDeal(id, partial)
export async function updateDeal (id, partial) {
  const fieldsPatch = {}

  if (partial.customer !== undefined) fieldsPatch.Customer = partial.customer
  if (partial.bike !== undefined) fieldsPatch.Bike = partial.bike
  if (partial.technician !== undefined) fieldsPatch.Technician = partial.technician
  if (partial.status !== undefined) fieldsPatch.Status = partial.status
  if (partial.openDate !== undefined) fieldsPatch.OpenDate = partial.openDate
  if (partial.value !== undefined) fieldsPatch.Value = partial.value
  if (partial.notes !== undefined) fieldsPatch.Notes = partial.notes
  if (partial.closedDate !== undefined) fieldsPatch.ClosedDate = partial.closedDate
  if (partial.closedOutcome !== undefined) fieldsPatch.ClosedOutcome = partial.closedOutcome

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

// mirror: export async function deleteDeal(id)
export async function deleteDeal (id) {
  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_DEALS_LIST_ID}/items/${id}`,
    { method: 'DELETE' }
  )
  // mock returns resolved Promise<void>, so this matches
}

// ---------- EMPLOYEES (Salespeople) ----------

// map Salespeople list item to { id, name }
function listItemToEmployee (item) {
  const f = item.fields
  // using Title as the display name
  const name = f.Title || f.Name || ''
  return {
    id: Number(item.id),
    name
  }
}

// mirror: export async function getEmployees()
export async function getEmployees () {
  const data = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_EMP_LIST_ID}/items?expand=fields`
  )
  return data.value.map(listItemToEmployee)
}

// mirror: export async function createEmployee(name)
export async function createEmployee (name) {
  const trimmed = name.trim()
  if (!trimmed) {
    throw new Error('Empty name')
  }

  const body = {
    fields: {
      Title: trimmed
      // if you add a separate Name column, also set Name: trimmed here
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
