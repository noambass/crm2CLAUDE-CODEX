import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function getKeyFromDb(configType, field = 'api_key') {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from('app_configs')
    .select('config_data')
    .eq('config_type', configType)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  return data?.config_data?.[field] || null;
}

/**
 * Returns the OpenAI API key.
 * Prefers OPENAI_API_KEY env var (Vercel secret), falls back to app_configs DB row.
 */
export async function getOpenAIKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  return getKeyFromDb('openai_api');
}

/**
 * Returns the Anthropic API key.
 * Prefers ANTHROPIC_API_KEY env var, falls back to app_configs DB row.
 */
export async function getAnthropicKey() {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY;
  return getKeyFromDb('anthropic_api');
}
