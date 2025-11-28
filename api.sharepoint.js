// api.sharepoint.js

// ---- CONFIG ----
// Replace these with your real IDs from Azure + Graph
const MSAL_CONFIG = {
  auth: {
    clientId: '796b1ce0-8549-4cf5-b2af-0f15b6948458', // from App registration
    authority: 'https://login.microsoftonline.com/d69ad18b-43e9-43bc-8ef5-0ef37b5a8d0c',
    redirectUri: 'https://YOUR_GITHUB_USERNAME.github.io/cc-pipeline-web/'
  }
}

const GRAPH_SCOPES = ['https://graph.microsoft.com/Sites.ReadWrite.All']

const GRAPH_SITE_ID =
  'completecyclist.sharepoint.com,96a4d39a-1fd7-4060-a116-c310fb39540c,bb7d28c5-27a4-4991-a726-f0e83946a8aa'

const GRAPH_LIST_ID = '7a9d0573-f143-4314-b726-c8f0a7b8b2e7'

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
  return res.json()
}

// ---- Mapping between list items and your Deal model ----

function listItemToDeal (item) {
  const f = item.fields
  return {
    id: item.id,
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

// ---- Public API used by app.js ----

export async function getDeals () {
  const data = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_LIST_ID}/items?expand=fields`
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
    ClosedDate: newDeal.closedDate || null,
    ClosedOutcome: newDeal.closedOutcome || null
  }

  const body = {
    fields
  }

  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_LIST_ID}/items`,
    {
      method: 'POST',
      body: JSON.stringify(body)
    }
  )

  return listItemToDeal(item)
}

export async function updateDeal (id, patch) {
  // patch only the fields that changed
  const fieldsPatch = {}

  if (patch.customer !== undefined) fieldsPatch.Customer = patch.customer
  if (patch.bike !== undefined) fieldsPatch.Bike = patch.bike
  if (patch.technician !== undefined) fieldsPatch.Technician = patch.technician
  if (patch.status !== undefined) fieldsPatch.Status = patch.status
  if (patch.openDate !== undefined) fieldsPatch.OpenDate = patch.openDate
  if (patch.value !== undefined) fieldsPatch.Value = patch.value
  if (patch.notes !== undefined) fieldsPatch.Notes = patch.notes
  if (patch.closedDate !== undefined) fieldsPatch.ClosedDate = patch.closedDate
  if (patch.closedOutcome !== undefined) fieldsPatch.ClosedOutcome = patch.closedOutcome

  if (Object.keys(fieldsPatch).length === 0) {
    return getDealById(id)
  }

  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_LIST_ID}/items/${id}/fields`,
    {
      method: 'PATCH',
      body: JSON.stringify(fieldsPatch)
    }
  )

  return getDealById(id)
}

async function getDealById (id) {
  const item = await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_LIST_ID}/items/${id}?expand=fields`
  )
  return listItemToDeal(item)
}

export async function deleteDeal (id) {
  await graphFetch(
    `/sites/${GRAPH_SITE_ID}/lists/${GRAPH_LIST_ID}/items/${id}`,
    { method: 'DELETE' }
  )
}
