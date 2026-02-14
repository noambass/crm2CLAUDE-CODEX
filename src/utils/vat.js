/**
 * VAT (עם"מ) utilities for Israeli CRM
 * Standard VAT rate: 18%
 */

export const VAT_RATE = 0.18;
export const VAT_MULTIPLIER = 1 + VAT_RATE;

/**
 * Calculate net amount from gross (including VAT)
 * @param {number} gross - Amount including VAT
 * @returns {number} Net amount before VAT
 */
export const calculateNetFromGross = (gross) => {
  return gross / VAT_MULTIPLIER;
};

/**
 * Calculate VAT amount
 * @param {number} net - Net amount before VAT
 * @returns {number} VAT amount
 */
export const calculateVAT = (net) => {
  return net * VAT_RATE;
};

/**
 * Calculate gross amount (including VAT)
 * @param {number} net - Net amount before VAT
 * @returns {number} Gross amount including VAT
 */
export const calculateGross = (net) => {
  return net * VAT_MULTIPLIER;
};

/**
 * Format price with VAT breakdown
 * @param {number} net - Net amount
 * @param {boolean} withBreakdown - Include VAT breakdown in display
 * @returns {object} { net, vat, gross, formatted }
 */
export const getPriceWithVAT = (net, withBreakdown = false) => {
  const vat = calculateVAT(net);
  const gross = calculateGross(net);

  const formatted = {
    net,
    vat,
    gross,
    netFormatted: net.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    vatFormatted: vat.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    grossFormatted: gross.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  };

  return formatted;
};
