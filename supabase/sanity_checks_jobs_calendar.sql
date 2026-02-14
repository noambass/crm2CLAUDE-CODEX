-- Sanity checks for jobs/calendar scheduling

-- 1) status='done' but completed_at is null
select id, owner_id, status, completed_at
from public.jobs
where status = 'done'
  and completed_at is null;

-- 2) status!='done' but completed_at is not null
select id, owner_id, status, completed_at
from public.jobs
where status <> 'done'
  and completed_at is not null;

-- 3) scheduled_at not null but status still waiting_schedule
select id, owner_id, status, scheduled_at
from public.jobs
where scheduled_at is not null
  and status = 'waiting_schedule';

-- 4) owner_id null (should not happen)
select id
from public.jobs
where owner_id is null;

-- 5) Optional: counts by status and scheduled_at null/not null
select
  status,
  count(*) as total,
  count(*) filter (where scheduled_at is null) as no_schedule,
  count(*) filter (where scheduled_at is not null) as has_schedule
from public.jobs
group by status
order by status;
