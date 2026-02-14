import { supabase } from '@/api/supabaseClient';
import { getStatusForScheduling } from '@/lib/jobs/schedulingStatus';

export async function listScheduledJobs(fromIso, toIso) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, accounts(id, account_name)')
    .gte('scheduled_start_at', fromIso)
    .lte('scheduled_start_at', toIso)
    .order('scheduled_start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listUnscheduledJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, accounts(id, account_name)')
    .is('scheduled_start_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function rescheduleJob(jobId, nextIso, currentStatus) {
  const nextStatus = getStatusForScheduling(currentStatus);
  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start_at: nextIso,
      status: nextStatus,
    })
    .eq('id', jobId);
  if (error) throw error;
  return { status: nextStatus, scheduled_start_at: nextIso };
}

export async function setJobSchedule(jobId, nextIso, nextStatus) {
  const payload = {
    scheduled_start_at: nextIso || null,
  };
  if (nextStatus) payload.status = nextStatus;

  const { error } = await supabase
    .from('jobs')
    .update(payload)
    .eq('id', jobId);
  if (error) throw error;

  return {
    status: nextStatus,
    scheduled_start_at: nextIso || null,
  };
}
