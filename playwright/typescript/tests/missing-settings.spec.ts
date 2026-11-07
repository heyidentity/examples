import { expect, test } from '@playwright/test';

// Runs only from missing-settings.config.ts: the app is started without OIDC_AUTHORITY and OIDC_CLIENT_ID.

for (const path of ['/', '/admin']) {
  test(`without settings ${path} names each missing setting and .env`, async ({ page }) => {
    await page.goto(path);

    for (const name of ['OIDC_AUTHORITY', 'OIDC_CLIENT_ID']) {
      await expect(page.getByText(`Missing setting: ${name} in .env`)).toBeVisible();
    }
    await expect(page.getByTestId('sign-in')).toHaveCount(0);
    await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
  });
}
