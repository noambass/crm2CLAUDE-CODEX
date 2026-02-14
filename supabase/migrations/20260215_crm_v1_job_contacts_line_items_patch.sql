-- Patch for existing CRM v1 databases (no reset required)
-- Date: 2026-02-13
-- Purpose: move jobs to line_items + job_contacts, remove warranty/agreed legacy fields

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'account_id'
  ) THEN
    RAISE EXCEPTION
      'CRM v1 patch requires public.jobs.account_id. This database looks like owner_id schema. Run supabase/jobs_contacts_line_items_patch.sql instead.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
      AND column_name = 'account_id'
  ) OR NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'account_id'
  ) THEN
    RAISE EXCEPTION
      'CRM v1 patch requires account_id-based quotes/contacts tables. This database is not a compatible CRM v1 schema.';
  END IF;
END
$$;

alter table public.jobs
  add column if not exists line_items jsonb,
  add column if not exists arrival_notes text;

update public.jobs
set line_items = '[]'::jsonb
where line_items is null;

alter table public.jobs
  alter column line_items set default '[]'::jsonb;

alter table public.jobs
  alter column line_items set not null;

create table if not exists public.job_contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  full_name text not null,
  phone text,
  relation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

DO $$
BEGIN
  -- If job_contacts already exists from owner_id schema, align it to v1 account_id schema.
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'job_contacts'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_contacts'
      AND column_name = 'account_id'
  ) THEN
    ALTER TABLE public.job_contacts
      ADD COLUMN account_id uuid;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_contacts'
      AND column_name = 'account_id'
  ) THEN
    UPDATE public.job_contacts jc
    SET account_id = j.account_id
    FROM public.jobs j
    WHERE jc.job_id = j.id
      AND jc.account_id IS NULL;

    ALTER TABLE public.job_contacts
      ALTER COLUMN account_id SET NOT NULL;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'job_contacts_account_id_fkey'
        AND conrelid = 'public.job_contacts'::regclass
    ) THEN
      ALTER TABLE public.job_contacts
        ADD CONSTRAINT job_contacts_account_id_fkey
        FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_contacts'
      AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.job_contacts
      DROP COLUMN owner_id;
  END IF;
END
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

drop trigger if exists trg_job_contacts_updated_at on public.job_contacts;
create trigger trg_job_contacts_updated_at
before update on public.job_contacts
for each row execute function public.set_updated_at();

create index if not exists job_contacts_job_idx
  on public.job_contacts(job_id, sort_order, created_at);

create index if not exists job_contacts_account_idx
  on public.job_contacts(account_id, created_at desc);

alter table public.job_contacts enable row level security;

drop policy if exists job_contacts_auth_all_select on public.job_contacts;
create policy job_contacts_auth_all_select
on public.job_contacts for select
to authenticated
using (auth.uid() is not null);

drop policy if exists job_contacts_auth_all_insert on public.job_contacts;
create policy job_contacts_auth_all_insert
on public.job_contacts for insert
to authenticated
with check (auth.uid() is not null);

drop policy if exists job_contacts_auth_all_update on public.job_contacts;
create policy job_contacts_auth_all_update
on public.job_contacts for update
to authenticated
using (auth.uid() is not null)
with check (auth.uid() is not null);

drop policy if exists job_contacts_auth_all_delete on public.job_contacts;
create policy job_contacts_auth_all_delete
on public.job_contacts for delete
to authenticated
using (auth.uid() is not null);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'agreed_amount'
  ) THEN
    EXECUTE $sql$
      update public.jobs j
      set line_items = jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'description', coalesce(nullif(trim(j.title), ''), 'סכום היסטורי'),
          'quantity', 1,
          'unit_price', j.agreed_amount,
          'line_total', j.agreed_amount
        )
      )
      where coalesce(j.agreed_amount, 0) > 0
        and (j.line_items is null or j.line_items = '[]'::jsonb or jsonb_array_length(j.line_items) = 0);
    $sql$;
  END IF;
END
$$;

alter table public.jobs
  drop column if exists agreed_amount,
  drop column if exists warranty_included,
  drop column if exists warranty_explanation;

create or replace function public.convert_quote_to_job(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_quote record;
  v_primary_contact record;
  v_job_id uuid;
  v_title text;
  v_line_items jsonb;
begin
  select q.*
  into v_quote
  from public.quotes q
  where q.id = p_quote_id
  for update;

  if not found then
    raise exception 'Quote not found';
  end if;

  if v_quote.status <> 'approved' then
    raise exception 'Only approved quote can be converted';
  end if;

  if v_quote.converted_job_id is not null then
    raise exception 'Quote already converted';
  end if;

  select c.*
  into v_primary_contact
  from public.contacts c
  where c.account_id = v_quote.account_id
  order by c.is_primary desc, c.created_at asc
  limit 1;

  select string_agg(qi.description, ', ' order by qi.sort_order, qi.created_at)
    into v_title
  from public.quote_items qi
  where qi.quote_id = p_quote_id;

  if v_title is null or length(trim(v_title)) = 0 then
    v_title := 'Job from approved quote';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', qi.id::text,
        'description', qi.description,
        'quantity', qi.quantity,
        'unit_price', qi.unit_price,
        'line_total', qi.line_total
      )
      order by qi.sort_order, qi.created_at
    ),
    '[]'::jsonb
  )
  into v_line_items
  from public.quote_items qi
  where qi.quote_id = p_quote_id;

  if jsonb_array_length(v_line_items) = 0 then
    raise exception 'Quote must include at least one line item';
  end if;

  insert into public.jobs (
    account_id,
    quote_id,
    assigned_to,
    title,
    description,
    status,
    priority,
    address_text,
    line_items
  ) values (
    v_quote.account_id,
    v_quote.id,
    'owner',
    left(v_title, 255),
    v_quote.notes,
    'waiting_schedule',
    'normal',
    coalesce(v_primary_contact.address_text, null),
    v_line_items
  )
  returning id into v_job_id;

  update public.quotes
    set converted_job_id = v_job_id,
        updated_at = now()
  where id = p_quote_id;

  return v_job_id;
end;
$fn$;

revoke all on function public.convert_quote_to_job(uuid) from public;
grant execute on function public.convert_quote_to_job(uuid) to authenticated;

NOTIFY pgrst, 'reload schema';
