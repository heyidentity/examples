import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { authDir, identityFile, readSettings, stateFile } from '../settings';

const settings = readSettings();
const users = [
  { role: 'admin', key: settings.ADMIN_USER_KEY },
  { role: 'reader', key: settings.READER_USER_KEY },
] as const;

mkdirSync(authDir, { recursive: true });

// One real sign-in per test user (Authorization Code + PKCE through HeyIdentity's user picker), each in its own
// browser context, which Playwright closes after the test. The role tests then start from the saved state only.
for (const { role, key } of users) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('sign-in').click();

    // HeyIdentity's user picker: one button per user, test id authorize-btn-<lowercased key>.
    const user = page.getByTestId(`authorize-btn-${key.toLowerCase()}`);
    await user.click();

    // Back in the app, signed in. The role tests check that a fresh context restores exactly this identity.
    const signedIn = page.getByTestId('signed-in-user');
    await expect(signedIn).toBeVisible();
    const identity = (await signedIn.innerText()).trim();
    expect(identity).not.toBe('');

    await page.context().storageState({ path: stateFile(role) });
    writeFileSync(identityFile(role), identity);
  });
}
