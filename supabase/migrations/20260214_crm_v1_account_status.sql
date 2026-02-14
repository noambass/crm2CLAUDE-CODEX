-- Add account status for CRM v1 pipeline management
-- Date: 2026-02-14

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE public.account_status AS ENUM ('lead', 'active', 'inactive');
  END IF;
END
$$;

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS status public.account_status NOT NULL DEFAULT 'active';

UPDATE public.accounts
SET status = 'active'
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS accounts_status_idx
  ON public.accounts(status, created_at DESC);
