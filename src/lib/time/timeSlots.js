export function buildTenMinuteTimeOptions() {
  const times = [];
  for (let hour = 0; hour < 24; hour += 1) {
    for (let minute = 0; minute < 60; minute += 10) {
      const hh = String(hour).padStart(2, '0');
      const mm = String(minute).padStart(2, '0');
      times.push(`${hh}:${mm}`);
    }
  }
  return times;
}

export function isTenMinuteSlot(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return false;
  const [hh, mm] = String(value).split(':').map(Number);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return false;
  if (hh < 0 || hh > 23) return false;
  if (mm < 0 || mm > 59) return false;
  return mm % 10 === 0;
}

export function toTenMinuteSlot(value) {
  if (value == null) return '';
  const input = String(value).trim();
  if (!input) return '';

  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return '';

  let hh = Number(match[1]);
  let mm = Number(match[2]);
  if (!Number.isInteger(hh) || !Number.isInteger(mm)) return '';
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return '';

  const rounded = Math.round(mm / 10) * 10;
  if (rounded === 60) {
    hh = Math.min(23, hh + 1);
    mm = hh === 23 ? 50 : 0;
  } else {
    mm = rounded;
  }

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
