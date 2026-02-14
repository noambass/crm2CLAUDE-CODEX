# מטריצת התאמה: אפיון CRM -> קוד

תאריך עדכון: 13/02/2026

## סטטוס
- ✅ ממומש
- ◑ ממומש חלקית
- ❌ חסר

## 1) מודולים ראשיים
- ✅ Header + ניווט 6 מודולים + התנתקות
  קוד: `src/Layout.jsx`, `src/App.jsx`
- ✅ התנתקות גלויה בדסקטופ + תפריט מובייל
  קוד: `src/Layout.jsx`
- ✅ מסכי: דשבורד/לקוחות/הצעות/עבודות/לוח שנה/מפה
  קוד: `src/pages/*.jsx`

## 2) לוקליזציה ו-UX בסיס
- ✅ RTL מלא במסכים הפעילים
  קוד: כל דפי `src/pages`
- ✅ עברית תקינה (ליבת v1)
  קוד: `src/pages`, `src/components/shared`, `src/lib/errorMessages.js`
- ✅ תאריך/שעה/מטבע בפורמט אחיד
  קוד: `src/lib/formatters.js`
- ✅ loading/error/empty state עם Retry במסכי ליבה
  קוד: `src/components/shared/ErrorState.jsx`, `src/components/shared/EmptyState.jsx`

## 3) לקוחות
- ✅ רשימה + חיפוש + empty state
  קוד: `src/pages/Clients.jsx`, `src/data/clientsRepo.ts`
- ✅ יצירה/עריכה עם ולידציות inline
  קוד: `src/pages/ClientForm.jsx`, `src/components/shared/validation.jsx`
- ✅ soft-unique לטלפון (אזהרה, לא חסימה)
  קוד: `src/data/clientsRepo.ts`, `src/pages/ClientForm.jsx`
- ✅ כרטיס לקוח עם הצעות/עבודות + copy
  קוד: `src/pages/ClientDetails.jsx`

## 4) הצעות מחיר
- ✅ quotes + quote_items נפרדים
  קוד: `supabase/migrations/20260213_crm_v1.sql`
- ✅ עריכת שורות/הערות רק ב-draft (UI + DB)
  קוד: `src/data/quotesRepo.ts`, migration triggers
- ✅ המרה אטומית via RPC
  קוד: `convert_quote_to_job` במיגרציה, `src/data/quotesRepo.ts`
- ✅ נעילה אחרי המרה (כולל DB lock לעריכה)
  קוד: migration triggers + error mapping
- ✅ רשימה/פרטים/עריכת טיוטה/המרה
  קוד: `src/pages/Quotes.jsx`, `src/pages/QuoteForm.jsx`, `src/pages/QuoteDetails.jsx`
- ✅ מעברי סטטוס הצעה חוקיים ברמת DB
  קוד: `supabase/migrations/20260213_crm_v1.sql`

## 5) עבודות
- ✅ יצירה ידנית + עריכה מלאה
  קוד: `src/pages/JobForm.jsx`, `src/data/jobsRepo.ts`
- ✅ עבודה מהצעה + קישור להצעה
  קוד: `jobs.quote_id`, `src/pages/JobDetails.jsx`
- ✅ שורות שירות (`line_items`) הן מקור אמת לסכומים
  קוד: `src/pages/JobForm.jsx`, `src/pages/JobDetails.jsx`, `src/pages/Dashboard.jsx`
- ✅ אנשי קשר מרובים לעבודה (`job_contacts`)
  קוד: `supabase/jobs_contacts_line_items_patch.sql`, `src/pages/JobForm.jsx`, `src/pages/JobDetails.jsx`
- ✅ סטטוסים רשמיים (enum)
  קוד: `job_status` enum
- ✅ מעברי סטטוס עבודה חוקיים ברמת DB
  קוד: `supabase/migrations/20260213_crm_v1.sql`

## 6) דשבורד
- ✅ KPI + ספירות סטטוס + פעולות מהירות
  קוד: `src/pages/Dashboard.jsx`

## 7) לוח שנה (Ops)
- ✅ תצוגת חודש + שבוע
- ✅ drag&drop תזמון
- ✅ backlog לעבודות לא מתוזמנות
- ✅ עדכון אוטומטי ל-`waiting_execution` בעת תזמון
  קוד: `src/pages/Calendar.jsx`, `src/data/calendarRepo.ts`
- ✅ התנגשות לפי assigned_to
  קוד: `src/pages/Calendar.jsx`, `src/pages/Map.jsx`

## 8) מפה (Ops)
- ✅ OSM + geocode דרך API + cache
  קוד: `src/pages/Map.jsx`, `api/geocode.js`, `api/_cacheClient.js`
- ✅ פילטרים + מרקרים לפי סטטוס
  קוד: `src/pages/Map.jsx`
- ✅ תזמון מתוך מפה + קישורי ניווט Waze/Google
  קוד: `src/pages/Map.jsx`
- ✅ קישור ללוח שנה עם `job_id`
  קוד: `src/pages/Map.jsx`, `src/pages/Calendar.jsx`, `src/utils/index.ts`
- ✅ ETA תפעולי לפי כלל עסקי (כתובת פתיחת יום או עבודה קודמת)
  קוד: `src/pages/Map.jsx`, `src/config/opsMapConfig.js`, `src/data/mapRepo.ts`

## 9) API חינמי
- ✅ route API על OSRM + fallback + cache
  קוד: `api/route.js`, `api/_cacheClient.js`
- ✅ geocode API על Nominatim + cache
  קוד: `api/geocode.js`, `api/_cacheClient.js`
- ✅ פלט route: `provider` רק `osrm|fallback`
  קוד: `api/route.js`

## 10) חוב טכני שנשאר
- ◑ קבצי legacy לא פעילים עדיין קיימים בקוד (owner_id/app_configs)
  קוד לדוגמה: `src/pages/Settings.jsx`, `src/components/settings/*`, `src/lib/storage/storageProvider.js`
  השפעה: לא חוסם זרימות v1, אבל מומלץ להסרה/בידוד.

## 11) בדיקות אוטומטיות
- ✅ כיסוי E2E חובה מלא (ליבת CRM + לוח שנה + מפה + ETA + KPI)
  קוד: `e2e/crm_v1_acceptance.spec.mjs`
- ✅ בדיקות geocode/route cache + fallback
  קוד: `e2e/map_route_infra.spec.mjs`
