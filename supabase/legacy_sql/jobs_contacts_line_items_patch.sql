-- Patch: jobs line_items + job_contacts + cleanup (owner_id schema)
-- Date: 2026-02-13

-- 1) Ensure jobs columns exist
alter table public.jobs
  add column if not exists line_items jsonb,
  add column if not exists arrival_notes text,
  add column if not exists address_place_id text,
  add column if not exists address_lat double precision,
  add column if not exists address_lng double precision;

update public.jobs
set line_items = '[]'::jsonb
where line_items is null;

alter table public.jobs
  alter column line_items set default '[]'::jsonb;

alter table public.jobs
  alter column line_items set not null;

-- 2) Create job_contacts table
create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

create table if not exists public.job_contacts (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  owner_id uuid not null,
  full_name text not null,
  phone text,
  relation text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_contacts_owner_idx
  on public.job_contacts(owner_id, created_at desc);

create index if not exists job_contacts_job_idx
  on public.job_contacts(job_id, sort_order, created_at);

drop trigger if exists trg_job_contacts_updated_at on public.job_contacts;
create trigger trg_job_contacts_updated_at
before update on public.job_contacts
for each row execute function public.set_updated_at();

alter table public.job_contacts enable row level security;

drop policy if exists "job_contacts_select_own" on public.job_contacts;
create policy "job_contacts_select_own"
on public.job_contacts for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "job_contacts_insert_own" on public.job_contacts;
create policy "job_contacts_insert_own"
on public.job_contacts for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "job_contacts_update_own" on public.job_contacts;
create policy "job_contacts_update_own"
on public.job_contacts for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "job_contacts_delete_own" on public.job_contacts;
create policy "job_contacts_delete_own"
on public.job_contacts for delete
to authenticated
using (owner_id = auth.uid());

-- 3) Backfill line_items from agreed_amount when line_items is empty
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
        and (
          j.line_items is null
          or j.line_items = '[]'::jsonb
          or jsonb_array_length(j.line_items) = 0
        );
    $sql$;
  END IF;
END
$$;

-- 4) Backfill legacy single contact fields into job_contacts (first row)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'contact_name'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'jobs'
      AND column_name = 'contact_phone'
  ) THEN
    EXECUTE $sql$
      insert into public.job_contacts (job_id, owner_id, full_name, phone, relation, sort_order)
      select
        j.id,
        j.owner_id,
        coalesce(nullif(trim(j.contact_name), ''), coalesce(nullif(trim(j.client_name), ''), 'איש קשר')),
        nullif(trim(j.contact_phone), ''),
        null,
        0
      from public.jobs j
      where (nullif(trim(j.contact_name), '') is not null or nullif(trim(j.contact_phone), '') is not null)
        and not exists (
          select 1
          from public.job_contacts jc
          where jc.job_id = j.id
        );
    $sql$;
  END IF;
END
$$;

-- 5) Remove legacy columns
alter table public.jobs
  drop column if exists agreed_amount,
  drop column if exists warranty,
  drop column if exists warranty_note;

NOTIFY pgrst, 'reload schema';
