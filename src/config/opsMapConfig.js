function parseCoordinate(value) {
  if (value == null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric;
}

const dayStartOriginAddress =
  String(import.meta.env.VITE_DAY_START_ORIGIN_ADDRESS || '').trim() || 'אגס 3, אשדוד';
const dayStartOriginLat = parseCoordinate(import.meta.env.VITE_DAY_START_ORIGIN_LAT);
const dayStartOriginLng = parseCoordinate(import.meta.env.VITE_DAY_START_ORIGIN_LNG);

export const OPS_MAP_DEFAULTS = {
  dayStartOrigin: {
    address: dayStartOriginAddress,
    lat: dayStartOriginLat,
    lng: dayStartOriginLng,
  },
};

export function hasFixedDayStartCoordinates() {
  return OPS_MAP_DEFAULTS.dayStartOrigin.lat != null && OPS_MAP_DEFAULTS.dayStartOrigin.lng != null;
}
