-- Safe, idempotent migration for public.jobs

-- 1) Ensure columns exist
alter table public.jobs
  add column if not exists scheduled_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists updated_at timestamptz,
  add column if not exists line_items jsonb,
  add column if not exists arrival_notes text,
  add column if not exists address_place_id text,
  add column if not exists address_lat double precision,
  add column if not exists address_lng double precision,
  add column if not exists resident_name text,
  add column if not exists resident_phone text,
  add column if not exists estimated_duration_minutes integer,
  add column if not exists vat_rate numeric,
  add column if not exists payment_status text,
  add column if not exists paid_at timestamptz;

-- Defaults (safe)
alter table public.jobs
  alter column estimated_duration_minutes set default 180;
alter table public.jobs
  alter column vat_rate set default 0.18;
alter table public.jobs
  alter column payment_status set default 'unpaid';
alter table public.jobs
  alter column line_items set default '[]'::jsonb;

update public.jobs
set line_items = '[]'::jsonb
where line_items is null;

alter table public.jobs
  alter column line_items set not null;

-- 2) Ensure updated_at trigger function exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE $fn$
      create or replace function public.set_updated_at()
      returns trigger language plpgsql as $body$
      begin
        new.updated_at = now();
        return new;
      end;
      $body$;
    $fn$;
  END IF;
END
$$;

-- 3) Ensure updated_at trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_jobs_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'jobs'
  ) THEN
    EXECUTE $trg$
      create trigger trg_jobs_updated_at
      before update on public.jobs
      for each row execute function public.set_updated_at();
    $trg$;
  END IF;
END
$$;

-- 4) Constraints (status, priority, completed_at consistency)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_status_check'
  ) THEN
    EXECUTE $sql$
      alter table public.jobs
      add constraint jobs_status_check
      check (status in ('quote', 'waiting_schedule', 'waiting_execution', 'done'));
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_priority_check'
  ) THEN
    EXECUTE $sql$
      alter table public.jobs
      add constraint jobs_priority_check
      check (priority in ('normal', 'urgent'));
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_completed_at_required'
  ) THEN
    EXECUTE $sql$
      alter table public.jobs
      add constraint jobs_completed_at_required
      check ((status = 'done') = (completed_at is not null));
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_payment_status_check'
  ) THEN
    EXECUTE $sql$
      alter table public.jobs
      add constraint jobs_payment_status_check
      check (payment_status is null or payment_status in ('unpaid', 'paid'));
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'jobs_vat_rate_check'
  ) THEN
    EXECUTE $sql$
      alter table public.jobs
      add constraint jobs_vat_rate_check
      check (vat_rate is null or (vat_rate >= 0 and vat_rate <= 1));
    $sql$;
  END IF;
END
$$;

-- 5) NOT NULL for client_id only if no NULLs exist
DO $$
DECLARE
  null_count bigint;
BEGIN
  SELECT count(*) INTO null_count
  FROM public.jobs
  WHERE client_id IS NULL;

  IF null_count = 0 THEN
    BEGIN
      ALTER TABLE public.jobs
        ALTER COLUMN client_id SET NOT NULL;
    EXCEPTION WHEN others THEN
      -- Ignore if already NOT NULL or cannot be altered due to dependencies
      NULL;
    END;
  END IF;
END
$$;

-- 6) Indexes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND indexname = 'jobs_owner_created_at_idx'
  ) THEN
    EXECUTE 'create index jobs_owner_created_at_idx on public.jobs (owner_id, created_at desc)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND indexname = 'jobs_owner_client_created_at_idx'
  ) THEN
    EXECUTE 'create index jobs_owner_client_created_at_idx on public.jobs (owner_id, client_id, created_at desc)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND indexname = 'jobs_owner_status_idx'
  ) THEN
    EXECUTE 'create index jobs_owner_status_idx on public.jobs (owner_id, status)';
  END IF;
END
$$;

-- 7) RLS policies (create only if missing)
alter table public.jobs enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_select_own'
  ) THEN
    EXECUTE $pol$
      create policy "jobs_select_own"
      on public.jobs for select
      to authenticated
      using (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_insert_own'
  ) THEN
    EXECUTE $pol$
      create policy "jobs_insert_own"
      on public.jobs for insert
      to authenticated
      with check (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_update_own'
  ) THEN
    EXECUTE $pol$
      create policy "jobs_update_own"
      on public.jobs for update
      to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'jobs'
      AND policyname = 'jobs_delete_own'
  ) THEN
    EXECUTE $pol$
      create policy "jobs_delete_own"
      on public.jobs for delete
      to authenticated
      using (owner_id = auth.uid());
    $pol$;
  END IF;
END
$$;

-- 8) job_contacts table + RLS
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_job_contacts_updated_at'
      AND n.nspname = 'public'
      AND c.relname = 'job_contacts'
  ) THEN
    EXECUTE $trg$
      create trigger trg_job_contacts_updated_at
      before update on public.job_contacts
      for each row execute function public.set_updated_at();
    $trg$;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'job_contacts'
      AND indexname = 'job_contacts_owner_created_at_idx'
  ) THEN
    EXECUTE 'create index job_contacts_owner_created_at_idx on public.job_contacts (owner_id, created_at desc)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'job_contacts'
      AND indexname = 'job_contacts_owner_job_sort_idx'
  ) THEN
    EXECUTE 'create index job_contacts_owner_job_sort_idx on public.job_contacts (owner_id, job_id, sort_order)';
  END IF;
END
$$;

alter table public.job_contacts enable row level security;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_contacts'
      AND policyname = 'job_contacts_select_own'
  ) THEN
    EXECUTE $pol$
      create policy "job_contacts_select_own"
      on public.job_contacts for select
      to authenticated
      using (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_contacts'
      AND policyname = 'job_contacts_insert_own'
  ) THEN
    EXECUTE $pol$
      create policy "job_contacts_insert_own"
      on public.job_contacts for insert
      to authenticated
      with check (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_contacts'
      AND policyname = 'job_contacts_update_own'
  ) THEN
    EXECUTE $pol$
      create policy "job_contacts_update_own"
      on public.job_contacts for update
      to authenticated
      using (owner_id = auth.uid())
      with check (owner_id = auth.uid());
    $pol$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'job_contacts'
      AND policyname = 'job_contacts_delete_own'
  ) THEN
    EXECUTE $pol$
      create policy "job_contacts_delete_own"
      on public.job_contacts for delete
      to authenticated
      using (owner_id = auth.uid());
    $pol$;
  END IF;
END
$$;

-- 9) Backfill line_items from legacy agreed_amount
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

-- 10) Backfill legacy job contact fields
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
        and not exists (select 1 from public.job_contacts jc where jc.job_id = j.id);
    $sql$;
  END IF;
END
$$;

-- 11) Drop obsolete legacy columns if present
alter table public.jobs
  drop column if exists agreed_amount,
  drop column if exists warranty,
  drop column if exists warranty_note;

-- Post-run checks
-- 1) Verify columns exist:
--    select column_name, data_type from information_schema.columns where table_schema='public' and table_name='jobs';
-- 2) Verify constraints:
--    select conname from pg_constraint where conrelid='public.jobs'::regclass;
-- 3) Verify indexes:
--    select indexname from pg_indexes where schemaname='public' and tablename='jobs';
-- 4) Verify updated_at trigger:
--    select tgname from pg_trigger join pg_class on pg_class.oid=tgrelid where relname='jobs' and not tgisinternal;
-- 5) Verify RLS policies:
--    select policyname from pg_policies where schemaname='public' and tablename='jobs';

-- Warnings
-- If client_id has NULL values, NOT NULL constraint was NOT applied.
-- Check with: select count(*) from public.jobs where client_id is null;
