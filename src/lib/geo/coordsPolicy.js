export const ISRAEL_BOUNDS = Object.freeze({
  minLat: 29,
  maxLat: 34.9,
  minLng: 34,
  maxLng: 35.9,
});

export function parseCoord(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function isZeroZero(lat, lng) {
  const parsedLat = parseCoord(lat);
  const parsedLng = parseCoord(lng);
  if (parsedLat == null || parsedLng == null) return false;
  return parsedLat === 0 && parsedLng === 0;
}

export function isInIsraelBounds(lat, lng) {
  const parsedLat = parseCoord(lat);
  const parsedLng = parseCoord(lng);
  if (parsedLat == null || parsedLng == null) return false;

  return (
    parsedLat >= ISRAEL_BOUNDS.minLat &&
    parsedLat <= ISRAEL_BOUNDS.maxLat &&
    parsedLng >= ISRAEL_BOUNDS.minLng &&
    parsedLng <= ISRAEL_BOUNDS.maxLng
  );
}

export function isUsableJobCoords(lat, lng) {
  const parsedLat = parseCoord(lat);
  const parsedLng = parseCoord(lng);
  if (parsedLat == null || parsedLng == null) return false;
  if (isZeroZero(parsedLat, parsedLng)) return false;
  return isInIsraelBounds(parsedLat, parsedLng);
}

export function normalizeAddressText(value) {
  const { value: normalized } = autofixAddressText(value);
  return normalized;
}

function normalizeBasicAddressSpacing(value) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[;|]+/g, ', ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,+/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^,\s*|\s*,$/g, '');
}

function stripTrailingAddressSuffix(value) {
  return String(value || '')
    .replace(/\s*[,.-]?\s*(apartment|apt|floor|entrance|suite|unit|דירה|דיר|קומה|כניסה)\s*[\p{L}\p{N}/-]+$/iu, '')
    .trim();
}

function splitAlphaNumericTokens(value) {
  return String(value || '')
    .replace(/([^\W\d_])(\d)/gu, '$1 $2')
    .replace(/(\d)([^\W\d_])/gu, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
}

function inferCommaBeforeCity(value) {
  const text = String(value || '');
  if (!text || text.includes(',')) return text;

  const tokens = text.split(' ').map((part) => part.trim()).filter(Boolean);
  if (tokens.length < 3) return text;

  const numberIndex = tokens.findIndex((token) => /\d/.test(token));
  if (numberIndex < 0 || numberIndex >= tokens.length - 1) return text;

  const streetPart = tokens.slice(0, numberIndex + 1).join(' ').trim();
  const cityPart = tokens.slice(numberIndex + 1).join(' ').trim();
  if (!streetPart || !cityPart) return text;

  return `${streetPart}, ${cityPart}`;
}

export function autofixAddressText(value) {
  const original = String(value || '');
  if (!original.trim()) {
    return {
      value: '',
      changed: false,
      fixes: [],
    };
  }

  const fixes = [];
  let next = original;

  const basic = normalizeBasicAddressSpacing(next);
  if (basic !== next) {
    fixes.push('spacing');
    next = basic;
  }

  const splitTokens = splitAlphaNumericTokens(next);
  if (splitTokens !== next) {
    fixes.push('split_alpha_numeric');
    next = splitTokens;
  }

  const noSuffix = stripTrailingAddressSuffix(next);
  if (noSuffix !== next) {
    fixes.push('remove_trailing_suffix');
    next = noSuffix;
  }

  const inferredComma = inferCommaBeforeCity(next);
  if (inferredComma !== next) {
    fixes.push('add_city_comma');
    next = inferredComma;
  }

  const finalValue = normalizeBasicAddressSpacing(next);
  if (finalValue !== next) {
    fixes.push('final_spacing');
  }

  return {
    value: finalValue,
    changed: finalValue !== original,
    fixes,
  };
}

export function buildAddressQueryVariants(value) {
  const normalized = normalizeAddressText(value);
  if (!normalized) return [];

  const stripped = stripTrailingAddressSuffix(normalized);
  const base = stripped || normalized;
  return Array.from(
    new Set([
      base,
      `${base}, ישראל`,
      `${base}, Israel`,
    ].map((item) => normalizeBasicAddressSpacing(item)).filter(Boolean)),
  );
}

export function isStrictIsraeliAddressFormat(value) {
  const normalized = normalizeAddressText(value);
  if (!normalized) return false;
  const parts = normalized.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return false;

  const streetPart = parts[0];
  const cityPart = parts.slice(1).join(',').trim();
  if (!cityPart) return false;

  // Require a street number in the first segment, e.g. "הרצל 10".
  return /\d+/.test(streetPart);
}
