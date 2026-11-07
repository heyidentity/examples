import { defineConfig, devices } from '@playwright/test';
import { readAppSettings, repositoryRoot } from './settings';

// npx playwright test --config missing-settings.config.ts
//
// Starts the app under test a second time, on APP_PORT + 1, with OIDC_AUTHORITY and OIDC_CLIENT_ID set to empty in
// its environment (CONTRACT.md: that counts as missing, whatever .env says), and checks its missing-settings page.
// Needs no .env and sends nothing to HeyIdentity. The main configuration (playwright.config.ts) never runs it.

const app = readAppSettings();
const port = String(Number(app.APP_PORT) + 1);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  testMatch: /missing-settings\.spec\.ts/,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: { baseURL, ...devices['Desktop Chrome'], trace: 'off', video: 'off', screenshot: 'only-on-failure' },
  webServer: {
    command: app.EXAMPLE_APP_COMMAND,
    cwd: repositoryRoot,
    env: { APP_PORT: port, OIDC_AUTHORITY: '', OIDC_CLIENT_ID: '' },
    url: baseURL,
    // Never another app that happens to listen there: it would have settings.
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
