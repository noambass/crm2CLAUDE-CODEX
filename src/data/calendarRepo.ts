import { supabase } from '@/api/supabaseClient';
import { getStatusForScheduling } from '@/lib/jobs/schedulingStatus';
import {
  getScheduleQueryFrom,
  LEGACY_INVALID_SCHEDULE_CUTOFF_QUERY,
  normalizeScheduledAt,
} from '@/lib/jobs/scheduleValidity';

export async function listScheduledJobs(fromIso, toIso) {
  const queryFrom = getScheduleQueryFrom(fromIso);
  const { data, error } = await supabase
    .from('jobs')
    .select('*, accounts(id, account_name)')
    .gte('scheduled_start_at', queryFrom)
    .lte('scheduled_start_at', toIso)
    .order('scheduled_start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listUnscheduledJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*, accounts(id, account_name)')
    .or(`scheduled_start_at.is.null,scheduled_start_at.lt.${LEGACY_INVALID_SCHEDULE_CUTOFF_QUERY}`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function rescheduleJob(jobId, nextIso, currentStatus) {
  const nextStatus = getStatusForScheduling(currentStatus);
  const normalizedNextIso = normalizeScheduledAt(nextIso);
  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start_at: normalizedNextIso,
      status: nextStatus,
    })
    .eq('id', jobId);
  if (error) throw error;
  return { status: nextStatus, scheduled_start_at: normalizedNextIso };
}

export async function setJobSchedule(jobId, nextIso, nextStatus) {
  const normalizedNextIso = normalizeScheduledAt(nextIso);
  const payload = {
    scheduled_start_at: normalizedNextIso,
  };
  if (nextStatus) payload.status = nextStatus;

  const { error } = await supabase
    .from('jobs')
    .update(payload)
    .eq('id', jobId);
  if (error) throw error;

  return {
    status: nextStatus,
    scheduled_start_at: normalizedNextIso,
  };
}
