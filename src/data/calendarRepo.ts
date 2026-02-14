import { supabase } from '@/api/supabaseClient';

export async function listScheduledJobs(fromIso, toIso) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .gte('scheduled_start_at', fromIso)
    .lte('scheduled_start_at', toIso)
    .order('scheduled_start_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listUnscheduledJobs() {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .is('scheduled_start_at', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function rescheduleJob(jobId, nextIso) {
  const { error } = await supabase
    .from('jobs')
    .update({
      scheduled_start_at: nextIso,
      status: 'waiting_execution',
    })
    .eq('id', jobId);
  if (error) throw error;
}
