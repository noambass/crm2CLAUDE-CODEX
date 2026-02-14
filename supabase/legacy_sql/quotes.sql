-- Quotes table for managing price quotes
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  client_id uuid references public.clients(id) on delete set null,

  client_name text,
  client_phone text,

  status text not null default 'draft' check (status in ('draft', 'sent', 'approved', 'rejected')),
  notes text,

  line_items jsonb not null default '[]'::jsonb,
  total numeric not null default 0,

  converted_job_id uuid,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_quotes_updated_at on public.quotes;
create trigger trg_quotes_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists quotes_owner_created_at_idx
  on public.quotes (owner_id, created_at desc);

create index if not exists quotes_owner_client_idx
  on public.quotes (owner_id, client_id);

create index if not exists quotes_owner_status_idx
  on public.quotes (owner_id, status);

-- RLS
alter table public.quotes enable row level security;

drop policy if exists "quotes_select_own" on public.quotes;
create policy "quotes_select_own"
on public.quotes for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "quotes_insert_own" on public.quotes;
create policy "quotes_insert_own"
on public.quotes for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "quotes_update_own" on public.quotes;
create policy "quotes_update_own"
on public.quotes for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "quotes_delete_own" on public.quotes;
create policy "quotes_delete_own"
on public.quotes for delete
to authenticated
using (owner_id = auth.uid());
