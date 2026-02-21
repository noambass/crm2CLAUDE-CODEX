import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { createBiModel } from './config.js';
import { getAnthropicKey } from './getApiKeys.js';
import { biSystemPrompt, DB_SCHEMA } from './prompts.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Answers a BI question in Hebrew:
 * 1. Sends the question to Claude with the DB schema
 * 2. Claude returns a SELECT SQL + Hebrew explanation
 * 3. Executes the SQL via exec_readonly_sql RPC
 * 4. Returns { answer, sql, data, row_count }
 */
export async function answerBiQuestion(question) {
  const anthropicKey = await getAnthropicKey();
  if (!anthropicKey) {
    throw new Error('מפתח Anthropic לא מוגדר — הגדר אותו בהגדרות האינטגרציות');
  }

  const { text } = await generateText({
    model: createBiModel(anthropicKey),
    system: biSystemPrompt(DB_SCHEMA),
    prompt: question,
  });

  let parsed;
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : text);
  } catch {
    throw new Error('לא הצלחתי לפרש את תשובת המודל — תשובה לא תקינה');
  }

  const { sql, explanation } = parsed;
  if (!sql || typeof sql !== 'string') {
    throw new Error('המודל לא החזיר שאילתת SQL');
  }

  const normalized = sql.trim().toLowerCase();
  if (!normalized.startsWith('select')) {
    throw new Error('שאילתה לא תקינה — מותר SELECT בלבד');
  }

  const supabase = getSupabase();
  const { data, error } = await supabase.rpc('exec_readonly_sql', { query: sql });
  if (error) throw new Error(`שגיאה בביצוע SQL: ${error.message}`);

  const rows = Array.isArray(data) ? data : [];

  return {
    answer: explanation || '',
    sql,
    data: rows,
    row_count: rows.length,
  };
}
