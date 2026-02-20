-- Remove 'quote' from job_status enum.
-- Jobs are now created directly as 'waiting_schedule' when converted from an approved quote.
-- Any existing 'quote'-status jobs are migrated to 'waiting_schedule'.

-- Step 1: Migrate existing 'quote'-status jobs to 'waiting_schedule'
UPDATE public.jobs SET status = 'waiting_schedule' WHERE status = 'quote';

-- Step 2: Recreate the enum without 'quote'
CREATE TYPE job_status_new AS ENUM ('waiting_schedule', 'waiting_execution', 'done');

-- Step 3: Drop the default before changing column type (required by PostgreSQL)
ALTER TABLE public.jobs ALTER COLUMN status DROP DEFAULT;

-- Step 4: Swap column type on jobs table
ALTER TABLE public.jobs
  ALTER COLUMN status TYPE job_status_new
  USING status::text::job_status_new;

-- Step 5: Restore the default using the new enum type
ALTER TABLE public.jobs
  ALTER COLUMN status SET DEFAULT 'waiting_schedule'::job_status_new;

-- Step 6: Drop old enum and rename new one
DROP TYPE public.job_status;
ALTER TYPE public.job_status_new RENAME TO job_status;

-- Step 7: Restore the default referencing the final renamed type
ALTER TABLE public.jobs
  ALTER COLUMN status SET DEFAULT 'waiting_schedule'::job_status;

-- Step 8: Update enforce_job_status_transition trigger (remove 'quote' transitions)
CREATE OR REPLACE FUNCTION public.enforce_job_status_transition()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
  IF new.status IS NOT DISTINCT FROM old.status THEN
    RETURN new;
  END IF;

  -- Allowed transitions:
  -- waiting_schedule -> waiting_execution
  -- waiting_execution -> done|waiting_schedule
  -- done -> done
  IF old.status = 'waiting_schedule' AND new.status = 'waiting_execution' THEN
    RETURN new;
  END IF;

  IF old.status = 'waiting_execution' AND new.status IN ('done', 'waiting_schedule') THEN
    RETURN new;
  END IF;

  IF old.status = 'done' AND new.status = 'done' THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION 'Invalid job status transition: % -> %', old.status, new.status;
END;
$fn$;

NOTIFY pgrst, 'reload schema';
