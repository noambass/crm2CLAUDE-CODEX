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
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
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
