import { readFileSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { identityFile, readSettings } from '../settings';

const settings = readSettings();

type Fixtures = {
  /** Requests this test's browser context sent to the configuration's authorization endpoint. */
  authorizeRequests: string[];
};

type WorkerFixtures = {
  /** The configuration's authorization_endpoint, from discovery. */
  authorizationEndpoint: string;
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  authorizationEndpoint: [
    async ({ playwright }, use) => {
      const api = await playwright.request.newContext();
      const response = await api.get(`${settings.OIDC_AUTHORITY}/.well-known/openid-configuration`);
      expect(response.ok(), 'discovery document').toBeTruthy();
      const endpoint = (await response.json()).authorization_endpoint as string;
      await api.dispose();
      await use(endpoint);
    },
    { scope: 'worker' },
  ],
  authorizeRequests: async ({ context, authorizationEndpoint }, use) => {
    const seen: string[] = [];
    context.on('request', (request) => {
      if (request.url().startsWith(authorizationEndpoint)) seen.push(request.url());
    });
    await use(seen);
  },
});

/** The `signed-in-user` text the setup project saw right after this user's sign-in. */
export function savedIdentity(role: 'admin' | 'reader'): string {
  return readFileSync(identityFile(role), 'utf8');
}

export { expect };
