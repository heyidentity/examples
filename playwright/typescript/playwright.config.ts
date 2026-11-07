import { defineConfig, devices } from '@playwright/test';
import { readSettings, stateFile } from './settings';

function settingsOrExit() {
  try {
    return readSettings();
  } catch (error) {
    // A missing setting is a usage error, not a crash: name it and the .env path, without a stack trace.
    console.error((error as Error).message);
    process.exit(1);
  }
}

const settings = settingsOrExit();
const baseURL = `http://localhost:${settings.APP_PORT}`;
const app = '../../apps/react';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // At least two workers, so the admin and reader projects run at the same time even on a 2-core CI runner.
  workers: 4,
  forbidOnly: !!process.env.CI,
  // Never retry: each retry of the setup project would be another sign-in.
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL,
    ...devices['Desktop Chrome'],
    // Traces and videos would hold tokens from the browser's storage and requests; keep them off.
    trace: 'off',
    video: 'off',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      // Signs in once per test user and saves playwright/.auth/<user>.json.
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
      use: { trace: 'off', screenshot: 'off', video: 'off' },
    },
    {
      name: 'admin',
      testMatch: /admin\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: stateFile('admin') },
    },
    {
      name: 'reader',
      testMatch: /reader\.spec\.ts/,
      dependencies: ['setup'],
      use: { storageState: stateFile('reader') },
    },
    {
      name: 'signed-out',
      testMatch: /signed-out\.spec\.ts/,
    },
  ],
  // Installs and starts the default app (CONTRACT.md: playwright/typescript -> apps/react).
  webServer: {
    command: `npm ci --prefix ${app} && npm --prefix ${app} run dev`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
