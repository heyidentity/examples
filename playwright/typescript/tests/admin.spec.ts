import { expect, runsAlongside, savedIdentity, test } from './fixtures';

// Runs from playwright/.auth/admin.json only (see playwright.config.ts): no sign-in happens here.

test('the admin sees the admin area', async ({ page, authorizeRequests }) => {
  await runsAlongside('admin', 'reader');
  await page.goto('/admin');

  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('admin'));
  await expect(page.getByTestId('admin-area')).toBeVisible();
  await expect(page.getByTestId('access-denied')).toHaveCount(0);
  expect(authorizeRequests, 'requests to the authorization endpoint').toHaveLength(0);
});
