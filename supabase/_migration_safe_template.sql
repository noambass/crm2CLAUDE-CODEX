-- _migration_safe_template.sql
-- 목적: idempotent schema change template

-- 1) Create table if missing
-- create table if not exists public.<table_name> (
--   id uuid primary key default gen_random_uuid(),
--   owner_id uuid not null,
--   created_at timestamptz not null default now(),
--   updated_at timestamptz not null default now()
-- );

-- 2) Add columns safely
-- alter table public.<table_name> add column if not exists <column_name> <type>;

-- 3) Ensure updated_at trigger function
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;
  END IF;
END $$;

-- 4) Trigger (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = '<trg_name>' AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER <trg_name>
    BEFORE UPDATE ON public.<table_name>
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- 5) Indexes (idempotent)
-- create index if not exists <index_name> on public.<table_name> (<cols>);

-- 6) Constraints (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE c.conname = '<constraint_name>' AND n.nspname = 'public'
  ) THEN
    ALTER TABLE public.<table_name>
      ADD CONSTRAINT <constraint_name> CHECK (<condition>);
  END IF;
END $$;

-- 7) RLS + policies (idempotent)
ALTER TABLE public.<table_name> ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = '<table_name>' AND policyname = '<policy_name>'
  ) THEN
    CREATE POLICY <policy_name>
      ON public.<table_name>
      FOR SELECT
      TO authenticated
      USING (<condition>);
  END IF;
END $$;
