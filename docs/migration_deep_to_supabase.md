# Deep Migration to Supabase (Runtime Cleanup)

## Summary
- App runtime now uses Supabase only (Auth, DB, Storage).
- Legacy dependencies and runtime hooks were removed.
- Added safe SQL migrations for profiles, employees, and app_configs.

## What was updated
- **Auth/Profile display** → `useAuth()` + `public.profiles`.
- **Employees** → `public.employees` (owner‑scoped).
- **App Config** → `public.app_configs` (owner‑scoped).
- **Dashboard data** → Supabase queries filtered by `owner_id`.
- **Navigation logging** → removed (optional TODO below).

## Migrations (manual)
Run these in Supabase SQL Editor:
- `supabase/profiles_migration_safe.sql`
- `supabase/employees_migration_safe.sql`
- `supabase/app_configs_migration_safe.sql`

## Notes / TODOs
- Optional: add a `public.app_logs` table and write navigation events if needed.

## Runtime dependencies
- Supabase only. No legacy runtime clients are loaded.
