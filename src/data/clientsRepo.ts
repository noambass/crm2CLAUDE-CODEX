import { supabase } from '@/api/supabaseClient';

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
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (contactsError) throw contactsError;

  const contactsByAccount = new Map();
  (contacts || []).forEach((contact) => {
    if (!contactsByAccount.has(contact.account_id)) contactsByAccount.set(contact.account_id, []);
    contactsByAccount.get(contact.account_id).push(contact);
  });

  const profiles = (accounts || []).map((account) => {
    const accountContacts = contactsByAccount.get(account.id) || [];
    return {
      account,
      contacts: accountContacts,
      primaryContact: accountContacts.find((c) => c.is_primary) || accountContacts[0] || null,
    };
  });

  if (!searchText.trim()) return profiles;
  const q = searchText.toLowerCase();
  return profiles.filter((p) => {
    const c = p.primaryContact;
    return (
      p.account.account_name?.toLowerCase().includes(q) ||
      c?.full_name?.toLowerCase().includes(q) ||
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

  const { data: contacts, error: contactsError } = await supabase
    .from('contacts')
    .select('*')
    .eq('account_id', accountId)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true });
  if (contactsError) throw contactsError;

  const allContacts = contacts || [];
  return {
    account,
    contacts: allContacts,
    primaryContact: allContacts.find((c) => c.is_primary) || allContacts[0] || null,
  };
}

export async function createClient(input) {
  const accountName = (input.fullName || '').trim();
  const { data: account, error: accountError } = await supabase
    .from('accounts')
    .insert([{
      account_name: accountName,
      notes: input.internalNotes || null,
      status: input.status || 'active',
      client_type: input.clientType || 'private',
    }])
    .select('*')
    .single();
  if (accountError) throw accountError;

  const { data: contact, error: contactError } = await supabase
    .from('contacts')
    .insert([{
      account_id: account.id,
      full_name: accountName,
      phone: input.phone || null,
      email: input.email || null,
      address_text: input.addressText || null,
      is_primary: true,
    }])
    .select('*')
    .single();
  if (contactError) throw contactError;

  return { account, primaryContact: contact };
}

export async function updateClient(accountId, input) {
  const fullName = (input.fullName || '').trim();
  const { error: accountError } = await supabase
    .from('accounts')
    .update({
      account_name: fullName,
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
        full_name: fullName,
        phone: input.phone || null,
        email: input.email || null,
        address_text: input.addressText || null,
      })
      .eq('id', primary.id);
    if (primaryUpdateError) throw primaryUpdateError;
  } else {
    const { error: primaryInsertError } = await supabase
      .from('contacts')
      .insert([{
        account_id: accountId,
        full_name: fullName,
        phone: input.phone || null,
        email: input.email || null,
        address_text: input.addressText || null,
        is_primary: true,
      }]);
    if (primaryInsertError) throw primaryInsertError;
  }
}

export async function deleteClient(accountId) {
  const { error } = await supabase
    .from('accounts')
    .delete()
    .eq('id', accountId);
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

