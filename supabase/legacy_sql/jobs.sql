create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  client_id uuid not null references public.clients(id) on delete set null,

  client_name text,
  client_phone text,
  contact_name text,
  contact_phone text,
  primary_contact_name text,
  primary_contact_phone text,

  title text not null,
  description text,
  status text not null default 'quote' check (status in ('quote', 'waiting_schedule', 'waiting_execution', 'done')),
  priority text not null default 'normal' check (priority in ('normal', 'urgent')),

  address text,
  city text,
  arrival_notes text,
  scheduled_date date,
  scheduled_time text,
  scheduled_at timestamptz,

  assigned_to text,
  assigned_to_name text,

  notes text,
  internal_notes text,
  line_items jsonb not null default '[]'::jsonb,
  total_price numeric,
  price numeric,

  photos text[] not null default '{}',
  invoice_status text,
  completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint jobs_completed_at_required
    check ((status = 'done') = (completed_at is not null))
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

create index if not exists jobs_owner_created_at_idx
  on public.jobs (owner_id, created_at desc);

create index if not exists jobs_owner_client_created_at_idx
  on public.jobs (owner_id, client_id, created_at desc);

create index if not exists jobs_owner_status_idx
  on public.jobs (owner_id, status);

alter table public.jobs enable row level security;

drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own"
on public.jobs for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own"
on public.jobs for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
on public.jobs for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "jobs_delete_own" on public.jobs;
create policy "jobs_delete_own"
on public.jobs for delete
to authenticated
using (owner_id = auth.uid());

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

drop trigger if exists trg_job_contacts_updated_at on public.job_contacts;
create trigger trg_job_contacts_updated_at
before update on public.job_contacts
for each row execute function public.set_updated_at();

create index if not exists job_contacts_owner_created_at_idx
  on public.job_contacts (owner_id, created_at desc);

create index if not exists job_contacts_owner_job_sort_idx
  on public.job_contacts (owner_id, job_id, sort_order);

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
