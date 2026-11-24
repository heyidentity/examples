import { expect, test } from '@playwright/test';

test('the framework callback redirects to an error with a way to sign in again', async ({ page }) => {
  const callback = process.env.EXAMPLE_OIDC_CALLBACK_PATH;
  if (callback !== '/api/auth/callback/heyidentity' &&
      callback !== '/login/oauth2/code/heyidentity' &&
      callback !== '/signin-oidc') {
    throw new Error('Set EXAMPLE_OIDC_CALLBACK_PATH to the app’s protocol callback.');
  }
  await page.goto(callback + '?error=access_denied');
  await expect(page.getByTestId('sign-in-error')).toBeVisible();
  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
});
