import { supabase } from '@/api/supabaseClient';

export async function geocodeAddress(addressText) {
  const resp = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addressText }),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Geocode failed');
  }
  return resp.json();
}

export async function listMapJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select(
      'id,account_id,assigned_to,title,description,status,priority,address_text,arrival_notes,lat,lng,scheduled_start_at,estimated_duration_minutes,line_items,created_at,accounts(account_name)'
    )
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateMapJobCoordinates(jobId, lat, lng) {
  const { error } = await supabase
    .from('jobs')
    .update({ lat, lng })
    .eq('id', jobId);

  if (error) throw error;
}

export async function scheduleMapJob(jobId, scheduledStartAt, currentStatus) {
  const nextStatus = currentStatus === 'done' ? 'done' : 'waiting_execution';
  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start_at: scheduledStartAt,
      status: nextStatus,
    })
    .eq('id', jobId);

  if (error) throw error;
  return { scheduled_start_at: scheduledStartAt, status: nextStatus };
}

export async function getRouteEstimate({ origin, destination, departureTime }) {
  const resp = await fetch('/api/route', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ origin, destination, departureTime }),
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}));
    throw new Error(body.error || 'Route failed');
  }
  return resp.json();
}
