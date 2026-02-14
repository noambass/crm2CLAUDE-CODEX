-- Safe migration for public.employees

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  name text not null,
  phone text,
  email text,
  role text not null default 'owner',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.employees add column if not exists owner_id uuid;
alter table public.employees add column if not exists name text;
alter table public.employees add column if not exists phone text;
alter table public.employees add column if not exists email text;
alter table public.employees add column if not exists role text;
alter table public.employees add column if not exists is_active boolean;
alter table public.employees add column if not exists created_at timestamptz not null default now();
alter table public.employees add column if not exists updated_at timestamptz not null default now();

-- Ensure updated_at function exists
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname = 'set_updated_at' AND n.nspname = 'public'
  ) THEN
    CREATE FUNCTION public.set_updated_at()
    RETURNS trigger LANGUAGE plpgsql AS $func$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $func$;
  END IF;
END $do$;

-- Trigger for updated_at
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'trg_employees_updated_at'
      AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER trg_employees_updated_at
    BEFORE UPDATE ON public.employees
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $do$;

create index if not exists employees_owner_created_at_idx
  on public.employees (owner_id, created_at desc);

create index if not exists employees_owner_is_active_idx
  on public.employees (owner_id, is_active);

alter table public.employees enable row level security;

-- RLS policies (idempotent)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees' AND policyname = 'employees_select_own'
  ) THEN
    CREATE POLICY employees_select_own
      ON public.employees FOR SELECT
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees' AND policyname = 'employees_insert_own'
  ) THEN
    CREATE POLICY employees_insert_own
      ON public.employees FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees' AND policyname = 'employees_update_own'
  ) THEN
    CREATE POLICY employees_update_own
      ON public.employees FOR UPDATE
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'employees' AND policyname = 'employees_delete_own'
  ) THEN
    CREATE POLICY employees_delete_own
      ON public.employees FOR DELETE
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;
END $do$;
