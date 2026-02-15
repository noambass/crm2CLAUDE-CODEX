import { expect, test } from '@playwright/test';
import { ensureLoggedIn, loginEmail, loginPassword } from './helpers/auth.mjs';

test.describe('Quote Numeric Inputs', () => {
  test.skip(!loginEmail || !loginPassword, 'Missing E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD env vars');

  test('Ctrl+A בתוך מחיר יחידה מסמן רק את תוכן השדה', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await ensureLoggedIn(page);
    await page.goto('/quotes/new');

    const unitPriceInput = page.getByTestId('quote-line-unit-price-0');
    await expect(unitPriceInput).toBeVisible();

    await unitPriceInput.fill('00123.50');
    await unitPriceInput.click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.type('9');

    await expect(unitPriceInput).toHaveValue('9');

    const pageSelectionLength = await page.evaluate(() => window.getSelection()?.toString().length || 0);
    await expect(pageSelectionLength).toBe(0);
  });
});

