const windows = new Map();

function prune(now) {
  for (const [key, state] of windows.entries()) {
    if (state.resetAt <= now) windows.delete(key);
  }
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (Array.isArray(forwarded)) return String(forwarded[0] || '').split(',')[0].trim() || 'unknown';
  if (forwarded) return String(forwarded).split(',')[0].trim() || 'unknown';
  return 'unknown';
}

export function checkRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  prune(now);

  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(limit - 1, 0), retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  current.count += 1;
  windows.set(key, current);
  return { allowed: true, remaining: Math.max(limit - current.count, 0), retryAfterSeconds: 0 };
}

export function limitByIp(req, scope, limit, windowMs) {
  const ip = getClientIp(req);
  return checkRateLimit({
    key: `${scope}:${ip}`,
    limit,
    windowMs,
  });
}
