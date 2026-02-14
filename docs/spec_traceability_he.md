# מטריצת התאמה: יישור סטטוסים ואוטומציות (CRM v1)

תאריך עדכון: 14/02/2026

## מקור אמת ו-Workflow
- `src/lib/workflow/statusPolicy.ts`
  - `JOB_STATUS`, `QUOTE_STATUS`
  - `JOB_ALLOWED_TRANSITIONS`, `QUOTE_ALLOWED_TRANSITIONS`
  - `getStatusForScheduling`
- `src/lib/jobs/schedulingStatus.js`
  - Wrapper תאימות לאחור על בסיס policy אחיד.
- `src/components/shared/StatusFlow.jsx`
  - Wrapper תאימות על בסיס policy אחיד.

## תצוגת סטטוס (קריאה בלבד)
- `src/components/ui/DynamicStatusBadge.jsx`
  - `JobStatusBadge` פעיל ומוצג.
- מוצג במסכים:
  - `src/pages/Jobs.jsx`
  - `src/pages/JobDetails.jsx`
  - `src/pages/Map.jsx`
  - `src/pages/Calendar.jsx`
  - `src/pages/Dashboard.jsx`
  - `src/components/jobs/JobsViewMode.jsx`

## אוטומציית תזמון אחידה
- `src/data/calendarRepo.ts`
  - `rescheduleJob` משתמש ב-`getStatusForScheduling`.
  - עדכון שדה יחיד לתזמון: `scheduled_start_at`.
- `src/data/mapRepo.ts`
  - `scheduleMapJob` משתמש ב-`getStatusForScheduling`.
  - עדכון שדה יחיד לתזמון: `scheduled_start_at`.
- `src/pages/JobDetails.jsx`, `src/pages/Calendar.jsx`, `src/pages/Map.jsx`
  - שימוש עקבי ב-24H.
  - קפיצות זמן של 10 דקות.
  - הודעות שגיאה אחידות דרך `getDetailedErrorReason`.

## לוח שנה
- `src/pages/Calendar.jsx`
  - מקור תצוגה יחיד: `scheduled_start_at`.
  - עבודות מתוזמנות מוצגות בתאי היום לפי `scheduled_start_at`.
  - נוספו `data-testid` ליציבות E2E.

## Geocoding / מפה / קואורדינטות
- `src/lib/geo/coordsPolicy.js`
  - `parseCoord`, `isUsableJobCoords`, `isInIsraelBounds`, `isZeroZero`.
- `api/geocode.js`
  - Google -> Nominatim fallback.
  - סינון תוצאות לקואורדינטות תקינות בלבד (מדיניות ישראל).
- `src/data/mapRepo.ts`
  - `geocodeAddress` לא מחזיר `lat/lng` לא תקינים.
  - `updateMapJobCoordinates` מעדכן `lat/lng` בלבד.

## הקשחת DB ותהליך עדכון
- SQL legacy הועבר ל-`supabase/legacy_sql`.
- תהליך שוטף: `supabase/migrations` בלבד.
- תיעוד עדכון: `docs/supabase_update_steps_he.md`.

## UAT Fixtures
- `scripts/seed-workflow-fixtures.mjs`
  - `--dry-run` ברירת מחדל.
  - `--apply` להזרקת נתוני UAT דטרמיניסטיים ללקוחות/הצעות/עבודות.
- צ'קליסט UAT: `docs/workflow/uat_status_flow_checklist_he.md`.

## E2E
- `e2e/crm_v1_acceptance.spec.mjs`
  - ניווט מודולים.
  - flow מלא: לקוח -> הצעה -> המרה לעבודה -> תזמון במפה -> הופעה בלוח שנה.
- `e2e/helpers/crm.mjs`
  - עזרים מעודכנים ל-flow החדש.
