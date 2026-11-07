import { expect, test } from './fixtures';

// No saved state: a new browser context is signed out. These tests send nothing to HeyIdentity.

test('a signed-out visitor sees sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
});

test('a callback error shows sign-in-error and sign-in', async ({ page }) => {
  await page.goto('/callback?error=access_denied&error_description=The+user+denied+access.');
  await expect(page.getByTestId('sign-in-error')).toContainText('access_denied');
  await expect(page.getByTestId('sign-in-error')).toContainText('The user denied access.');
  await expect(page.getByTestId('sign-in')).toBeVisible();
});
