import { expect } from '@playwright/test';

export const loginEmail = process.env.E2E_LOGIN_EMAIL;
export const loginPassword = process.env.E2E_LOGIN_PASSWORD;

export async function ensureLoggedIn(page) {
  await page.goto('/');

  const loginForm = page.getByTestId('login-form');
  if (await loginForm.isVisible()) {
    await page.getByTestId('login-email').fill(loginEmail || '');
    await page.getByTestId('login-password').fill(loginPassword || '');
    await page.getByTestId('login-submit').click();
  }

  // Stable auth assertion regardless of viewport/layout.
  await expect(loginForm).toBeHidden({ timeout: 15_000 });
}
