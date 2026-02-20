import { supabase } from '@/api/supabaseClient';
import { normalizeAddressText } from '@/lib/geo/coordsPolicy';

export function getAccountLabel(account) {
  return String(account?.account_name || '').trim() || 'ללא לקוח';
}

export async function listClientProfiles(searchText = '') {
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (accountsError) throw accountsError;

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('is_primary', true)
    .order('created_at', { ascending: true });
  if (contactsError) throw contactsError;

  const primaryByAccount = new Map();
  (contacts || []).forEach((contact) => {
    if (!contact.account_id) return;
    primaryByAccount.set(contact.account_id, contact);
  });

  const profiles = (accounts || []).map((account) => ({
    account,
    primaryContact: primaryByAccount.get(account.id) || null,
  }));

  if (!searchText.trim()) return profiles;
  const q = searchText.toLowerCase();
  return profiles.filter((p) => {
    const c = p.primaryContact;
    return (
      p.account.account_name?.toLowerCase().includes(q) ||
      c?.phone?.includes(q) ||
      c?.email?.toLowerCase().includes(q)
    );
  });
}

export async function getClientProfile(accountId) {
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .select('*')
    .eq('id', accountId)
    .single();
  if (accountError) throw accountError;

  const { data: allContacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (contactsError) throw contactsError;

  const contacts = allContacts || [];
  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0] || null;

  return {
    account,
    primaryContact,
    allContacts: contacts,
  };
}

export async function createClient(input) {
  const isCompanyType = input.clientType === 'company' || input.clientType === 'bath_company';
  const accountName = isCompanyType
    ? (input.companyName || '').trim()
    : (input.fullName || '').trim();
  const contactName = (input.fullName || accountName).trim();

  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert([
      {
        account_name: accountName,
        notes: input.internalNotes || null,
        status: input.status || 'active',
        client_type: input.clientType || 'private',
      },
    ])
    .select('*')
    .single();
  if (accountError) throw accountError;

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert([
      {
        account_id: account.id,
        full_name: contactName,
        role: input.role || null,
        phone: input.phone || null,
        email: input.email || null,
        address_text: normalizeAddressText(input.addressText) || null,
        is_primary: true,
      },
    ])
    .select('*')
    .single();
  if (contactError) throw contactError;

  return { account, primaryContact: contact };
}

export async function updateClient(accountId, input) {
  const isCompanyType = input.clientType === 'company' || input.clientType === 'bath_company';
  const accountName = isCompanyType
    ? (input.companyName || '').trim()
    : (input.fullName || '').trim();
  const contactName = (input.fullName || accountName).trim();

  const { error: accountError } = await supabase
    .from('accounts')
    .update({
      account_name: accountName,
      notes: input.internalNotes || null,
      status: input.status || 'active',
      client_type: input.clientType || 'private',
    })
    .eq('id', accountId);
  if (accountError) throw accountError;

  const { data: primary, error: primaryFetchError } = await supabase
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_primary', true)
    .limit(1)
    .maybeSingle();
  if (primaryFetchError) throw primaryFetchError;

  if (primary?.id) {
    const { error: primaryUpdateError } = await supabase
      .from('contacts')
      .update({
        full_name: contactName,
        role: input.role ?? null,
        phone: input.phone || null,
        email: input.email || null,
        address_text: normalizeAddressText(input.addressText) || null,
      })
      .eq('id', primary.id);
    if (primaryUpdateError) throw primaryUpdateError;
  } else {
    const { error: primaryInsertError } = await supabase
      .from('contacts')
      .insert([
        {
          account_id: accountId,
          full_name: contactName,
          role: input.role || null,
          phone: input.phone || null,
          email: input.email || null,
          address_text: normalizeAddressText(input.addressText) || null,
          is_primary: true,
        },
      ])
      .select('id')
      .single();
    if (primaryInsertError) throw primaryInsertError;
  }
  // Note: non-primary contacts are intentionally preserved
}

export async function deleteClient(accountId) {
  const { error } = await supabase.from('accounts').delete().eq('id', accountId);
  if (error) throw error;
}

export async function findClientByPhone(phone) {
  if (!phone) return null;
  const normalized = String(phone).replace(/\D/g, '');
  if (!normalized) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, account_id, full_name, phone')
    .not('phone', 'is', null);
  if (error) throw error;

  const match = (data || []).find((c) => String(c.phone || '').replace(/\D/g, '') === normalized);
  return match || null;
}

// ─── Contact CRUD ─────────────────────────────────────────────────────────────

export async function addContact(accountId: string, input: {
  full_name: string;
  role?: string;
  phone?: string;
  email?: string;
}) {
  const { data, error } = await supabase
    .from('contacts')
    .insert([
      {
        account_id: accountId,
        full_name: (input.full_name || '').trim(),
        role: input.role?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        is_primary: false,
      },
    ])
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateContactById(contactId: string, input: {
  full_name?: string;
  role?: string;
  phone?: string;
  email?: string;
}) {
  const patch: Record<string, unknown> = {};
  if (input.full_name !== undefined) patch.full_name = (input.full_name || '').trim();
  if (input.role !== undefined) patch.role = input.role?.trim() || null;
  if (input.phone !== undefined) patch.phone = input.phone?.trim() || null;
  if (input.email !== undefined) patch.email = input.email?.trim() || null;

  const { error } = await supabase
    .from('contacts')
    .update(patch)
    .eq('id', contactId);
  if (error) throw error;
}

export async function deleteContactById(contactId: string) {
  const { error } = await supabase
    .from('contacts')
    .delete()
    .eq('id', contactId);
  if (error) throw error;
}

export async function setPrimaryContact(accountId: string, contactId: string) {
  const { error: unsetError } = await supabase
    .from('contacts')
    .update({ is_primary: false })
    .eq('account_id', accountId);
  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
    .from('contacts')
    .update({ is_primary: true })
    .eq('id', contactId);
  if (setError) throw setError;
}
