import { expect, test } from '@playwright/test';
import { readAppSettings } from '../settings';

const { EXAMPLE_CALLBACK_ERRORS } = readAppSettings();

test('the framework callback redirects to an error with a way to sign in again', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('sign-in').click();
  const error = page.getByTestId('sign-in-error');
  await expect(error).toBeVisible();
  if (EXAMPLE_CALLBACK_ERRORS === 'normalized') {
    // The framework's own error code and a safe display message.
    await expect(error).toHaveText(/^[A-Za-z0-9_.-]+: \S.*$/);
  } else {
    await expect(error).toHaveText('access_denied: Approval required for R&D + QA.');
  }
  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
});
