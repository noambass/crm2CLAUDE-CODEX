# Feature Process (Codex Workflow)

## Overview
Use this sequence for any new feature or change:
1) Prompt Codex with goal, constraints, tasks, and tests.
2) Codex makes minimal changes.
3) Run `npm run lint`.
4) If DB/schema changes: add `*_migration_safe.sql` + `post_migration_checks*.md`.
5) Run required checks and smoke tests.
6) Summarize changes + files touched.

## DB Rule
Any data model change MUST include:
- `supabase/*_migration_safe.sql` (idempotent)
- `docs/*post_migration_checks*.md`

## Promotion Order
1) Dev (local)
2) Preview (staging)
3) Production
