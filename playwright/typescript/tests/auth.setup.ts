import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { authDir, identityFile, runningDir, stateFile } from '../settings';
import { expect, settings, test as setup } from './fixtures';

const users = [
  { role: 'admin', key: settings.ADMIN_USER_KEY },
  { role: 'reader', key: settings.READER_USER_KEY },
] as const;

mkdirSync(authDir, { recursive: true });
// The admin and reader tests mark their start here (tests/fixtures.ts runsAlongside); clear the previous run's markers.
rmSync(runningDir, { recursive: true, force: true });

// One real sign-in per test user (Authorization Code + PKCE through HeyIdentity's user picker), each in its own
// browser context, which Playwright closes after the test. The role tests then start from the saved state only.
for (const { role, key } of users) {
  setup(`sign in as ${role}`, async ({ page, discovery }) => {
    await page.goto('/');
    const authorizeEndpoint = new URL(discovery.authorization_endpoint);
    const [authorizeRequest] = await Promise.all([
      page.waitForRequest((request) => {
        const url = new URL(request.url());
        return request.isNavigationRequest() &&
          url.origin === authorizeEndpoint.origin && url.pathname === authorizeEndpoint.pathname;
      }),
      page.getByTestId('sign-in').click(),
    ]);
    const authorizeParams = new URL(authorizeRequest.url()).searchParams;
    expect(authorizeParams.get('response_type') === 'code', 'authorization code request').toBe(true);
    expect(authorizeParams.get('code_challenge_method') === 'S256', 'S256 PKCE method').toBe(true);
    expect(/^[A-Za-z0-9_-]{43}$/.test(authorizeParams.get('code_challenge') ?? ''), 'S256 challenge').toBe(true);

    const callback = new URL(authorizeParams.get('redirect_uri') ?? '', page.url());
    if (settings.EXAMPLE_OIDC_CALLBACK_PATH) {
      expect(callback.pathname === settings.EXAMPLE_OIDC_CALLBACK_PATH, 'registered callback path').toBe(true);
    }

    // HeyIdentity's user picker: one button per user, test id authorize-btn-<lowercased key>.
    const user = page.getByTestId(`authorize-btn-${key.toLowerCase()}`);
    await user.click();

    // Back in the app, signed in. The role tests check that a fresh context restores exactly this identity.
    const signedIn = page.getByTestId('signed-in-user');
    await expect(signedIn).toBeVisible();
    const identity = (await signedIn.innerText()).trim();
    expect(identity).not.toBe('');

    // An app that serves an Auth.js session as JSON must expose only the browser session fields, never a token.
    const response = await page.request.get('/api/auth/session');
    if (response.ok() && (response.headers()['content-type'] ?? '').startsWith('application/json')) {
      const session = await response.json();
      expect(typeof session?.user?.name === 'string' && identity.includes(session.user.name),
        'Auth.js session belongs to the signed-in user').toBe(true);
      expect(Object.keys(session).every((key) => ['user', 'expires', 'roles'].includes(key)) &&
        Object.keys(session.user).every((key) => ['name', 'email', 'image'].includes(key)),
      'Auth.js exposes only the expected browser session fields').toBe(true);
    }

    await page.context().storageState({ path: stateFile(role) });
    writeFileSync(identityFile(role), identity);
  });
}
