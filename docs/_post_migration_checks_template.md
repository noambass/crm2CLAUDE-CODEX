# Post-migration Checks Template

## How to run
1) Open Supabase Dashboard → SQL Editor.
2) Run the migration file.

## Checks
1) Table exists and columns are present.
2) RLS enabled.
3) Policies exist and allow owner-only access.
4) Indexes created.
5) Trigger updates `updated_at`.

## Sample queries
```sql
-- Count rows
select count(*) from public.<table_name>;

-- Verify updated_at
select id, updated_at from public.<table_name> order by updated_at desc limit 5;
```

## If something fails
- Check RLS policies and `owner_id`/`auth.uid()` match.
- Verify trigger function exists.
- Confirm constraints and indexes exist.
