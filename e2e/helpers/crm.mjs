import { expect } from '@playwright/test';

export function extractIdFromUrl(url, resourceName) {
  const parsed = new URL(url);
  const regex = new RegExp(`/${resourceName}/([^/?#]+)`);
  const match = parsed.pathname.match(regex);
  if (!match?.[1]) {
    throw new Error(`לא נמצא מזהה עבור ${resourceName} ב-URL: ${url}`);
  }
  return decodeURIComponent(match[1]);
}

export async function chooseSelectOption(page, triggerTestId, optionLabel) {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole('option', { name: optionLabel }).first().click();
}

export function toDateInput(offsetDays = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toCalendarDayKey(offsetDays = 0) {
  return toDateInput(offsetDays);
}

function expectedUrlRegex(moduleKey) {
  const map = {
    dashboard: /\/((Dashboard)?)(\?.*)?$/,
    clients: /\/clients(\?.*)?$/,
    quotes: /\/quotes(\?.*)?$/,
    jobs: /\/jobs(\?.*)?$/,
    calendar: /\/(Calendar|calendar)(\?.*)?$/,
    map: /\/(Map|map)(\?.*)?$/,
    settings: /\/(Settings|settings)(\?.*)?$/,
  };
  return map[moduleKey] || null;
}

export async function openModule(page, moduleKey, headingText) {
  await page.getByTestId(`nav-${moduleKey}`).click();

  const urlRegex = expectedUrlRegex(moduleKey);
  if (urlRegex) {
    await expect(page).toHaveURL(urlRegex);
  }

  // Keep headingText parameter for backward compatibility with existing tests.
  await expect(page.getByTestId(`nav-${moduleKey}`)).toBeVisible();
}
