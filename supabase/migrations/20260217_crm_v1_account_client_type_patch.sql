-- Add client type to CRM v1 accounts
-- Date: 2026-02-16

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_client_type') THEN
    CREATE TYPE public.account_client_type AS ENUM ('private', 'company', 'bath_company');
  END IF;
END
$$;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS client_type public.account_client_type NOT NULL DEFAULT 'private';

UPDATE public.accounts
SET client_type = 'private'
WHERE client_type IS NULL;

CREATE INDEX IF NOT EXISTS accounts_client_type_idx
  ON public.accounts(client_type, created_at DESC);
