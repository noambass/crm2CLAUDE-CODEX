# Supabase Migration Audit (Jobs/Calendar/Map)

## Summary
Jobs and Map no longer reference legacy runtime config. Calendar and WeeklyCalendar have no legacy usage.

## Clean (no legacy runtime usage)
- `src/pages/Jobs.jsx`
- `src/pages/Map.jsx`
- `src/pages/Calendar.jsx`
- `src/components/dashboard/WeeklyCalendar.jsx`
