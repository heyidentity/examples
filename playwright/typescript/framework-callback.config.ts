import { defineConfig, devices } from '@playwright/test';
import { readAppSettings, repositoryRoot } from './settings';

const app = readAppSettings();
const port = String(Number(app.APP_PORT) + 1);
const providerPort = Number(app.APP_PORT) + 2;
const instance = `http://127.0.0.1:${providerPort}/`;
const tenant = '76ca27b0-bf39-46cd-9528-32a86f8eff5a';
const microsoft = process.env.EXAMPLE_OIDC_CALLBACK_PATH === '/signin-oidc';
const issuer = instance + (microsoft ? tenant + '/v2.0' : 'oidc');

export default defineConfig({
  testDir: './tests',
  testMatch: /framework-callback\.spec\.ts/,
  reporter: 'list',
  use: {
    ...devices['Desktop Chrome'],
    baseURL: `http://localhost:${port}`,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  webServer: [
    {
      command: `node playwright/typescript/stub-discovery.mjs ${providerPort} ${issuer}`,
      cwd: repositoryRoot,
      url: issuer + '/.well-known/openid-configuration',
      reuseExistingServer: false,
    },
    {
      command: app.EXAMPLE_APP_COMMAND,
      cwd: repositoryRoot,
      url: `http://localhost:${port}`,
      env: {
        APP_PORT: port,
        OIDC_AUTHORITY: issuer,
        OIDC_CLIENT_ID: 'offline-example',
        AUTH_SECRET: 'offline-callback-fixture-no-real-credentials',
        ENTRA_INSTANCE: instance,
        ENTRA_TENANT_ID: tenant,
      },
      reuseExistingServer: false,
    },
  ],
});
