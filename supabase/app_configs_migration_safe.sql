-- Safe migration for public.app_configs

create table if not exists public.app_configs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,
  config_type text not null,
  config_data jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_configs add column if not exists owner_id uuid;
alter table public.app_configs add column if not exists config_type text;
alter table public.app_configs add column if not exists config_data jsonb;
alter table public.app_configs add column if not exists is_active boolean;
alter table public.app_configs add column if not exists created_at timestamptz not null default now();
alter table public.app_configs add column if not exists updated_at timestamptz not null default now();

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
    WHERE t.tgname = 'trg_app_configs_updated_at'
      AND n.nspname = 'public'
  ) THEN
    CREATE TRIGGER trg_app_configs_updated_at
    BEFORE UPDATE ON public.app_configs
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $do$;

create unique index if not exists app_configs_owner_type_uidx
  on public.app_configs (owner_id, config_type);

create index if not exists app_configs_owner_created_at_idx
  on public.app_configs (owner_id, created_at desc);

alter table public.app_configs enable row level security;

-- RLS policies (idempotent)
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_configs' AND policyname = 'app_configs_select_own'
  ) THEN
    CREATE POLICY app_configs_select_own
      ON public.app_configs FOR SELECT
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_configs' AND policyname = 'app_configs_insert_own'
  ) THEN
    CREATE POLICY app_configs_insert_own
      ON public.app_configs FOR INSERT
      TO authenticated
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_configs' AND policyname = 'app_configs_update_own'
  ) THEN
    CREATE POLICY app_configs_update_own
      ON public.app_configs FOR UPDATE
      TO authenticated
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid());
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_configs' AND policyname = 'app_configs_delete_own'
  ) THEN
    CREATE POLICY app_configs_delete_own
      ON public.app_configs FOR DELETE
      TO authenticated
      USING (owner_id = auth.uid());
  END IF;
END $do$;
