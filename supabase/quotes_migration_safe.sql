-- Safe, idempotent migration for public.quotes + jobs updates

-- 1) Create quotes table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'quotes'
  ) THEN
    EXECUTE $tbl$
      create table public.quotes (
        id uuid primary key default gen_random_uuid(),
        owner_id uuid not null,
        client_id uuid references public.clients(id) on delete set null,
        client_name text,
        client_phone text,
        status text not null default 'draft',
        notes text,
        line_items jsonb not null default '[]'::jsonb,
        total numeric not null default 0,
        converted_job_id uuid,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      );
    $tbl$;
  END IF;
END
$$;

-- 2) Ensure columns exist (safe adds)
alter table public.quotes
  add column if not exists client_name text,
  add column if not exists client_phone text,
  add column if not exists converted_job_id uuid;

-- 3) Status constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'quotes_status_check'
  ) THEN
    EXECUTE $sql$
      alter table public.quotes
      add constraint quotes_status_check
      check (status in ('draft', 'sent', 'approved', 'rejected'));
    $sql$;
  END IF;
END
$$;

-- 4) Updated_at trigger
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_quotes_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'quotes'
  ) THEN
    EXECUTE $trg$
      create trigger trg_quotes_updated_at
      before update on public.quotes
      for each row execute function public.set_updated_at();
    $trg$;
  END IF;
END
$$;

-- 5) Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'quotes' AND indexname = 'quotes_owner_created_at_idx'
  ) THEN
    EXECUTE 'create index quotes_owner_created_at_idx on public.quotes (owner_id, created_at desc)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'quotes' AND indexname = 'quotes_owner_client_idx'
  ) THEN
    EXECUTE 'create index quotes_owner_client_idx on public.quotes (owner_id, client_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'quotes' AND indexname = 'quotes_owner_status_idx'
  ) THEN
    EXECUTE 'create index quotes_owner_status_idx on public.quotes (owner_id, status)';
  END IF;
END
$$;

-- 6) RLS
alter table public.quotes enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'quotes_select_own'
  ) THEN
    EXECUTE $pol$
      create policy "quotes_select_own" on public.quotes for select to authenticated using (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'quotes_insert_own'
  ) THEN
    EXECUTE $pol$
      create policy "quotes_insert_own" on public.quotes for insert to authenticated with check (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'quotes_update_own'
  ) THEN
    EXECUTE $pol$
      create policy "quotes_update_own" on public.quotes for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'quotes' AND policyname = 'quotes_delete_own'
  ) THEN
    EXECUTE $pol$
      create policy "quotes_delete_own" on public.quotes for delete to authenticated using (owner_id = auth.uid());
    $pol$;
  END IF;
END
$$;

-- 7) Jobs table alignment for quote -> job conversion
alter table public.jobs
  add column if not exists quote_id uuid references public.quotes(id) on delete set null,
  add column if not exists line_items jsonb,
  add column if not exists arrival_notes text;

update public.jobs
set line_items = '[]'::jsonb
where line_items is null;

alter table public.jobs
  alter column line_items set default '[]'::jsonb;

alter table public.jobs
  alter column line_items set not null;

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
  drop column if exists warranty,
  drop column if exists warranty_note;

-- 8) Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
