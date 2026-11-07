import { expect, savedIdentity, test } from './fixtures';

// Runs from playwright/.auth/admin.json only (see playwright.config.ts): no sign-in happens here.

test('the admin sees the admin area', async ({ page, authorizeRequests }) => {
  await page.goto('/admin');

  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('admin'));
  await expect(page.getByTestId('admin-area')).toBeVisible();
  await expect(page.getByTestId('access-denied')).toHaveCount(0);
  expect(authorizeRequests, 'requests to the authorization endpoint').toHaveLength(0);
});

test('signing out shows sign-in again', async ({ page, authorizeRequests }) => {
  await page.goto('/');
  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('admin'));

  // Through HeyIdentity's end-session endpoint and back to /. Only this test's context is signed out;
  // the saved state file is unchanged.
  await page.getByTestId('sign-out').click();

  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
  expect(new URL(page.url()).pathname).toBe('/');
  expect(authorizeRequests, 'requests to the authorization endpoint').toHaveLength(0);
});
