-- CRM schema migration
-- Safe, idempotent creates for core entities

create extension if not exists "pgcrypto";

-- Enums
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_type') THEN
    CREATE TYPE account_type AS ENUM ('private', 'company', 'bath_company');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('active', 'past');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attachment_type') THEN
    CREATE TYPE attachment_type AS ENUM ('before', 'after', 'general', 'document');
  END IF;
END $$;

-- Accounts
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type account_type NOT NULL,
  status account_status NOT NULL DEFAULT 'active'
);

-- Contacts
CREATE TABLE IF NOT EXISTS contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  name text NOT NULL,
  phone text
);

-- Services
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_unit_price numeric(12,2),
  default_duration_minutes integer NOT NULL DEFAULT 180,
  is_active boolean NOT NULL DEFAULT true
);

-- Jobs
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  end_customer_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  primary_phone text,
  status text NOT NULL,
  scheduled_at timestamptz,
  is_urgent boolean NOT NULL DEFAULT false,
  address_text text,
  place_id text,
  lat numeric(9,6),
  lng numeric(9,6),
  arrival_notes text,
  notes text,
  estimated_duration_minutes integer NOT NULL DEFAULT 180,
  subtotal numeric(12,2),
  vat_rate numeric(6,4) NOT NULL DEFAULT 0.18,
  vat_amount numeric(12,2),
  total numeric(12,2),
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  paid_at timestamptz
);

-- Job Items
CREATE TABLE IF NOT EXISTS job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  unit_price numeric(12,2) NOT NULL DEFAULT 0,
  duration_minutes integer NOT NULL DEFAULT 180,
  line_total numeric(12,2) NOT NULL DEFAULT 0
);

-- Job Contacts
CREATE TABLE IF NOT EXISTS job_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  is_primary_for_job boolean NOT NULL DEFAULT false,
  note text
);

-- Attachments
CREATE TABLE IF NOT EXISTS attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  type attachment_type NOT NULL,
  storage_key text NOT NULL,
  note text
);

-- Job Reports
CREATE TABLE IF NOT EXISTS job_reports (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  actual_start timestamptz,
  actual_end timestamptz,
  issues text,
  notes text
);

-- Route Cache
CREATE TABLE IF NOT EXISTS route_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_lat numeric(9,6) NOT NULL,
  origin_lng numeric(9,6) NOT NULL,
  dest_lat numeric(9,6) NOT NULL,
  dest_lng numeric(9,6) NOT NULL,
  departure_bucket timestamptz NOT NULL,
  duration_seconds integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS route_cache_unique
  ON route_cache (origin_lat, origin_lng, dest_lat, dest_lng, departure_bucket);

-- App Settings
CREATE TABLE IF NOT EXISTS app_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workday_start time NOT NULL DEFAULT '07:00',
  workday_end time NOT NULL DEFAULT '20:00',
  buffer_minutes integer NOT NULL DEFAULT 20,
  default_service_duration_minutes integer NOT NULL DEFAULT 180,
  home_base_address text NOT NULL DEFAULT 'רובע ט"ז, אשדוד',
  vat_rate numeric(6,4) NOT NULL DEFAULT 0.18
);

-- Helpful indexes
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS contacts_account_id_idx ON contacts(account_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS jobs_account_id_idx ON jobs(account_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'end_customer_account_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS jobs_end_customer_account_id_idx ON jobs(end_customer_account_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_items' AND column_name = 'job_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS job_items_job_id_idx ON job_items(job_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_contacts' AND column_name = 'job_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS job_contacts_job_id_idx ON job_contacts(job_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attachments' AND column_name = 'job_id'
  ) THEN
    CREATE INDEX IF NOT EXISTS attachments_job_id_idx ON attachments(job_id);
  END IF;
END $$;