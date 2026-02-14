# Post‑migration checks: profiles & employees

## Run the migrations
1) Open Supabase Dashboard → SQL Editor.
2) Run `supabase/profiles_migration_safe.sql`.
3) Run `supabase/employees_migration_safe.sql`.
4) (If using AppConfig replacements) run `supabase/app_configs_migration_safe.sql`.

## Manual checks (5 quick)
1) **Tables exist**
   - `public.profiles` and `public.employees` (and `public.app_configs` if used).
2) **Columns exist**
   - profiles: `id`, `full_name`, `phone`, `created_at`, `updated_at`.
   - employees: `id`, `owner_id`, `name`, `phone`, `email`, `role`, `is_active`, `created_at`, `updated_at`.
3) **RLS enabled**
   - In Supabase → Table editor → each table → RLS = enabled.
4) **Policies exist**
   - profiles: select/insert/update own.
   - employees: select/insert/update/delete own.
5) **updated_at works**
   - Update a row and verify `updated_at` changes.

## If something fails
- **RLS errors (no rows returned)**: verify policies exist and `owner_id`/`id` matches `auth.uid()`.
- **Trigger errors**: check `public.set_updated_at()` exists and trigger names are present.
- **Insert denied**: confirm the insert includes `owner_id` (employees) or `id` = `auth.uid()` (profiles).
