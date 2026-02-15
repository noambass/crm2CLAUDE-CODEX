-- Normalize legacy placeholder schedule values.
-- Rule: any scheduled_start_at before 2000-01-01 is considered invalid and treated as unscheduled.

update public.jobs
set
  scheduled_start_at = null,
  status = case
    when status = 'waiting_execution' then 'waiting_schedule'
    else status
  end,
  updated_at = now()
where scheduled_start_at is not null
  and scheduled_start_at < timestamptz '2000-01-01 00:00:00+00';

update public.quotes
set
  scheduled_start_at = null,
  updated_at = now()
where scheduled_start_at is not null
  and scheduled_start_at < timestamptz '2000-01-01 00:00:00+00';
