create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,

  client_type text not null default 'private',
  company_name text,
  contact_name text,
  tax_id text,
  phone text,
  email text,
  address text,
  city text,
  zip_code text,
  notes text,

  status text not null default 'active',
  tags text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at
before update on public.clients
for each row execute function public.set_updated_at();

alter table public.clients enable row level security;

drop policy if exists "clients_select_own" on public.clients;
create policy "clients_select_own"
on public.clients for select
to authenticated
using (owner_id = auth.uid());

drop policy if exists "clients_insert_own" on public.clients;
create policy "clients_insert_own"
on public.clients for insert
to authenticated
with check (owner_id = auth.uid());

drop policy if exists "clients_update_own" on public.clients;
create policy "clients_update_own"
on public.clients for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists "clients_delete_own" on public.clients;
create policy "clients_delete_own"
on public.clients for delete
to authenticated
using (owner_id = auth.uid());
