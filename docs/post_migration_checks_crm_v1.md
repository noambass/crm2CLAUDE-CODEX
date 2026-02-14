# Post Migration Checks: CRM v1 (20260213)

## 1) Run migration
1. Open Supabase SQL Editor.
2. Run `supabase/migrations/20260213_crm_v1.sql`.

## 2) Validate objects
Run:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'accounts',
    'contacts',
    'quotes',
    'quote_items',
    'jobs',
    'job_attachments',
    'geo_cache',
    'route_cache'
  )
order by table_name;
```

Expected: all 8 tables exist.

## 3) Validate enums
```sql
select t.typname, e.enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
where t.typname in ('quote_status', 'job_status', 'job_priority')
order by t.typname, e.enumsortorder;
```

## 4) Validate RLS
```sql
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('accounts','contacts','quotes','quote_items','jobs','job_attachments','geo_cache','route_cache')
order by tablename, policyname;
```

Expected: select/insert/update/delete policies for all tables.

## 5) Validate quote total auto-sync
```sql
insert into public.accounts (account_name) values ('בדיקת חשבון') returning id;
-- Use returned account id as :account_id

insert into public.quotes (account_id) values (':account_id') returning id;
-- Use returned quote id as :quote_id

insert into public.quote_items (quote_id, description, quantity, unit_price, line_total, sort_order)
values (':quote_id', 'שורת בדיקה', 2, 150, 300, 1);

select total from public.quotes where id = ':quote_id';
```

Expected: `total = 300.00`.

## 6) Validate atomic conversion RPC
```sql
update public.quotes set status = 'approved' where id = ':quote_id';
select public.convert_quote_to_job(':quote_id');
select converted_job_id from public.quotes where id = ':quote_id';
```

Expected:
- RPC returns job id.
- `converted_job_id` contains same id.

## 7) Runtime smoke checks
1. Login works.
2. Create client.
3. Create quote with at least one line.
4. Convert approved quote to job.
5. View/update job.
