-- Invoices table: tracks GreenInvoice documents generated from jobs
-- Date: 2026-02-22

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete restrict,
  account_id uuid not null references public.accounts(id) on delete restrict,
  greeninvoice_doc_id text,
  greeninvoice_doc_number text,
  greeninvoice_doc_url text,
  doc_type integer not null default 305,
  status text not null default 'draft',
  total numeric(12,2) not null default 0,
  vat_amount numeric(12,2) not null default 0,
  grand_total numeric(12,2) not null default 0,
  currency text not null default 'ILS',
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at trigger
drop trigger if exists trg_invoices_updated_at on public.invoices;
create trigger trg_invoices_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

-- Indexes
create index if not exists invoices_job_idx on public.invoices(job_id, created_at desc);
create index if not exists invoices_account_idx on public.invoices(account_id, created_at desc);

-- RLS
alter table public.invoices enable row level security;

drop policy if exists invoices_auth_all_select on public.invoices;
create policy invoices_auth_all_select on public.invoices for select to authenticated using (auth.uid() is not null);

drop policy if exists invoices_auth_all_insert on public.invoices;
create policy invoices_auth_all_insert on public.invoices for insert to authenticated with check (auth.uid() is not null);

drop policy if exists invoices_auth_all_update on public.invoices;
create policy invoices_auth_all_update on public.invoices for update to authenticated using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists invoices_auth_all_delete on public.invoices;
create policy invoices_auth_all_delete on public.invoices for delete to authenticated using (auth.uid() is not null);
