-- Safe, idempotent migration for public.attachments

-- 1) Create table if not exists
create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider text not null default 'supabase',
  bucket text not null,
  object_path text not null,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

-- 2) Ensure columns exist (safe for older tables)
alter table public.attachments
  add column if not exists owner_id uuid,
  add column if not exists job_id uuid,
  add column if not exists provider text,
  add column if not exists bucket text,
  add column if not exists object_path text,
  add column if not exists file_name text,
  add column if not exists mime_type text,
  add column if not exists size_bytes bigint,
  add column if not exists created_at timestamptz;

-- 3) RLS enabled
alter table public.attachments enable row level security;

-- 4) Policies (create only if missing)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'attachments_select_own'
  ) THEN
    create policy "attachments_select_own"
    on public.attachments for select
    to authenticated
    using (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'attachments_insert_own'
  ) THEN
    create policy "attachments_insert_own"
    on public.attachments for insert
    to authenticated
    with check (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'attachments_update_own'
  ) THEN
    create policy "attachments_update_own"
    on public.attachments for update
    to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND policyname = 'attachments_delete_own'
  ) THEN
    create policy "attachments_delete_own"
    on public.attachments for delete
    to authenticated
    using (owner_id = auth.uid());
  END IF;
END
$do$;

-- 5) Indexes (idempotent)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND indexname = 'attachments_owner_bucket_path_uidx'
  ) THEN
    EXECUTE 'create unique index attachments_owner_bucket_path_uidx on public.attachments (provider, bucket, object_path)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'attachments'
      AND indexname = 'attachments_owner_job_created_at_idx'
  ) THEN
    EXECUTE 'create index attachments_owner_job_created_at_idx on public.attachments (owner_id, job_id, created_at desc)';
  END IF;
END
$do$;

-- Post-run checks
-- 1) Verify table/columns:
--    select column_name, data_type from information_schema.columns where table_schema='public' and table_name='attachments';
-- 2) Verify indexes:
--    select indexname from pg_indexes where schemaname='public' and tablename='attachments';
-- 3) Verify RLS policies:
--    select policyname from pg_policies where schemaname='public' and tablename='attachments';

-- Warnings
-- None
