import { expect, test } from '@playwright/test';

test('the framework callback redirects to an error with a way to sign in again', async ({ page }) => {
  const callback = process.env.EXAMPLE_OIDC_CALLBACK_PATH;
  if (callback !== '/api/auth/callback/heyidentity' &&
      callback !== '/login/oauth2/code/heyidentity' &&
      callback !== '/signin-oidc') {
    throw new Error('Set EXAMPLE_OIDC_CALLBACK_PATH to the app’s protocol callback.');
  }
  await page.goto('/');
  await page.getByTestId('sign-in').click();
  const error = page.getByTestId('sign-in-error');
  await expect(error).toBeVisible();
  if (callback !== '/api/auth/callback/heyidentity') {
    await expect(error).toHaveText('access_denied: Approval required for R&D + QA.');
  }
  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
});
