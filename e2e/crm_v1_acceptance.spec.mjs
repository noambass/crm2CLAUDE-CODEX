import { expect, test } from '@playwright/test';
import { ensureLoggedIn, loginEmail, loginPassword } from './helpers/auth.mjs';
import { chooseSelectOption, extractIdFromUrl, openModule, toCalendarDayKey, toDateInput } from './helpers/crm.mjs';

const dayStartOriginAddress = process.env.VITE_DAY_START_ORIGIN_ADDRESS || 'אגס 3, אשדוד';

async function createBasicManualJob(page, { clientName, title, addressText, agreedAmount = '500' }) {
  await page.goto('/jobs/new');
  await expect(page.getByRole('heading', { name: 'עבודה חדשה' })).toBeVisible();

  await chooseSelectOption(page, 'job-account-trigger', clientName);
  await page.getByTestId('job-title').fill(title);
  await page.getByTestId('job-assigned-to').fill('מנהל');
  await page.getByTestId('job-address').fill(addressText);
  await page.getByTestId('job-agreed-amount').fill(agreedAmount);
  await page.getByTestId('job-save-button').click();

  await expect(page).toHaveURL(/\/jobs\/[^/]+$/);
  return extractIdFromUrl(page.url(), 'jobs');
}

test.describe.serial('CRM v1 acceptance', () => {
  test.skip(!loginEmail || !loginPassword, 'Missing E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD env vars');

  test('login + navigation + desktop/mobile logout', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureLoggedIn(page);

    await openModule(page, 'clients', 'לקוחות');
    await openModule(page, 'quotes', 'הצעות מחיר');
    await openModule(page, 'jobs', 'עבודות');
    await openModule(page, 'calendar', 'לוח שנה');
    await openModule(page, 'map', 'מפת עבודות');
    await openModule(page, 'dashboard', 'דשבורד');

    await expect(page.getByTestId('logout-button-desktop')).toBeVisible();
    await expect(page.getByTestId('logout-button-mobile')).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    const mobileMenuTrigger = page.getByTestId('mobile-menu-trigger');
    await expect(mobileMenuTrigger).toBeVisible();
    await mobileMenuTrigger.click({ force: true });
  });

  test('full e2e flow: quote -> job -> calendar -> map -> eta -> dashboard', async ({ page }) => {
    await ensureLoggedIn(page);

    const unique = Date.now();
    const clientName = `לקוח בדיקת E2E ${unique}`;
    const clientPhone = `05${String(unique).slice(-8)}`;
    const clientEmail = `e2e${unique}@example.com`;
    const quoteNotes = `הצעת בדיקה ${unique}`;
    const calendarJobTitle = `עבודה ללוח שנה ${unique}`;
    const etaFirstTitle = `ETA ראשון ${unique}`;
    const etaSecondTitle = `ETA שני ${unique}`;

    await page.goto('/clients/new');
    await expect(page.getByRole('heading', { name: 'לקוח חדש' })).toBeVisible();
    await page.getByTestId('client-full-name').fill(clientName);
    await page.getByTestId('client-phone').fill(clientPhone);
    await page.getByTestId('client-email').fill(clientEmail);
    await page.getByTestId('client-address').fill('אגס 3, אשדוד');
    await page.getByTestId('client-notes').fill('נוצר אוטומטית לבדיקת E2E');
    await page.getByTestId('client-save-button').click();

    await expect(page).toHaveURL('/clients');
    await expect(page.getByText(clientName).first()).toBeVisible();

    await page.goto('/quotes/new');
    await expect(page.getByRole('heading', { name: 'הצעת מחיר חדשה' })).toBeVisible();
    await chooseSelectOption(page, 'quote-account-trigger', clientName);
    await page.getByTestId('quote-notes').fill(quoteNotes);
    await page.getByTestId('quote-line-description-0').fill('ציפוי אמבטיה');
    await page.getByTestId('quote-line-quantity-0').fill('2');
    await page.getByTestId('quote-line-unit-price-0').fill('700');
    await expect(page.getByTestId('quote-total')).toContainText('₪1400.00');
    await page.getByTestId('quote-save-button').click();

    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/i);
    const quoteId = extractIdFromUrl(page.url(), 'quotes');

    await page.getByTestId('quote-edit-draft').click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quoteId}/edit`));
    await page.getByTestId('quote-notes').fill(`${quoteNotes} - עודכן`);
    await page.getByTestId('quote-save-button').click();
    await expect(page).toHaveURL(new RegExp(`/quotes/${quoteId}$`));

    await page.getByTestId('quote-status-sent').click();
    await page.getByTestId('quote-status-approved').click();
    await page.getByTestId('quote-convert-to-job').click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/i);
    const quoteJobId = extractIdFromUrl(page.url(), 'jobs');

    await page.getByTestId('job-details-edit-button').click();
    await page.getByTestId('job-agreed-amount').fill('2100');
    await page.getByTestId('job-save-button').click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${quoteJobId}$`));
    await expect(page.getByText('₪2100.00')).toBeVisible();

    await page.getByTestId('job-details-status-waiting_execution').click();
    await page.getByTestId('job-details-status-done').click();

    await page.goto('/jobs/new');
    await chooseSelectOption(page, 'job-account-trigger', clientName);
    await page.getByTestId('job-title').fill(calendarJobTitle);
    await page.getByTestId('job-assigned-to').fill('מנהל');
    await page.getByTestId('job-address').fill('שדרות רוטשילד 1, תל אביב');
    await page.getByTestId('job-warranty-trigger').click();
    await page.getByRole('option', { name: 'אין אחריות' }).click();
    await page.getByTestId('job-save-button').click();
    await expect(page.getByText('חובה להזין הסבר ללא אחריות')).toBeVisible();
    await page.getByTestId('job-warranty-explanation').fill('נדרשה עבודה על משטח ישן עם סיכון היצמדות.');
    await page.getByTestId('job-agreed-amount').fill('990');
    await page.getByTestId('job-save-button').click();
    await expect(page).toHaveURL(/\/jobs\/[^/]+$/);
    const calendarJobId = extractIdFromUrl(page.url(), 'jobs');

    await page.getByTestId('job-details-edit-button').click();
    await page.getByTestId('job-description').fill('תיאור עבודה לאחר עדכון');
    await page.getByTestId('job-agreed-amount').fill('1234');
    await page.getByTestId('job-save-button').click();
    await expect(page).toHaveURL(new RegExp(`/jobs/${calendarJobId}$`));
    await expect(page.getByText('₪1234.00')).toBeVisible();

    const etaFirstId = await createBasicManualJob(page, {
      clientName,
      title: etaFirstTitle,
      addressText: 'הפרחים 12, אשדוד',
      agreedAmount: '600',
    });

    const etaSecondId = await createBasicManualJob(page, {
      clientName,
      title: etaSecondTitle,
      addressText: 'הרצל 10, אשדוד',
      agreedAmount: '650',
    });

    await page.goto('/calendar');
    await expect(page.getByTestId('calendar-page')).toBeVisible();
    const dayKey = toCalendarDayKey(1);
    await page.getByTestId(`calendar-drag-${calendarJobId}`).dragTo(page.getByTestId(`calendar-day-${dayKey}`));
    await expect(page.getByTestId(`calendar-unscheduled-${calendarJobId}`)).toHaveCount(0);
    await expect(page.getByTestId(`calendar-day-${dayKey}`)).toContainText(calendarJobTitle);

    const etaDate = toDateInput(2);

    await page.goto('/map');
    await expect(page.getByTestId('map-page')).toBeVisible();

    await page.getByTestId('map-search-input').fill(etaFirstTitle);
    await page.getByTestId(`map-job-card-${etaFirstId}`).click();
    await page.getByTestId('map-selected-schedule-button').click();
    await page.getByTestId('map-schedule-date').fill(etaDate);
    await page.getByTestId('map-schedule-time').fill('08:00');
    await page.getByTestId('map-schedule-save').click();

    await page.getByTestId('map-search-input').fill(etaSecondTitle);
    await page.getByTestId(`map-job-card-${etaSecondId}`).click();
    await page.getByTestId('map-selected-schedule-button').click();
    await page.getByTestId('map-schedule-date').fill(etaDate);
    await page.getByTestId('map-schedule-time').fill('12:00');
    await page.getByTestId('map-schedule-save').click();

    await page.getByTestId('map-status-toggle').click();
    const waitingExecutionCheckbox = page.getByTestId('map-status-waiting_execution');
    if (!(await waitingExecutionCheckbox.isChecked())) {
      await waitingExecutionCheckbox.check();
    }
    await page.getByTestId('map-date-from').fill(etaDate);
    await page.getByTestId('map-date-to').fill(etaDate);
    await expect(page.getByTestId(`map-job-card-${etaSecondId}`)).toBeVisible();

    await page.getByTestId('map-search-input').fill(etaFirstTitle);
    await page.getByTestId(`map-job-card-${etaFirstId}`).click();
    await expect(page.getByTestId('map-eta-source')).toContainText(dayStartOriginAddress, { timeout: 90_000 });

    await page.getByTestId('map-search-input').fill(etaSecondTitle);
    await page.getByTestId(`map-job-card-${etaSecondId}`).click();
    await expect(page.getByTestId('map-eta-source')).toContainText('מהעבודה הקודמת', { timeout: 90_000 });

    await page.getByTestId('map-selected-open-calendar').click();
    await expect(page).toHaveURL(new RegExp(`/calendar\\?job_id=${etaSecondId}`));
    await expect(page.getByRole('heading', { name: 'לוח שנה' })).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'דשבורד' })).toBeVisible();
    const doneJobsValue = Number((await page.getByTestId('kpi-value-done-jobs').textContent())?.trim() || '0');
    expect(doneJobsValue).toBeGreaterThanOrEqual(1);
  });
});
