const messageMap = [
  { test: 'Only approved quote can be converted', text: 'ניתן להמיר לעבודה רק הצעה שאושרה.' },
  { test: 'Quote already converted', text: 'הצעה זו כבר הומרה לעבודה.' },
  { test: 'Quote not found', text: 'הצעת המחיר לא נמצאה.' },
  { test: 'Quote items can be edited only when quote is in draft status', text: 'לא ניתן לערוך שורות כשההצעה אינה טיוטה.' },
  { test: 'Quote notes can be edited only when quote is in draft status', text: 'לא ניתן לערוך הערות כשההצעה אינה טיוטה.' },
  { test: 'Quote account cannot be changed when quote is not in draft status', text: 'לא ניתן לשנות לקוח להצעה שאינה טיוטה.' },
  { test: 'Quote that was converted to job cannot be edited', text: 'הצעה שהומרה לעבודה נעולה לעריכה.' },
  { test: 'Quote status cannot change after conversion to job', text: 'לא ניתן לשנות סטטוס להצעה שהומרה לעבודה.' },
  { test: 'Invalid quote status transition', text: 'מעבר סטטוס הצעה אינו חוקי.' },
  { test: 'Invalid job status transition', text: 'מעבר סטטוס עבודה אינו חוקי.' },
  { test: 'ניתן לערוך הצעה רק במצב טיוטה', text: 'ניתן לערוך הצעה רק במצב טיוטה.' },
  { test: 'לא ניתן לערוך הצעה שהומרה לעבודה', text: 'לא ניתן לערוך הצעה שהומרה לעבודה.' },
  { test: 'quote_items_quantity_gt_zero', text: 'כמות בשורת הצעה חייבת להיות גדולה מ-0.' },
  { test: 'quote_items_unit_price_gte_zero', text: 'מחיר יחידה בשורת הצעה חייב להיות 0 או יותר.' },
  { test: 'invalid input value for enum quote_status', text: 'סטטוס הצעה לא חוקי.' },
  { test: 'invalid input value for enum job_status', text: 'סטטוס עבודה לא חוקי.' },
  { test: 'duplicate key value violates unique constraint "jobs_quote_unique_idx"', text: 'להצעה זו כבר קיימת עבודה.' },
  { test: 'violates row-level security policy', text: 'אין הרשאה לביצוע הפעולה.' },
  { test: 'JWT expired', text: 'ההתחברות פגה. יש להתחבר מחדש.' },
  { test: 'NetworkError', text: 'שגיאת רשת. בדוק חיבור ונסה שוב.' },
  { test: 'fetch failed', text: 'שגיאת תקשורת עם השרת. נסה שוב.' },
];

export function getHebrewErrorMessage(error, fallback = 'אירעה שגיאה. נסה שוב.') {
  const raw = String(error?.message || error || '').trim();
  if (!raw) return fallback;

  const found = messageMap.find((rule) => raw.includes(rule.test));
  if (found) return found.text;

  return fallback;
}

export function getDetailedErrorReason(error, fallback = 'אירעה שגיאה לא ידועה.') {
  const friendly = getHebrewErrorMessage(error, '');
  const code = String(error?.code || '').trim();
  const message = String(error?.message || '').trim();
  const details = String(error?.details || '').trim();
  const hint = String(error?.hint || '').trim();

  const lines = [];
  if (friendly) lines.push(friendly);
  if (code || message) lines.push(`[code: ${code || 'unknown'}] ${message || 'No message'}`);
  if (details) lines.push(`details: ${details}`);
  if (hint) lines.push(`hint: ${hint}`);

  if (lines.length > 0) return lines.join('\n');

  const raw = String(error || '').trim();
  return raw || fallback;
}
