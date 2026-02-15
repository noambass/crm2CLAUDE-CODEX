import { supabase } from '@/api/supabaseClient';
import { normalizeAddressText } from '@/lib/geo/coordsPolicy';
import { normalizeScheduledAt } from '@/lib/jobs/scheduleValidity';

export async function listJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, accounts(id, account_name)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getJob(jobId) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, accounts(id, account_name)')
    .eq('id', jobId)
    .single();
  if (error) throw error;
  return data;
}

export async function createManualJob(input) {
  const lineItems = Array.isArray(input.lineItems) ? input.lineItems : [];
  const scheduledStartAt = normalizeScheduledAt(input.scheduledStartAt);
  const payload = {
    account_id: input.accountId,
    title: input.title,
    description: input.description || null,
    status: input.status || 'waiting_schedule',
    priority: input.priority || 'normal',
    address_text: normalizeAddressText(input.addressText) || null,
    arrival_notes: input.arrivalNotes || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    scheduled_start_at: scheduledStartAt,
    estimated_duration_minutes: input.estimatedDurationMinutes || 180,
    line_items: lineItems.map((item) => ({
      id: item.id || crypto.randomUUID(),
      description: item.description,
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unitPrice ?? item.unit_price) || 0,
      line_total: (Number(item.quantity) || 0) * (Number(item.unitPrice ?? item.unit_price) || 0),
    })),
  };
  const { data, error } = await supabase
    .from('jobs')
    .insert([payload])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateJob(jobId, patch) {
  const nextPatch = { ...patch };
  if (Object.prototype.hasOwnProperty.call(nextPatch, 'scheduled_start_at')) {
    nextPatch.scheduled_start_at = normalizeScheduledAt(nextPatch.scheduled_start_at);
  }

  const { error } = await supabase
    .from('jobs')
    .update(nextPatch)
    .eq('id', jobId);
  if (error) throw error;
}

export async function deleteJob(jobId) {
  const { error } = await supabase
    .from('jobs')
    .delete()
    .eq('id', jobId);
  if (error) throw error;
}

export async function listJobsByAccount(accountId) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
