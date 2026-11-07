import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test as base, expect } from '@playwright/test';
import { identityFile, readSettings, runningDir } from '../settings';

export const settings = readSettings();

type Fixtures = {
  /** Requests this test's browser context sent to the configuration's authorization endpoint. */
  authorizeRequests: string[];
};

type WorkerFixtures = {
  /** The configuration's endpoints, from discovery. */
  discovery: { authorization_endpoint: string; end_session_endpoint: string };
};

export const test = base.extend<Fixtures, WorkerFixtures>({
  discovery: [
    async ({ playwright }, use) => {
      const api = await playwright.request.newContext();
      const response = await api.get(`${settings.OIDC_AUTHORITY}/.well-known/openid-configuration`);
      expect(response.ok(), 'discovery document').toBeTruthy();
      const document = await response.json();
      await api.dispose();
      expect(document.authorization_endpoint, 'authorization_endpoint').toBeTruthy();
      expect(document.end_session_endpoint, 'end_session_endpoint').toBeTruthy();
      await use(document);
    },
    { scope: 'worker' },
  ],
  authorizeRequests: async ({ context, discovery }, use) => {
    const seen: string[] = [];
    context.on('request', (request) => {
      if (request.url().startsWith(discovery.authorization_endpoint)) seen.push(request.url());
    });
    await use(seen);
  },
});

/** The `signed-in-user` text the setup project saw right after this user's sign-in. */
export function savedIdentity(role: 'admin' | 'reader'): string {
  return readFileSync(identityFile(role), 'utf8');
}

/**
 * In CI, proves that the admin and reader projects run at the same time: marks this role's test as started and
 * waits until the other role's test has started too. Run serially (one worker, or one project only), it fails.
 * Locally it does nothing, so a single project or `--workers 1` still works. The setup project clears the markers.
 */
export async function runsAlongside(self: 'admin' | 'reader', other: 'admin' | 'reader') {
  if (!process.env.CI) return;
  mkdirSync(runningDir, { recursive: true });
  writeFileSync(join(runningDir, self), new Date().toISOString());
  await expect
    .poll(() => existsSync(join(runningDir, other)), {
      message: `the ${other} test runs at the same time as the ${self} test`,
      timeout: 20_000,
    })
    .toBe(true);
}

export { expect };
