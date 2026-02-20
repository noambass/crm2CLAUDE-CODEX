/**
 * GreenInvoice API client.
 *
 * API base: https://api.greeninvoice.co.il/api/v1
 * Sandbox:  https://sandbox.d.greeninvoice.co.il/api/v1
 *
 * Auth: POST /account/token  { id, secret } -> { token }
 * Docs: POST /documents       (bearer token)
 *       GET  /documents/:id   (bearer token)
 */

const PRODUCTION_BASE = 'https://api.greeninvoice.co.il/api/v1';

/** Document type codes */
export const DOC_TYPES = {
  PRICE_QUOTE: 10,
  ORDER: 100,
  DELIVERY_NOTE: 200,
  RETURN_DOC: 210,
  TRANSACTION_INVOICE: 300,
  TAX_INVOICE: 305,
  TAX_INVOICE_RECEIPT: 320,
  CREDIT_NOTE: 330,
  RECEIPT: 400,
  DONATION_RECEIPT: 405,
};

/** Hebrew labels for document types */
export const DOC_TYPE_LABELS = {
  [DOC_TYPES.PRICE_QUOTE]: 'הצעת מחיר',
  [DOC_TYPES.ORDER]: 'הזמנה',
  [DOC_TYPES.DELIVERY_NOTE]: 'תעודת משלוח',
  [DOC_TYPES.RETURN_DOC]: 'תעודת החזרה',
  [DOC_TYPES.TRANSACTION_INVOICE]: 'חשבונית עסקה',
  [DOC_TYPES.TAX_INVOICE]: 'חשבונית מס',
  [DOC_TYPES.TAX_INVOICE_RECEIPT]: 'חשבונית מס / קבלה',
  [DOC_TYPES.CREDIT_NOTE]: 'חשבונית זיכוי',
  [DOC_TYPES.RECEIPT]: 'קבלה',
  [DOC_TYPES.DONATION_RECEIPT]: 'קבלה על תרומה',
};

/** Document status codes returned by the API */
export const DOC_STATUS = {
  DRAFT: 0,
  OPEN: 1,
  CLOSED: 2,
  CANCELLED: 3,
};

/** Hebrew labels for document statuses */
export const DOC_STATUS_LABELS = {
  [DOC_STATUS.DRAFT]: 'טיוטה',
  [DOC_STATUS.OPEN]: 'פתוח',
  [DOC_STATUS.CLOSED]: 'סגור',
  [DOC_STATUS.CANCELLED]: 'מבוטל',
};

// ── Internal helpers ─────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000]; // exponential backoff

/**
 * Fetch wrapper with retry logic for transient network errors.
 */
async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      // Don't retry client errors (4xx), only server errors (5xx) or network issues
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      // Server error – retry if attempts remain
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || 4000));
        continue;
      }
      return res;
    } catch (err) {
      // Network error – retry if attempts remain
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt] || 4000));
        continue;
      }
      throw err;
    }
  }
}

// ── Token management ─────────────────────────────────────────────────

let _cachedToken = null;
let _tokenExpiry = 0;
const TOKEN_TTL = 25 * 60 * 1000; // 25 min (tokens last 30 min)

/**
 * Obtain a JWT from GreenInvoice (cached for 25 minutes).
 * @param {string} apiKey
 * @param {string} apiSecret
 * @param {boolean} [forceRefresh] - bypass cache
 * @returns {Promise<string>} JWT token
 */
export async function getToken(apiKey, apiSecret, forceRefresh = false) {
  if (!apiKey || !apiSecret) {
    throw new Error('חסרים פרטי חיבור API לחשבונית ירוקה');
  }

  if (!forceRefresh && _cachedToken && Date.now() < _tokenExpiry) {
    return _cachedToken;
  }

  const res = await fetchWithRetry(`${PRODUCTION_BASE}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: apiKey, secret: apiSecret }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    _cachedToken = null;
    _tokenExpiry = 0;
    throw new Error(`שגיאת אימות חשבונית ירוקה (${res.status}): ${text}`);
  }

  const data = await res.json();
  _cachedToken = data.token;
  _tokenExpiry = Date.now() + TOKEN_TTL;
  return data.token;
}

/**
 * Clear the cached token (useful after auth errors).
 */
export function clearTokenCache() {
  _cachedToken = null;
  _tokenExpiry = 0;
}

// ── Test connection ──────────────────────────────────────────────────

/**
 * Test connection to GreenInvoice by obtaining a token.
 * @param {string} apiKey
 * @param {string} apiSecret
 * @returns {Promise<{ success: boolean, message: string }>}
 */
export async function testConnection(apiKey, apiSecret) {
  try {
    await getToken(apiKey, apiSecret, true);
    return { success: true, message: 'החיבור לחשבונית ירוקה תקין' };
  } catch (err) {
    return { success: false, message: err.message || 'שגיאת חיבור' };
  }
}

// ── Document operations ──────────────────────────────────────────────

/**
 * Create a document on GreenInvoice.
 *
 * @param {string} token  JWT bearer token
 * @param {object} params
 * @param {number} params.docType       DOC_TYPES value
 * @param {boolean} [params.draft]      true = draft (status 0), false = finalized (status 1). Default true.
 * @param {object} params.client        { name, emails?, phone?, add?, taxId? }
 * @param {Array}  params.income        [{ description, quantity, price, currency?, vatType? }]
 * @param {string} [params.description] Free-text description
 * @param {string} [params.currency]    Default 'ILS'
 * @param {string} [params.lang]        Default 'he'
 * @returns {Promise<object>} Created document object from GreenInvoice
 */
export async function createDocument(token, { docType, draft = true, client, income, description, currency = 'ILS', lang = 'he' }) {
  if (!token) throw new Error('חסר טוקן אימות');
  if (!income || income.length === 0) throw new Error('חייבת להיות לפחות שורת שירות אחת');
  if (!client?.name) throw new Error('חסר שם לקוח');

  const body = {
    type: docType || DOC_TYPES.TAX_INVOICE,
    status: draft ? DOC_STATUS.DRAFT : DOC_STATUS.OPEN,
    lang,
    currency,
    signed: true,
    rounding: false,
    description: description || '',
    client: {
      name: client.name,
      emails: client.emails ? (Array.isArray(client.emails) ? client.emails : [client.emails]) : [],
      phone: client.phone || '',
      add: client.add !== false,
      ...(client.taxId ? { taxId: client.taxId } : {}),
    },
    income: income.map((item) => ({
      description: item.description || 'שירות',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      currency: item.currency || currency,
      vatType: item.vatType ?? 0,
    })),
  };

  const res = await fetchWithRetry(`${PRODUCTION_BASE}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) clearTokenCache();
    throw new Error(`שגיאה ביצירת מסמך (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Convenience wrapper: Create a draft tax invoice (type 305).
 */
export async function createDraftTaxInvoice(token, params) {
  return createDocument(token, { ...params, docType: DOC_TYPES.TAX_INVOICE, draft: true });
}

/**
 * Fetch a document by ID from GreenInvoice.
 *
 * @param {string} token  JWT bearer token
 * @param {string} docId  GreenInvoice document ID
 * @returns {Promise<object>} Document object
 */
export async function getDocument(token, docId) {
  if (!token) throw new Error('חסר טוקן אימות');
  if (!docId) throw new Error('חסר מזהה מסמך');

  const res = await fetchWithRetry(`${PRODUCTION_BASE}/documents/${docId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) clearTokenCache();
    throw new Error(`שגיאה בשליפת מסמך (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Close (finalize) a draft document – changes status from draft (0) to open (1).
 * Once closed, the document gets an official number and cannot be edited.
 *
 * @param {string} token  JWT bearer token
 * @param {string} docId  GreenInvoice document ID
 * @returns {Promise<object>} Updated document object
 */
export async function closeDocument(token, docId) {
  if (!token) throw new Error('חסר טוקן אימות');
  if (!docId) throw new Error('חסר מזהה מסמך');

  const res = await fetchWithRetry(`${PRODUCTION_BASE}/documents/${docId}/close`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 401) clearTokenCache();
    throw new Error(`שגיאה בסגירת מסמך (${res.status}): ${text}`);
  }

  return res.json();
}

/**
 * Map a GreenInvoice API status number to our local status string.
 */
export function mapGIStatusToLocal(giStatus) {
  switch (giStatus) {
    case DOC_STATUS.DRAFT:
      return 'draft';
    case DOC_STATUS.OPEN:
      return 'open';
    case DOC_STATUS.CLOSED:
      return 'closed';
    case DOC_STATUS.CANCELLED:
      return 'cancelled';
    default:
      return 'unknown';
  }
}
