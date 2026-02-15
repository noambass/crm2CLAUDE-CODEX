export const LEGACY_INVALID_SCHEDULE_CUTOFF_ISO = '2000-01-01T00:00:00.000Z';
export const LEGACY_INVALID_SCHEDULE_CUTOFF_QUERY = '2000-01-01';

const LEGACY_INVALID_SCHEDULE_CUTOFF_MS = Date.parse(LEGACY_INVALID_SCHEDULE_CUTOFF_ISO);

export function parseValidScheduledAt(value) {
  if (!value) return null;
  const parsed = new Date(value);
  const timestamp = parsed.getTime();
  if (Number.isNaN(timestamp)) return null;
  if (timestamp < LEGACY_INVALID_SCHEDULE_CUTOFF_MS) return null;
  return parsed;
}

export function isScheduledAtValid(value) {
  return parseValidScheduledAt(value) !== null;
}

export function normalizeScheduledAt(value) {
  const parsed = parseValidScheduledAt(value);
  return parsed ? parsed.toISOString() : null;
}

export function getScheduleQueryFrom(fromIso) {
  const parsed = parseValidScheduledAt(fromIso);
  if (!parsed) return LEGACY_INVALID_SCHEDULE_CUTOFF_ISO;
  return parsed.toISOString();
}
