# Release Checklist

- `npm run lint` passes
- `npm run build` passes
- `npm run dev` starts without errors
- Required migrations applied in Supabase SQL Editor
- Post-migration checks completed
- Manual smoke test for critical flows
- Auth login/logout works
- Data access scoped by `owner_id`
- No new console errors in key screens
