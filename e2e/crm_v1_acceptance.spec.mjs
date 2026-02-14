import { expect, test } from '@playwright/test';
import { ensureLoggedIn, loginEmail, loginPassword } from './helpers/auth.mjs';
import { chooseSelectOption, extractIdFromUrl, openModule, toDateInput } from './helpers/crm.mjs';

async function createManualJob(page, { clientName, title, addressText }) {
  await page.goto('/jobs/new');
  await chooseSelectOption(page, 'job-account-trigger', clientName);
  await page.getByTestId('job-title').fill(title);
  await page.getByTestId('job-address').fill(addressText);
  await page.getByTestId('job-save-button').click();
  await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/i);
  return extractIdFromUrl(page.url(), 'jobs');
}

test.describe.serial('CRM v1 acceptance', () => {
  test.skip(!loginEmail || !loginPassword, 'Missing E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD env vars');

  test('login + navigation works on desktop/mobile', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureLoggedIn(page);

    await openModule(page, 'clients');
    await openModule(page, 'quotes');
    await openModule(page, 'jobs');
    await openModule(page, 'calendar');
    await openModule(page, 'map');
    await openModule(page, 'dashboard');

    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByTestId('mobile-menu-trigger')).toBeVisible();
  });

  test('client -> quote -> convert to job -> schedule via map -> appears in calendar', async ({ page }) => {
    await ensureLoggedIn(page);

    const unique = Date.now();
    const clientName = `לקוח אוטומציה ${unique}`;
    const clientPhone = `05${String(unique).slice(-8)}`;
    const clientEmail = `e2e${unique}@example.com`;
    const quoteTitle = `הצעת אוטומציה ${unique}`;
    const mapJobTitle = `עבודה למפה ${unique}`;
    const scheduleDate = toDateInput(1);

    await page.goto('/clients/new');
    await page.getByTestId('client-full-name').fill(clientName);
    await page.getByTestId('client-phone').fill(clientPhone);
    await page.getByTestId('client-email').fill(clientEmail);
    await page.getByTestId('client-address').fill('הרצל 10, אשדוד');
    await page.getByTestId('client-save-button').click();
    await expect(page).toHaveURL('/clients');
    await expect(page.getByText(clientName).first()).toBeVisible();

    await page.goto('/quotes/new');
    await chooseSelectOption(page, 'quote-account-trigger', clientName);
    await page.getByTestId('quote-title').fill(quoteTitle);
    await page.getByTestId('quote-line-description-0').fill('ציפוי אמבטיה');
    await page.getByTestId('quote-line-quantity-0').fill('2');
    await page.getByTestId('quote-line-unit-price-0').fill('700');
    await page.getByTestId('quote-address').fill('הרצל 10, אשדוד');
    await page.getByTestId('quote-save-button').click();

    await expect(page).toHaveURL(/\/quotes\/[0-9a-f-]{36}$/i);
    await expect(page.getByTestId('quote-status-rejected')).toBeVisible();
    await expect(page.getByTestId('quote-convert-to-job')).toBeVisible();
    await page.getByTestId('quote-convert-to-job').click();

    await expect(page).toHaveURL(/\/jobs\/[0-9a-f-]{36}$/i);
    const convertedJobId = extractIdFromUrl(page.url(), 'jobs');

    const mapJobId = await createManualJob(page, {
      clientName,
      title: mapJobTitle,
      addressText: 'שדרות רוטשילד 1, תל אביב',
    });

    await page.goto('/Map');
    await expect(page.getByTestId('map-page')).toBeVisible();
    await page.getByTestId('map-search-input').fill(mapJobTitle);
    await page.getByTestId(`map-job-card-${mapJobId}`).click();
    await page.getByTestId('map-selected-schedule-button').click();
    await page.getByTestId('map-schedule-date').fill(scheduleDate);
    await page.getByTestId('map-schedule-time').selectOption('10:00');
    await page.getByTestId('map-schedule-save').click();

    await expect(page.getByTestId(`map-job-card-${mapJobId}`)).toContainText('10:00');
    await expect(page.getByTestId(`map-job-card-${mapJobId}`)).toContainText('ממתין לביצוע');

    await page.getByTestId('map-search-input').fill('');
    await page.getByTestId(`map-job-card-${convertedJobId}`).click();
    await expect(page.getByTestId(`map-job-card-${convertedJobId}`)).toContainText('הצעת מחיר');

    await page.getByTestId('map-selected-open-calendar').click();
    await expect(page.getByTestId('calendar-page')).toBeVisible();
    await expect(page.getByText(mapJobTitle)).toBeVisible();
  });
});
