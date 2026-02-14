# עדכון DB ב-Supabase (CRM v1)

## חשוב לפני הרצה
- המיגרציה `supabase/migrations/20260213_crm_v1.sql` היא **Clean Start**.
- היא מוחקת סכמות/טבלאות ישנות (`DROP ... CASCADE`).
- אם יש דאטה חשוב בסביבת היעד: לבצע גיבוי לפני הרצה.

## דרך 1: דרך Supabase SQL Editor (מומלץ עכשיו)
1. פתח את פרויקט Supabase.
2. עבור ל-`SQL Editor`.
3. פתח את הקובץ `supabase/migrations/20260213_crm_v1.sql` מתוך הפרויקט המקומי.
4. הדבק את כל התוכן לחלון SQL.
5. לחץ `Run` פעם אחת.
6. ודא שאין שגיאות בהרצה.

## עדכון לפאץ' החדש (למערכות קיימות ללא reset)
אם הסכמה כבר קיימת ורוצים לשדרג בלי Clean Start, להריץ לפי הסדר:

1. `supabase/jobs_contacts_line_items_patch.sql` (סכמה פעילה מבוססת `owner_id`).
2. `supabase/migrations/20260213_crm_v1_job_contacts_line_items_patch.sql` (סכמת `CRM v1` מבוססת `account_id`).

הפאצ'ים מבצעים:
- יצירת `job_contacts` עם RLS.
- הבטחת `jobs.line_items` + `jobs.arrival_notes` + שדות כתובת:
  - `address_place_id`
  - `address_lat`
  - `address_lng`
- Backfill אוטומטי מ-`agreed_amount` לשורת שירות היסטורית.
- הסרת `agreed_amount` ושדות אחריות ישנים.

אם שמירת עבודה חדשה נכשלת עם `400`, לרוב חסרים שדות בטבלת `jobs`.
במקרה כזה להריץ:
1. `supabase/jobs_contacts_line_items_patch.sql`
2. `supabase/jobs_migration_safe.sql`

## בדיקות מהירות אחרי הרצה
להריץ ב-SQL Editor:

```sql
select to_regclass('public.accounts') as accounts,
       to_regclass('public.contacts') as contacts,
       to_regclass('public.quotes') as quotes,
       to_regclass('public.quote_items') as quote_items,
       to_regclass('public.jobs') as jobs,
       to_regclass('public.job_contacts') as job_contacts,
       to_regclass('public.geo_cache') as geo_cache,
       to_regclass('public.route_cache') as route_cache;
```

```sql
select proname
from pg_proc
where proname in (
  'convert_quote_to_job',
  'enforce_quote_items_editable_only_in_draft',
  'enforce_quote_header_editable_only_in_draft',
  'enforce_quote_status_transition',
  'enforce_job_status_transition'
);

```sql
select column_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'jobs'
  and column_name in ('line_items','arrival_notes','agreed_amount','warranty_included','warranty_explanation')
order by column_name;
```
```

```sql
select trigger_name, event_manipulation, event_object_table
from information_schema.triggers
where trigger_schema = 'public'
  and trigger_name in (
    'trg_quote_items_enforce_draft_ins',
    'trg_quote_items_enforce_draft_upd',
    'trg_quote_items_enforce_draft_del',
    'trg_quotes_enforce_draft_edit',
    'trg_quotes_enforce_status_transition',
    'trg_jobs_enforce_status_transition'
  )
order by trigger_name;
```

```sql
select schemaname, tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('accounts','contacts','quotes','quote_items','jobs','job_attachments','geo_cache','route_cache')
order by tablename, policyname;
```

## דרך 2: Supabase CLI (אם עובדים עם migrations)
1. לוודא Login + קישור לפרויקט:
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```
2. לדחוף migrations:
```bash
supabase db push
```

הערה:
- אם משתמשים ב-CLI, כל קבצי המיגרציה בתיקייה ירוצו לפי סדר.
- בגלל שהקובץ `20260213_crm_v1.sql` כולל Clean Start, הוא מאפס את הסכמה לטובת מודל v1 החדש.
