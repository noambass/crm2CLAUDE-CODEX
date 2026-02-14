export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

export function formatTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function formatCurrency(amount) {
  const value = Number(amount ?? 0);
  const normalized = Number.isFinite(value) ? value : 0;
  return `₪${normalized.toFixed(2)}`;
}

export function formatAssignee(value) {
  const raw = String(value || '').trim();
  if (!raw || raw.toLowerCase() === 'owner') return 'מנהל';
  return raw;
}
