# UAT Checklist: סטטוסים ואוטומציות

## הכנת דאטה
1. להריץ dry-run:
```bash
node scripts/seed-workflow-fixtures.mjs --dry-run
```
2. להריץ fixture בפועל:
```bash
node scripts/seed-workflow-fixtures.mjs --apply
```

## בדיקות סטטוס הצעות
1. קיימת הצעה בסטטוס `draft`.
2. אפשר להעביר `draft -> sent`.
3. אפשר להעביר `sent -> approved`.
4. אחרי `approved`, כפתור המרה לעבודה פעיל.

## בדיקות המרה להצעת עבודה
1. המרה יוצרת `job` חדש עם `quote_id`.
2. אם אין תזמון, סטטוס העבודה החדש הוא `waiting_schedule`.
3. אם יש `scheduled_start_at` בהצעה, הסטטוס החדש הוא `waiting_execution`.

## בדיקות תזמון עבודה
1. תזמון מ-`JobDetails` מעדכן `scheduled_start_at`.
2. תזמון מ-`Map` מעדכן `scheduled_start_at`.
3. תזמון מ-`Calendar` מעדכן `scheduled_start_at`.
4. קפיצות זמן הן של 10 דקות בלבד.
5. שעה מוצגת ב-24H (ללא AM/PM).

## בדיקות מעבר סטטוס אוטומטי בעת תזמון
1. `quote -> waiting_schedule`
2. `waiting_schedule -> waiting_execution`
3. `waiting_execution -> waiting_execution`
4. `done -> done`

## בדיקות תצוגה
1. `JobStatusBadge` מוצג במסכים:
   - עבודות
   - פרטי עבודה
   - מפה
   - לוח שנה
   - דשבורד
2. אין פעולה ידנית לשינוי סטטוס עבודה במסכים הללו.

## בדיקות לוח שנה
1. עבודה מתוזמנת מופיעה בתא היום הנכון.
2. עבודה ללא תזמון מופיעה ברשימת "עבודות לתזמון".
3. שינוי תאריך/שעה מעדכן את התא הנכון בלוח.

## בדיקות מפה וקואורדינטות
1. עבודות עם קואורדינטות תקינות מוצגות במרקרים.
2. `0,0` לא נחשב מיקום תקין.
3. עבודה עם כתובת וללא קואורדינטות עוברת backfill בהדרגה.
4. בכישלון geocode מוצג "מיקום לא אותר".

## בדיקות DB ידניות (SQL)
```sql
select count(*) as zero_zero_jobs
from public.jobs
where lat = 0 and lng = 0;
```

```sql
select count(*) as invalid_status_jobs
from public.jobs
where status not in ('quote','waiting_schedule','waiting_execution','done');
```
