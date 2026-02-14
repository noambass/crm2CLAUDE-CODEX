-- CRM v1 clean-start schema (single-tenant authenticated)
-- Date: 2026-02-13

-- Clean start (no legacy backfill): drop previous CRM schema objects.
drop table if exists public.job_attachments cascade;
drop table if exists public.quote_items cascade;
drop table if exists public.quotes cascade;
drop table if exists public.jobs cascade;
drop table if exists public.contacts cascade;
drop table if exists public.accounts cascade;
drop table if exists public.geo_cache cascade;
drop table if exists public.route_cache cascade;

-- Legacy objects from earlier schema iterations.
drop table if exists public.services cascade;
drop table if exists public.job_items cascade;
drop table if exists public.job_contacts cascade;
drop table if exists public.attachments cascade;
drop table if exists public.job_reports cascade;
drop table if exists public.app_settings cascade;

drop type if exists public.account_type cascade;
drop type if exists public.account_status cascade;
drop type if exists public.payment_status cascade;
drop type if exists public.attachment_type cascade;
drop type if exists public.quote_status cascade;
drop type if exists public.job_status cascade;
drop type if exists public.job_priority cascade;

create extension if not exists "pgcrypto";

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'quote_status') THEN
    CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'approved', 'rejected');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status') THEN
    CREATE TYPE job_status AS ENUM ('quote', 'waiting_schedule', 'waiting_execution', 'done');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_priority') THEN
    CREATE TYPE job_priority AS ENUM ('normal', 'urgent');
  END IF;
END
$$;

-- Common updated_at trigger function
create or replace function public.set_updated_at()
returns trigger language plpgsql as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- Accounts (logical customer entity)
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  account_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Contacts (customer details)
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  full_name text not null,
  phone text,
  email text,
  address_text text,
  notes text,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Quotes
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  status quote_status not null default 'draft',
  notes text,
  total numeric(12,2) not null default 0,
  converted_job_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Quote items
create table if not exists public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric(12,2) not null,
  unit_price numeric(12,2) not null,
  line_total numeric(12,2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quote_items_quantity_gt_zero check (quantity > 0),
  constraint quote_items_unit_price_gte_zero check (unit_price >= 0)
);

-- Jobs
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  assigned_to text not null default 'owner',
  title text not null,
  description text,
  status job_status not null default 'waiting_schedule',
  priority job_priority not null default 'normal',
  address_text text,
  arrival_notes text,
  lat numeric(9,6),
  lng numeric(9,6),
  scheduled_start_at timestamptz,
  estimated_duration_minutes integer not null default 180,
  line_items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.quotes
  drop constraint if exists quotes_converted_job_id_fkey;
alter table public.quotes
  add constraint quotes_converted_job_id_fkey
  foreign key (converted_job_id) references public.jobs(id) on delete set null;

-- Attachments for jobs
create table if not exists public.job_attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  bucket text not null,
  object_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- Geocoding cache
create table if not exists public.geo_cache (
  id uuid primary key default gen_random_uuid(),
  address_hash text not null unique,
  normalized_address text not null,
  lat numeric(9,6) not null,
  lng numeric(9,6) not null,
  provider text not null default 'nominatim',
  created_at timestamptz not null default now()
);

-- Route cache
create table if not exists public.route_cache (
  id uuid primary key default gen_random_uuid(),
  origin_lat numeric(9,6) not null,
  origin_lng numeric(9,6) not null,
  dest_lat numeric(9,6) not null,
  dest_lng numeric(9,6) not null,
  departure_bucket timestamptz not null,
  duration_seconds integer not null,
  distance_meters integer not null,
  provider text not null default 'osrm',
  created_at timestamptz not null default now(),
  unique (origin_lat, origin_lng, dest_lat, dest_lng, departure_bucket)
);

-- quote item -> quote total sync
create or replace function public.recompute_quote_total(p_quote_id uuid)
returns void language plpgsql as $fn$
declare
  v_total numeric(12,2);
begin
  if p_quote_id is null then
    return;
  end if;

  select coalesce(sum(line_total), 0)::numeric(12,2)
    into v_total
  from public.quote_items
  where quote_id = p_quote_id;

  update public.quotes
    set total = v_total,
        updated_at = now()
  where id = p_quote_id;
end;
$fn$;

create or replace function public.quote_items_compute_line_total_trigger()
returns trigger language plpgsql as $fn$
begin
  new.line_total := round((new.quantity * new.unit_price)::numeric, 2);
  return new;
end;
$fn$;

create or replace function public.enforce_quote_items_editable_only_in_draft()
returns trigger language plpgsql as $fn$
declare
  v_quote_status quote_status;
  v_quote_id uuid;
  v_converted_job_id uuid;
begin
  v_quote_id := coalesce(new.quote_id, old.quote_id);

  select q.status, q.converted_job_id
    into v_quote_status, v_converted_job_id
  from public.quotes q
  where q.id = v_quote_id;

  if v_quote_status is null then
    raise exception 'Quote not found for quote item operation';
  end if;

  if v_converted_job_id is not null then
    raise exception 'Quote that was converted to job cannot be edited';
  end if;

  if v_quote_status <> 'draft' then
    raise exception 'Quote items can be edited only when quote is in draft status';
  end if;

  return coalesce(new, old);
end;
$fn$;

create or replace function public.quote_items_recompute_total_trigger()
returns trigger language plpgsql as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.quote_id is distinct from new.quote_id then
      perform public.recompute_quote_total(old.quote_id);
      perform public.recompute_quote_total(new.quote_id);
    else
      perform public.recompute_quote_total(new.quote_id);
    end if;
  elsif tg_op = 'INSERT' then
    perform public.recompute_quote_total(new.quote_id);
  elsif tg_op = 'DELETE' then
    perform public.recompute_quote_total(old.quote_id);
  end if;

  return coalesce(new, old);
end;
$fn$;

drop trigger if exists trg_quote_items_compute_line_total_ins on public.quote_items;
create trigger trg_quote_items_compute_line_total_ins
before insert on public.quote_items
for each row execute function public.quote_items_compute_line_total_trigger();

drop trigger if exists trg_quote_items_compute_line_total_upd on public.quote_items;
create trigger trg_quote_items_compute_line_total_upd
before update on public.quote_items
for each row execute function public.quote_items_compute_line_total_trigger();

drop trigger if exists trg_quote_items_enforce_draft_ins on public.quote_items;
create trigger trg_quote_items_enforce_draft_ins
before insert on public.quote_items
for each row execute function public.enforce_quote_items_editable_only_in_draft();

drop trigger if exists trg_quote_items_enforce_draft_upd on public.quote_items;
create trigger trg_quote_items_enforce_draft_upd
before update on public.quote_items
for each row execute function public.enforce_quote_items_editable_only_in_draft();

drop trigger if exists trg_quote_items_enforce_draft_del on public.quote_items;
create trigger trg_quote_items_enforce_draft_del
before delete on public.quote_items
for each row execute function public.enforce_quote_items_editable_only_in_draft();

drop trigger if exists trg_quote_items_sync_total_ins on public.quote_items;
create trigger trg_quote_items_sync_total_ins
after insert on public.quote_items
for each row execute function public.quote_items_recompute_total_trigger();

drop trigger if exists trg_quote_items_sync_total_upd on public.quote_items;
create trigger trg_quote_items_sync_total_upd
after update on public.quote_items
for each row execute function public.quote_items_recompute_total_trigger();

drop trigger if exists trg_quote_items_sync_total_del on public.quote_items;
create trigger trg_quote_items_sync_total_del
after delete on public.quote_items
for each row execute function public.quote_items_recompute_total_trigger();

create or replace function public.enforce_quote_header_editable_only_in_draft()
returns trigger language plpgsql as $fn$
begin
  if old.converted_job_id is not null then
    if new.notes is distinct from old.notes then
      raise exception 'Quote that was converted to job cannot be edited';
    end if;

    if new.account_id is distinct from old.account_id then
      raise exception 'Quote that was converted to job cannot be edited';
    end if;
  end if;

  if old.status <> 'draft' then
    if new.notes is distinct from old.notes then
      raise exception 'Quote notes can be edited only when quote is in draft status';
    end if;

    if new.account_id is distinct from old.account_id then
      raise exception 'Quote account cannot be changed when quote is not in draft status';
    end if;
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_quotes_enforce_draft_edit on public.quotes;
create trigger trg_quotes_enforce_draft_edit
before update on public.quotes
for each row execute function public.enforce_quote_header_editable_only_in_draft();

create or replace function public.enforce_quote_status_transition()
returns trigger language plpgsql as $fn$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.converted_job_id is not null and new.status <> old.status then
    raise exception 'Quote status cannot change after conversion to job';
  end if;

  -- Allowed transitions:
  -- draft -> sent|approved|rejected
  -- sent -> approved|rejected|draft
  -- approved -> approved
  -- rejected -> rejected|draft
  if old.status = 'draft' and new.status in ('sent', 'approved', 'rejected') then
    return new;
  end if;

  if old.status = 'sent' and new.status in ('approved', 'rejected', 'draft') then
    return new;
  end if;

  if old.status = 'approved' and new.status = 'approved' then
    return new;
  end if;

  if old.status = 'rejected' and new.status in ('rejected', 'draft') then
    return new;
  end if;

  raise exception 'Invalid quote status transition: % -> %', old.status, new.status;
end;
$fn$;

drop trigger if exists trg_quotes_enforce_status_transition on public.quotes;
create trigger trg_quotes_enforce_status_transition
before update on public.quotes
for each row execute function public.enforce_quote_status_transition();

create or replace function public.enforce_job_status_transition()
returns trigger language plpgsql as $fn$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  -- Allowed transitions:
  -- quote -> waiting_schedule
  -- waiting_schedule -> waiting_execution|quote
  -- waiting_execution -> done|waiting_schedule
  -- done -> done
  if old.status = 'quote' and new.status = 'waiting_schedule' then
    return new;
  end if;

  if old.status = 'waiting_schedule' and new.status in ('waiting_execution', 'quote') then
    return new;
  end if;

  if old.status = 'waiting_execution' and new.status in ('done', 'waiting_schedule') then
    return new;
  end if;

  if old.status = 'done' and new.status = 'done' then
    return new;
  end if;

  raise exception 'Invalid job status transition: % -> %', old.status, new.status;
end;
$fn$;

drop trigger if exists trg_jobs_enforce_status_transition on public.jobs;
create trigger trg_jobs_enforce_status_transition
before update on public.jobs
for each row execute function public.enforce_job_status_transition();

-- updated_at triggers
drop trigger if exists trg_accounts_updated_at on public.accounts;
create trigger trg_accounts_updated_at
before update on public.accounts
for each row execute function public.set_updated_at();

drop trigger if exists trg_contacts_updated_at on public.contacts;
create trigger trg_contacts_updated_at
before update on public.contacts
for each row execute function public.set_updated_at();

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

drop trigger if exists trg_quote_items_updated_at on public.quote_items;
create trigger trg_quote_items_updated_at
before update on public.quote_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

drop trigger if exists trg_job_contacts_updated_at on public.job_contacts;
create trigger trg_job_contacts_updated_at
before update on public.job_contacts
for each row execute function public.set_updated_at();

-- Atomic quote -> job conversion
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

-- Indexes
create index if not exists contacts_account_idx on public.contacts(account_id);
create index if not exists quotes_account_idx on public.quotes(account_id, created_at desc);
create index if not exists quote_items_quote_idx on public.quote_items(quote_id, sort_order, created_at);
create index if not exists jobs_account_idx on public.jobs(account_id, created_at desc);
create index if not exists jobs_status_idx on public.jobs(status);
create index if not exists jobs_scheduled_start_idx on public.jobs(scheduled_start_at);
create index if not exists jobs_assigned_to_scheduled_idx on public.jobs(assigned_to, scheduled_start_at);
create unique index if not exists jobs_quote_unique_idx on public.jobs(quote_id) where quote_id is not null;
create index if not exists job_contacts_job_idx on public.job_contacts(job_id, sort_order, created_at);
create index if not exists job_contacts_account_idx on public.job_contacts(account_id, created_at desc);
create index if not exists job_attachments_job_idx on public.job_attachments(job_id, created_at desc);
create index if not exists route_cache_lookup_idx
  on public.route_cache(origin_lat, origin_lng, dest_lat, dest_lng, departure_bucket);

-- RLS (single authenticated user)
alter table public.accounts enable row level security;
alter table public.contacts enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.jobs enable row level security;
alter table public.job_contacts enable row level security;
alter table public.job_attachments enable row level security;
alter table public.geo_cache enable row level security;
alter table public.route_cache enable row level security;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'accounts',
    'contacts',
    'quotes',
    'quote_items',
    'jobs',
    'job_contacts',
    'job_attachments',
    'geo_cache',
    'route_cache'
  ]
  LOOP
    EXECUTE format('drop policy if exists %I_auth_all_select on public.%I', tbl, tbl);
    EXECUTE format('create policy %I_auth_all_select on public.%I for select to authenticated using (auth.uid() is not null)', tbl, tbl);

    EXECUTE format('drop policy if exists %I_auth_all_insert on public.%I', tbl, tbl);
    EXECUTE format('create policy %I_auth_all_insert on public.%I for insert to authenticated with check (auth.uid() is not null)', tbl, tbl);

    EXECUTE format('drop policy if exists %I_auth_all_update on public.%I', tbl, tbl);
    EXECUTE format('create policy %I_auth_all_update on public.%I for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)', tbl, tbl);

    EXECUTE format('drop policy if exists %I_auth_all_delete on public.%I', tbl, tbl);
    EXECUTE format('create policy %I_auth_all_delete on public.%I for delete to authenticated using (auth.uid() is not null)', tbl, tbl);
  END LOOP;
END
$$;
