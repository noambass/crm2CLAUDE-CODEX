import { supabase } from '@/api/supabaseClient';
import {
  buildAddressQueryVariants,
  isUsableJobCoords,
  normalizeAddressText,
  parseCoord,
} from '@/lib/geo/coordsPolicy';
import { getStatusForScheduling } from '@/lib/jobs/schedulingStatus';
import { normalizeScheduledAt } from '@/lib/jobs/scheduleValidity';

async function geocodeViaNominatimFallback(addressText) {
  const query = normalizeAddressText(addressText);
  if (!query) return null;

  const candidates = buildAddressQueryVariants(query);
  for (const item of candidates) {
    const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=il&q=${encodeURIComponent(item)}`);
    if (!resp.ok) continue;
    const body = await resp.json().catch(() => []);
    const first = body?.[0];
    const lat = parseCoord(first?.lat);
    const lng = parseCoord(first?.lon);
    if (isUsableJobCoords(lat, lng)) {
      return {
        lat,
        lng,
        normalizedAddress: first.display_name || query,
        provider: 'nominatim-fallback',
      };
    }
  }

  return null;
}

export async function geocodeAddress(addressText) {
  const normalizedAddress = normalizeAddressText(addressText);
  if (!normalizedAddress) throw new Error('Address is required');

  const resp = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addressText: normalizedAddress }),
  });

  if (resp.ok) {
    try {
      const data = await resp.json();
      const lat = parseCoord(data?.lat);
      const lng = parseCoord(data?.lng);
      if (isUsableJobCoords(lat, lng)) {
        return {
          ...data,
          lat,
          lng,
        };
      }
    } catch {
      // Ignore and continue to fallback.
    }

    const fallback = await geocodeViaNominatimFallback(normalizedAddress);
    if (fallback) return fallback;
    throw new Error('Address not found in IL');
  }

  // Local Vite dev commonly has no /api server - fallback to client geocoding.
  if (resp.status === 404 || resp.status === 429 || resp.status >= 500) {
    const fallback = await geocodeViaNominatimFallback(normalizedAddress);
    if (fallback) return fallback;
  }

  const body = await resp.json().catch(() => ({}));
  throw new Error(body.error || 'Geocode failed');
}

export async function listMapJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  const jobs = data || [];
  const accountIds = Array.from(
    new Set(
      jobs
        .map((job) => job.account_id)
        .filter((value) => typeof value === 'string' && value)
    )
  );

  if (accountIds.length === 0) return jobs;

  const { data: accountsRows } = await supabase
    .from('accounts')
    .select('id,account_name')
    .in('id', accountIds);

  const accountNameById = new Map((accountsRows || []).map((row) => [row.id, row.account_name]));
  return jobs.map((job) => {
    const existingRel = Array.isArray(job.accounts) ? job.accounts[0] : job.accounts;
    const accountName = existingRel?.account_name || accountNameById.get(job.account_id) || null;
    return {
      ...job,
      accounts: accountName ? { account_name: accountName } : null,
    };
  });
}

export async function updateMapJobCoordinates(jobId, lat, lng) {
  const { error } = await supabase
    .from('jobs')
    .update({ lat, lng })
    .eq('id', jobId);

  if (error) throw error;
}

export async function scheduleMapJob(jobId, scheduledStartAt, currentStatus) {
  const nextStatus = getStatusForScheduling(currentStatus);
  const normalizedScheduledStartAt = normalizeScheduledAt(scheduledStartAt);
  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start_at: normalizedScheduledStartAt,
      status: nextStatus,
    })
    .eq('id', jobId);

  if (error) throw error;
  return { scheduled_start_at: normalizedScheduledStartAt, status: nextStatus };
}
