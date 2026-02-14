# עדכון DB ב-Supabase (CRM v1)

## עקרון מחייב
- עדכוני DB בסביבת מוצר/בדיקות מבוצעים רק דרך `supabase/migrations`.
- לא מריצים קבצי SQL נקודתיים ידנית כחלק מזרימת עבודה שוטפת.

## תהליך מומלץ
1. להתחבר ל-Supabase CLI:
```bash
supabase login
supabase link --project-ref <PROJECT_REF>
```
2. לדחוף מיגרציות:
```bash
supabase db push
```
3. לרענן cache של PostgREST אם נדרש:
```sql
notify pgrst, 'reload schema';
```

## אימות מהיר אחרי הרצה
```sql
select to_regclass('public.accounts') as accounts,
       to_regclass('public.contacts') as contacts,
       to_regclass('public.quotes') as quotes,
       to_regclass('public.quote_items') as quote_items,
       to_regclass('public.jobs') as jobs,
       to_regclass('public.job_contacts') as job_contacts;
```

```sql
select column_name
from information_schema.columns
where table_schema='public'
  and table_name='jobs'
  and column_name in ('account_id','status','scheduled_start_at','lat','lng','assigned_to')
order by column_name;
```

ציפייה:
- קיימים `account_id`, `scheduled_start_at`, `lat`, `lng`.
- `assigned_to` לא קיים (הוסר במיגרציה).

```sql
select proname
from pg_proc
where proname in (
  'convert_quote_to_job',
  'enforce_quote_status_transition',
  'enforce_job_status_transition'
)
order by proname;
```

## Legacy SQL (ארכיון בלבד)
- קבצים ישנים הועברו ל־`supabase/legacy_sql`.
- אין להשתמש בהם לעדכון סכימה שוטף.
- אם צריך חקירה היסטורית בלבד, לפתוח את הקבצים מהארכיון.
