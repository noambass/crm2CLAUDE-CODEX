import { tool } from 'ai';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { persistSession: false } });
}

export const crmTools = {
  createLead: tool({
    description: 'צור לקוח פוטנציאלי חדש (ליד) במערכת ה-CRM עם פרטי קשר בסיסיים',
    parameters: z.object({
      account_name: z.string().describe('שם הלקוח או החברה'),
      full_name: z.string().describe('שם מלא של איש הקשר'),
      phone: z.string().optional().describe('מספר טלפון'),
      email: z.string().optional().describe('כתובת אימייל'),
      address_text: z.string().optional().describe('כתובת מלאה'),
      notes: z.string().optional().describe('הערות פנימיות על הלקוח'),
    }),
    execute: async ({ account_name, full_name, phone, email, address_text, notes }) => {
      const supabase = getSupabase();

      const { data: account, error: accountError } = await supabase
        .from('accounts')
        .insert([{ account_name, notes: notes || null, status: 'lead', client_type: 'private' }])
        .select('id, account_name, status')
        .single();
      if (accountError) throw accountError;

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert([{
          account_id: account.id,
          full_name,
          phone: phone || null,
          email: email || null,
          address_text: address_text || null,
          is_primary: true,
        }])
        .select('id, full_name, phone')
        .single();
      if (contactError) throw contactError;

      return {
        success: true,
        account_id: account.id,
        account_name: account.account_name,
        contact_id: contact.id,
        message: `ליד חדש נוצר: ${account_name}`,
      };
    },
  }),

  searchCustomer: tool({
    description: 'חפש לקוח קיים במערכת לפי שם, מספר טלפון או אימייל',
    parameters: z.object({
      query: z.string().describe('טקסט חיפוש: שם לקוח, מספר טלפון או אימייל'),
    }),
    execute: async ({ query }) => {
      const supabase = getSupabase();
      const q = query.trim();

      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('id, account_id, full_name, phone, email, address_text, is_primary, role')
        .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
      if (contactsError) throw contactsError;

      if (!contacts || contacts.length === 0) {
        const { data: accounts, error: aError } = await supabase
          .from('accounts')
          .select('id, account_name, status, client_type, notes')
          .ilike('account_name', `%${q}%`);
        if (aError) throw aError;
        return { results: accounts || [], count: accounts?.length || 0 };
      }

      const accountIds = [...new Set(contacts.map((c) => c.account_id))];
      const { data: accounts, error: aError } = await supabase
        .from('accounts')
        .select('id, account_name, status, client_type')
        .in('id', accountIds);
      if (aError) throw aError;

      const accountMap = Object.fromEntries((accounts || []).map((a) => [a.id, a]));
      const results = contacts.map((c) => ({
        contact_id: c.id,
        account_id: c.account_id,
        full_name: c.full_name,
        phone: c.phone,
        email: c.email,
        address_text: c.address_text,
        is_primary: c.is_primary,
        account: accountMap[c.account_id] || null,
      }));

      return { results, count: results.length };
    },
  }),

  updateCustomer: tool({
    description: 'עדכן פרטי לקוח קיים במערכת (חשבון ו/או איש קשר)',
    parameters: z.object({
      account_id: z.string().uuid().describe('מזהה החשבון לעדכון'),
      account_name: z.string().optional().describe('שם החשבון/חברה המעודכן'),
      status: z.enum(['lead', 'active', 'inactive']).optional().describe('סטטוס הלקוח'),
      notes: z.string().optional().describe('הערות פנימיות'),
      contact_id: z.string().uuid().optional().describe('מזהה איש הקשר לעדכון (אופציונלי)'),
      full_name: z.string().optional().describe('שם מלא מעודכן של איש הקשר'),
      phone: z.string().optional().describe('מספר טלפון מעודכן'),
      email: z.string().optional().describe('אימייל מעודכן'),
      address_text: z.string().optional().describe('כתובת מעודכנת'),
    }),
    execute: async ({ account_id, account_name, status, notes, contact_id, full_name, phone, email, address_text }) => {
      const supabase = getSupabase();

      const accountPatch = {};
      if (account_name !== undefined) accountPatch.account_name = account_name;
      if (status !== undefined) accountPatch.status = status;
      if (notes !== undefined) accountPatch.notes = notes;

      if (Object.keys(accountPatch).length > 0) {
        const { error } = await supabase.from('accounts').update(accountPatch).eq('id', account_id);
        if (error) throw error;
      }

      if (contact_id) {
        const contactPatch = {};
        if (full_name !== undefined) contactPatch.full_name = full_name;
        if (phone !== undefined) contactPatch.phone = phone;
        if (email !== undefined) contactPatch.email = email;
        if (address_text !== undefined) contactPatch.address_text = address_text;

        if (Object.keys(contactPatch).length > 0) {
          const { error } = await supabase.from('contacts').update(contactPatch).eq('id', contact_id);
          if (error) throw error;
        }
      }

      return { success: true, account_id, message: 'פרטי הלקוח עודכנו בהצלחה' };
    },
  }),

  createJob: tool({
    description: 'צור עבודה חדשה (ציפוי אמבטיה) עבור לקוח קיים במערכת',
    parameters: z.object({
      account_id: z.string().uuid().describe('מזהה חשבון הלקוח'),
      title: z.string().describe('כותרת העבודה, לדוגמה: ציפוי אמבטיה'),
      description: z.string().optional().describe('תיאור מפורט של העבודה'),
      address_text: z.string().optional().describe('כתובת ביצוע העבודה'),
      priority: z.enum(['normal', 'urgent']).optional().describe('עדיפות: normal (רגיל) או urgent (דחוף)'),
    }),
    execute: async ({ account_id, title, description, address_text, priority }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('jobs')
        .insert([{
          account_id,
          title,
          description: description || null,
          address_text: address_text || null,
          status: 'waiting_schedule',
          priority: priority || 'normal',
          line_items: [],
        }])
        .select('id, title, status, priority')
        .single();
      if (error) throw error;
      return {
        success: true,
        job_id: data.id,
        title: data.title,
        status: data.status,
        message: `עבודה חדשה נוצרה: ${data.title}`,
      };
    },
  }),

  getCustomerJobs: tool({
    description: 'קבל רשימת עבודות קיימות של לקוח ספציפי',
    parameters: z.object({
      account_id: z.string().uuid().describe('מזהה חשבון הלקוח'),
    }),
    execute: async ({ account_id }) => {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('jobs')
        .select('id, title, status, priority, scheduled_start_at, address_text, created_at')
        .eq('account_id', account_id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return { jobs: data || [], count: data?.length || 0 };
    },
  }),
};
