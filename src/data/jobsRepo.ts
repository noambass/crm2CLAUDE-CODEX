import { supabase } from '@/api/supabaseClient';

export async function listJobsByAccount(accountId) {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}
