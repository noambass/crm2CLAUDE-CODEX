export const EMPTY_JOB_LINE_ITEM = () => ({
  id: crypto.randomUUID(),
  description: '',
  quantity: 1,
  unit_price: '',
});

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export function getLineItemTotal(item) {
  return toNumber(item?.quantity) * toNumber(item?.unit_price);
}

export function getLineItemsSubtotal(lineItems) {
  if (!Array.isArray(lineItems)) return 0;
  return lineItems.reduce((sum, item) => sum + getLineItemTotal(item), 0);
}

export function normalizeJobLineItems(rawLineItems) {
  if (!Array.isArray(rawLineItems)) return [];

  return rawLineItems.map((item) => ({
    id: item?.id || crypto.randomUUID(),
    description: String(item?.description || ''),
    quantity: item?.quantity ?? 1,
    unit_price: item?.unit_price ?? '',
  }));
}
