import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

const FIXTURE_PREFIX = '[UAT-FIXTURE]';

function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
    out[key] = value;
  }
  return out;
}

function envValue(name, fallbackEnv) {
  return process.env[name] || fallbackEnv[name] || '';
}

function toIsoOffset(days, hh = 9, mm = 0) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hh, mm, 0, 0);
  return date.toISOString();
}

function lineItemsPayload(lines) {
  return lines.map((line, index) => {
    const quantity = Number(line.quantity) || 1;
    const unitPrice = Number(line.unitPrice) || 0;
    return {
      id: `${line.id || `line-${index + 1}`}`,
      description: line.description,
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice,
    };
  });
}

async function createAuthedClient(localEnv) {
  const url = envValue('VITE_SUPABASE_URL', localEnv);
  if (!url) throw new Error('Missing VITE_SUPABASE_URL');

  const serviceRoleKey = envValue('SUPABASE_SERVICE_ROLE_KEY', localEnv);
  if (serviceRoleKey) {
    return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  const anonKey = envValue('VITE_SUPABASE_ANON_KEY', localEnv);
  const email = envValue('SEED_LOGIN_EMAIL', localEnv) || envValue('E2E_LOGIN_EMAIL', localEnv);
  const password = envValue('SEED_LOGIN_PASSWORD', localEnv) || envValue('E2E_LOGIN_PASSWORD', localEnv);

  if (!anonKey || !email || !password) {
    throw new Error(
      'Missing credentials. Provide SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY + (SEED_LOGIN_EMAIL/SEED_LOGIN_PASSWORD).'
    );
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError) throw signInError;
  return client;
}

async function cleanupExistingFixtures(supabase) {
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('id, account_name')
    .ilike('account_name', `${FIXTURE_PREFIX}%`);

  if (accountsError) throw accountsError;
  const accountIds = (accounts || []).map((row) => row.id);
  if (accountIds.length === 0) {
    return { deletedAccounts: 0, deletedQuotes: 0, deletedJobs: 0 };
  }

  const { data: quotes, error: quotesError } = await supabase
    .from('quotes')
    .select('id')
    .in('account_id', accountIds);
  if (quotesError) throw quotesError;
  const quoteIds = (quotes || []).map((row) => row.id);

  const { data: jobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id')
    .in('account_id', accountIds);
  if (jobsError) throw jobsError;
  const jobIds = (jobs || []).map((row) => row.id);

  if (quoteIds.length > 0) {
    const { error } = await supabase.from('quote_items').delete().in('quote_id', quoteIds);
    if (error) throw error;
  }

  if (jobIds.length > 0) {
    const { error: contactsError } = await supabase.from('job_contacts').delete().in('job_id', jobIds);
    if (contactsError) throw contactsError;
  }

  if (jobIds.length > 0) {
    const { error } = await supabase.from('jobs').delete().in('id', jobIds);
    if (error) throw error;
  }

  if (quoteIds.length > 0) {
    const { error } = await supabase.from('quotes').delete().in('id', quoteIds);
    if (error) throw error;
  }

  const { error: contactsCleanupError } = await supabase.from('contacts').delete().in('account_id', accountIds);
  if (contactsCleanupError) throw contactsCleanupError;

  const { error: accountsCleanupError } = await supabase.from('accounts').delete().in('id', accountIds);
  if (accountsCleanupError) throw accountsCleanupError;

  return {
    deletedAccounts: accountIds.length,
    deletedQuotes: quoteIds.length,
    deletedJobs: jobIds.length,
  };
}

async function insertFixtures(supabase) {
  const accountRows = [
    { key: 'private', account_name: `${FIXTURE_PREFIX} פרטי`, client_type: 'private', status: 'active' },
    { key: 'company', account_name: `${FIXTURE_PREFIX} חברה`, client_type: 'company', status: 'active' },
    { key: 'bath', account_name: `${FIXTURE_PREFIX} חברת אמבטיות`, client_type: 'bath_company', status: 'active' },
  ];

  const insertedAccounts = {};
  for (const row of accountRows) {
    const { data, error } = await supabase
      .from('accounts')
      .insert([{ account_name: row.account_name, client_type: row.client_type, status: row.status }])
      .select('id, account_name, client_type, status')
      .single();
    if (error) throw error;
    insertedAccounts[row.key] = data;
  }

  const contacts = [
    {
      account_id: insertedAccounts.private.id,
      full_name: 'איש קשר פרטי',
      phone: '0500000011',
      email: 'fixture-private@example.com',
      address_text: 'הרצל 10, אשדוד',
      is_primary: true,
    },
    {
      account_id: insertedAccounts.company.id,
      full_name: 'איש קשר חברה',
      phone: '0500000022',
      email: 'fixture-company@example.com',
      address_text: 'רוטשילד 1, תל אביב',
      is_primary: true,
    },
    {
      account_id: insertedAccounts.bath.id,
      full_name: 'איש קשר אמבטיות',
      phone: '0500000033',
      email: 'fixture-bath@example.com',
      address_text: 'החרושת 8, חולון',
      is_primary: true,
    },
  ];
  const { error: contactsInsertError } = await supabase.from('contacts').insert(contacts);
  if (contactsInsertError) throw contactsInsertError;

  const quoteSeeds = [
    { key: 'draft', account_id: insertedAccounts.private.id, title: `${FIXTURE_PREFIX} הצעה טיוטה` },
    { key: 'sent', account_id: insertedAccounts.company.id, title: `${FIXTURE_PREFIX} הצעה נשלחה` },
    { key: 'approved', account_id: insertedAccounts.bath.id, title: `${FIXTURE_PREFIX} הצעה מאושרת` },
  ];

  const quotesByKey = {};
  for (const seed of quoteSeeds) {
    const { data, error } = await supabase
      .from('quotes')
      .insert([
        {
          account_id: seed.account_id,
          status: 'draft',
          title: seed.title,
          description: 'הצעת בדיקה אוטומטית',
          address_text: 'הרצל 10, אשדוד',
          arrival_notes: 'כניסה צדדית',
        },
      ])
      .select('id, account_id, status, title')
      .single();
    if (error) throw error;
    quotesByKey[seed.key] = data;

    const { error: lineError } = await supabase.from('quote_items').insert([
      {
        quote_id: data.id,
        description: 'ציפוי אמבטיה',
        quantity: 1,
        unit_price: 1200,
        line_total: 1200,
        sort_order: 0,
      },
      {
        quote_id: data.id,
        description: 'תוספת שירות',
        quantity: 1,
        unit_price: 300,
        line_total: 300,
        sort_order: 1,
      },
    ]);
    if (lineError) throw lineError;
  }

  const { error: sentStatusError } = await supabase
    .from('quotes')
    .update({ status: 'sent' })
    .eq('id', quotesByKey.sent.id);
  if (sentStatusError) throw sentStatusError;

  const { error: approvedStatusError } = await supabase
    .from('quotes')
    .update({ status: 'approved' })
    .eq('id', quotesByKey.approved.id);
  if (approvedStatusError) throw approvedStatusError;

  const { data: convertedJobId, error: convertError } = await supabase.rpc('convert_quote_to_job', {
    p_quote_id: quotesByKey.approved.id,
  });
  if (convertError) throw convertError;

  const manualJobs = [
    {
      account_id: insertedAccounts.private.id,
      title: `${FIXTURE_PREFIX} עבודה ממתינה לתזמון`,
      status: 'waiting_schedule',
      address_text: 'הרצל 10, אשדוד',
      scheduled_start_at: null,
      line_items: lineItemsPayload([{ description: 'שירות בסיסי', quantity: 1, unitPrice: 900 }]),
    },
    {
      account_id: insertedAccounts.company.id,
      title: `${FIXTURE_PREFIX} עבודה מתוזמנת`,
      status: 'waiting_execution',
      address_text: 'רוטשילד 1, תל אביב',
      scheduled_start_at: toIsoOffset(1, 10, 0),
      line_items: lineItemsPayload([{ description: 'שירות מתוזמן', quantity: 2, unitPrice: 650 }]),
    },
    {
      account_id: insertedAccounts.bath.id,
      title: `${FIXTURE_PREFIX} עבודה שבוצעה`,
      status: 'done',
      address_text: 'החרושת 8, חולון',
      scheduled_start_at: toIsoOffset(-1, 9, 30),
      line_items: lineItemsPayload([{ description: 'שירות שבוצע', quantity: 1, unitPrice: 1800 }]),
    },
  ];

  const insertedJobs = [];
  for (const job of manualJobs) {
    const { data, error } = await supabase
      .from('jobs')
      .insert([job])
      .select('id, title, status, scheduled_start_at')
      .single();
    if (error) throw error;
    insertedJobs.push(data);
  }

  if (insertedJobs.length > 0) {
    const { error: contactsError } = await supabase.from('job_contacts').insert([
      {
        job_id: insertedJobs[0].id,
        account_id: insertedAccounts.private.id,
        full_name: 'איש קשר עבודה 1',
        phone: '0501111111',
        relation: 'primary',
        sort_order: 0,
      },
      {
        job_id: insertedJobs[0].id,
        account_id: insertedAccounts.private.id,
        full_name: 'איש קשר עבודה נוסף',
        phone: '0502222222',
        relation: 'תיאום הגעה',
        sort_order: 1,
      },
    ]);
    if (contactsError) throw contactsError;
  }

  return {
    accounts: Object.values(insertedAccounts).length,
    quotes: Object.values(quotesByKey).length,
    manualJobs: insertedJobs.length,
    convertedJobId: typeof convertedJobId === 'string' ? convertedJobId : String(convertedJobId || ''),
  };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = !args.has('--apply');
  const localEnv = loadDotEnv(path.resolve('.env.local'));
  const supabase = await createAuthedClient(localEnv);

  const cleanupStats = await cleanupExistingFixtures(supabase);

  if (dryRun) {
    console.log('[seed-workflow-fixtures] dry-run');
    console.log(JSON.stringify({ cleanupStats }, null, 2));
    console.log('Run with --apply to insert fixtures.');
    return;
  }

  const seeded = await insertFixtures(supabase);
  console.log('[seed-workflow-fixtures] done');
  console.log(JSON.stringify({ cleanupStats, seeded }, null, 2));
}

main().catch((error) => {
  console.error('[seed-workflow-fixtures] failed');
  console.error(error);
  process.exit(1);
});

