-- Patch for existing CRM v1 databases (no reset required)
-- Date: 2026-02-13

alter table public.jobs
  add column if not exists assigned_to text not null default 'owner';

update public.jobs
set assigned_to = 'owner'
where assigned_to is null;

create index if not exists jobs_assigned_to_scheduled_idx
  on public.jobs(assigned_to, scheduled_start_at);
