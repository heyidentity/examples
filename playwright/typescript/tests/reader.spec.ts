import { expect, runsAlongside, savedIdentity, test } from './fixtures';

// Runs from playwright/.auth/reader.json only (see playwright.config.ts): no sign-in happens here.

test('the reader is denied the admin area', async ({ page, authorizeRequests }) => {
  await runsAlongside('reader', 'admin');
  await page.goto('/admin');

  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('reader'));
  await expect(page.getByTestId('access-denied')).toBeVisible();
  await expect(page.getByTestId('access-denied')).toContainText('Access denied');
  await expect(page.getByTestId('admin-area')).toHaveCount(0);
  expect(savedIdentity('reader'), 'a different identity than the admin').not.toBe(savedIdentity('admin'));
  expect(authorizeRequests, 'requests to the authorization endpoint').toHaveLength(0);
});
