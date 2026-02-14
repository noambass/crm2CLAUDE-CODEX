# Post-migration checks for Attachments

## How to run the migration
1) Open Supabase SQL Editor.
2) Paste the contents of `supabase/attachments_migration_safe.sql`.
3) Run the query.

## Manual checks
1) Table/columns exist
   - Run:
     ```sql
     select column_name, data_type
     from information_schema.columns
     where table_schema = 'public' and table_name = 'attachments';
     ```

2) Indexes exist
   - Run:
     ```sql
     select indexname
     from pg_indexes
     where schemaname = 'public' and tablename = 'attachments';
     ```

3) RLS policies exist
   - Run:
     ```sql
     select policyname
     from pg_policies
     where schemaname = 'public' and tablename = 'attachments';
     ```
