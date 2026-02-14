import { supabase } from '@/api/supabaseClient';
import { normalizeAddressText } from '@/lib/geo/coordsPolicy';

export function getQuoteAccountName(quote) {
  const relation = Array.isArray(quote?.accounts) ? quote.accounts[0] : quote?.accounts;
  return relation?.account_name || 'ללא לקוח';
}

export async function listQuotes() {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, accounts(id, account_name), quote_items(*)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((q) => ({
    ...q,
    quote_items: (q.quote_items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  }));
}

export async function getQuote(quoteId) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, accounts(id, account_name), quote_items(*)')
    .eq('id', quoteId)
    .single();
  if (error) throw error;
  return {
    ...data,
    quote_items: (data.quote_items || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
  };
}

export async function saveDraftQuote(input) {
  if (!input.accountId) {
    throw new Error('חובה לבחור לקוח');
  }
  if (!Array.isArray(input.items) || input.items.length === 0) {
    throw new Error('חובה להוסיף לפחות שורה אחת להצעה');
  }

  const normalizedTitle = String(input.title || '').trim();
  const normalizedDescription = String(input.description || '').trim();
  const normalizedAddress = normalizeAddressText(input.addressText);
  const normalizedArrivalNotes = String(input.arrivalNotes || '').trim();
  const normalizedNotes = String(input.notes || '').trim();

  const quotePayload = {
    account_id: input.accountId,
    status: 'draft',
    title: normalizedTitle || null,
    description: normalizedDescription || null,
    notes: normalizedNotes || null,
    address_text: normalizedAddress || null,
    arrival_notes: normalizedArrivalNotes || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    scheduled_start_at: input.scheduledStartAt || null,
  };

  let quoteId = input.quoteId;
  if (quoteId) {
    const { data: existing, error: existingError } = await supabase
      .from('quotes')
      .select('id, status, converted_job_id')
      .eq('id', quoteId)
      .single();
    if (existingError) throw existingError;

    if (existing.status !== 'draft') {
      throw new Error('ניתן לערוך הצעה רק במצב טיוטה');
    }
    if (existing.converted_job_id) {
      throw new Error('לא ניתן לערוך הצעה שהומרה לעבודה');
    }

    const { error } = await supabase
      .from('quotes')
      .update(quotePayload)
      .eq('id', quoteId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase
      .from('quotes')
      .insert([quotePayload])
      .select('id')
      .single();
    if (error) throw error;
    quoteId = data.id;
  }

  const { error: deleteItemsError } = await supabase
    .from('quote_items')
    .delete()
    .eq('quote_id', quoteId);
  if (deleteItemsError) throw deleteItemsError;

  const insertItems = input.items.map((item, idx) => ({
    quote_id: quoteId,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    line_total: item.quantity * item.unitPrice,
    sort_order: idx,
  }));

  const { error: itemsError } = await supabase
    .from('quote_items')
    .insert(insertItems);
  if (itemsError) throw itemsError;

  return quoteId;
}

export async function updateQuoteStatus(quoteId, status) {
  const allowed = new Set(['draft', 'sent', 'approved', 'rejected']);
  if (!allowed.has(status)) {
    throw new Error('סטטוס הצעה לא חוקי');
  }

  const { error } = await supabase
    .from('quotes')
    .update({ status })
    .eq('id', quoteId);
  if (error) throw error;
}

export async function listQuotesByAccount(accountId) {
  const { data, error } = await supabase
    .from('quotes')
    .select('*, quote_items(*)')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function convertQuoteToJob(quoteId) {
  const { data, error } = await supabase.rpc('convert_quote_to_job', { p_quote_id: quoteId });
  if (error) throw error;
  return data;
}
