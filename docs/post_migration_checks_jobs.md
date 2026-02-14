# Post-migration checks for Jobs

## How to run the migration
1) Open Supabase SQL Editor.
2) Paste the contents of `supabase/jobs_migration_safe.sql`.
3) Run the query.

## Manual checks (5 quick checks)
1) Columns exist
   - Run:
     ```sql
     select column_name, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = 'jobs';
     ```
   - Confirm `scheduled_at`, `completed_at`, `updated_at` are present.

2) Constraints exist
   - Run:
     ```sql
     select conname
     from pg_constraint
     where conrelid = 'public.jobs'::regclass;
     ```
   - Confirm: `jobs_status_check`, `jobs_priority_check`, `jobs_completed_at_required`.

3) Indexes exist
   - Run:
     ```sql
     select indexname
     from pg_indexes
     where schemaname = 'public' and tablename = 'jobs';
     ```
   - Confirm:
     - `jobs_owner_created_at_idx`
     - `jobs_owner_client_created_at_idx`
     - `jobs_owner_status_idx`

4) updated_at trigger works
   - Pick a job id you own and run:
     ```sql
     select id, updated_at from public.jobs where id = '<JOB_ID>';
     update public.jobs set title = title where id = '<JOB_ID>';
     select id, updated_at from public.jobs where id = '<JOB_ID>';
     ```
   - `updated_at` should change.

5) RLS still active
   - In the app, open Jobs list and confirm you only see your jobs.
   - If you have another user, log in as them and ensure they cannot see your jobs.

## If something fails
- **Constraint creation fails**: Check for existing invalid data.
  - Example: status not in allowed list, or completed_at mismatch.
  - Fix data then re-run the migration.
- **NOT NULL on client_id not applied**: There are existing NULLs.
  - Find them with:
    ```sql
    select count(*) from public.jobs where client_id is null;
    ```
  - Fix rows, then re-run the migration.
- **Trigger not updating**: Ensure `public.set_updated_at()` exists and the trigger is attached.
  - Re-run the migration; check `pg_trigger` and `pg_proc`.
