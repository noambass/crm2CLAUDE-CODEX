import { generateText } from 'ai';
import { createClient } from '@supabase/supabase-js';
import { createChatModel } from '../lib/ai/config.js';
import { getOpenAIKey } from '../lib/ai/getApiKeys.js';
import { crmTools } from '../lib/ai/tools.js';
import { chatSystemPrompt } from '../lib/ai/prompts.js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// POST /api/ai/chat
// Body: { message: string, conversationId?: string, phoneNumber?: string }
// Returns: { reply: string, conversationId: string }
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, conversationId, phoneNumber = 'web' } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }

  const supabase = getSupabase();
  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  try {
    // Resolve OpenAI key (env var or DB)
    const openAIKey = await getOpenAIKey();
    if (!openAIKey) {
      return res.status(503).json({ error: 'מפתח OpenAI לא מוגדר — הגדר אותו בהגדרות האינטגרציות' });
    }

    // Get or create conversation
    let convId = conversationId || null;

    if (!convId) {
      const { data: conv, error: convError } = await supabase
        .from('conversations')
        .insert([{ phone_number: phoneNumber, channel: 'web', status: 'open' }])
        .select('id')
        .single();
      if (convError) throw convError;
      convId = conv.id;
    }

    // Fetch conversation history (last 20 user/assistant messages)
    const { data: history, error: historyError } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', convId)
      .in('role', ['user', 'assistant'])
      .order('created_at', { ascending: true })
      .limit(20);
    if (historyError) throw historyError;

    const messages = [
      ...(history || []).map((m) => ({
        role: m.role,
        content: m.content || '',
      })),
      { role: 'user', content: message.trim() },
    ];

    // Call GPT-4o-mini with CRM tools
    const { text } = await generateText({
      model: createChatModel(openAIKey),
      system: chatSystemPrompt,
      messages,
      tools: crmTools,
      maxSteps: 5,
    });

    // Persist new messages
    await supabase.from('messages').insert([
      { conversation_id: convId, role: 'user', content: message.trim() },
      { conversation_id: convId, role: 'assistant', content: text },
    ]);

    return res.status(200).json({ reply: text, conversationId: convId });
  } catch (error) {
    console.error('AI chat error:', error);
    return res.status(500).json({
      error: 'שגיאה פנימית בעיבוד ההודעה',
      details: String(error?.message || error),
    });
  }
}
