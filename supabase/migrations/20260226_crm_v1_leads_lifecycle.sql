-- Promote leads to active accounts automatically when creating a job.
-- Date: 2026-02-26

create or replace function public.promote_lead_account_on_job_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  update public.accounts
  set status = 'active'
  where id = new.account_id
    and status = 'lead';

  return new;
end;
$fn$;

drop trigger if exists trg_jobs_promote_lead_account on public.jobs;
create trigger trg_jobs_promote_lead_account
after insert on public.jobs
for each row execute function public.promote_lead_account_on_job_insert();

revoke all on function public.promote_lead_account_on_job_insert() from public;
grant execute on function public.promote_lead_account_on_job_insert() to authenticated;

notify pgrst, 'reload schema';
