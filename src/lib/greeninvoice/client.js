/**
 * GreenInvoice API client.
 *
 * API base: https://api.greeninvoice.co.il/api/v1
 * Sandbox:  https://sandbox.d.greeninvoice.co.il/api/v1
 *
 * Auth: POST /account/token  { id, secret } -> { token }
 * Docs: POST /documents       (bearer token)
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

/**
 * Obtain a JWT from GreenInvoice.
 * @param {string} apiKey
 * @param {string} apiSecret
 * @returns {Promise<string>} JWT token
 */
export async function getToken(apiKey, apiSecret) {
  const res = await fetch(`${PRODUCTION_BASE}/account/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: apiKey, secret: apiSecret }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GreenInvoice auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.token;
}

/**
 * Create a draft tax invoice (type 305) on GreenInvoice.
 *
 * @param {string} token  JWT bearer token
 * @param {object} params
 * @param {object} params.client        { name, emails?, phone?, add? }
 * @param {Array}  params.income        [{ description, quantity, price, currency, vatType }]
 * @param {string} [params.description] Free-text description
 * @param {string} [params.currency]    Default 'ILS'
 * @param {string} [params.lang]        Default 'he'
 * @returns {Promise<object>} Created document object from GreenInvoice
 */
export async function createDraftTaxInvoice(token, { client, income, description, currency = 'ILS', lang = 'he' }) {
  const body = {
    type: DOC_TYPES.TAX_INVOICE,
    status: 0, // 0 = draft
    lang,
    currency,
    signed: true,
    rounding: false,
    description: description || '',
    client: {
      name: client.name || '',
      emails: client.emails ? (Array.isArray(client.emails) ? client.emails : [client.emails]) : [],
      phone: client.phone || '',
      add: client.add !== false, // sync client to GreenInvoice by default
    },
    income: income.map((item) => ({
      description: item.description || 'שירות',
      quantity: Number(item.quantity) || 1,
      price: Number(item.price) || 0,
      currency: item.currency || currency,
      vatType: item.vatType ?? 0, // 0 = default VAT
    })),
  };

  const res = await fetch(`${PRODUCTION_BASE}/documents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GreenInvoice create document failed (${res.status}): ${text}`);
  }

  return res.json();
}
