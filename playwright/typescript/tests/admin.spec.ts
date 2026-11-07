import { expect, runsAlongside, savedIdentity, settings, test } from './fixtures';

// Runs from playwright/.auth/admin.json only (see playwright.config.ts): no sign-in happens here.

test('the admin sees the admin area', async ({ page, authorizeRequests }) => {
  await runsAlongside('admin', 'reader');
  await page.goto('/admin');

  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('admin'));
  await expect(page.getByTestId('admin-area')).toBeVisible();
  await expect(page.getByTestId('access-denied')).toHaveCount(0);
  expect(authorizeRequests, 'requests to the authorization endpoint').toHaveLength(0);
});

test('signing out shows sign-in again', async ({ page, context, authorizeRequests, discovery }) => {
  const home = `http://localhost:${settings.APP_PORT}/`;
  // Every top-level navigation, in order, including redirects.
  const navigations: URL[] = [];
  context.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) navigations.push(new URL(request.url()));
  });
  const isEndSession = (url: URL) => `${url.origin}${url.pathname}` === discovery.end_session_endpoint;

  await page.goto('/');
  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('admin'));

  // Through HeyIdentity's end-session endpoint and back to /. Only this test's context is signed out;
  // the saved state file is unchanged.
  await page.getByTestId('sign-out').click();

  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
  await expect(page).toHaveURL(home);

  const endSession = navigations.filter(isEndSession);
  expect(endSession, 'navigations to the end-session endpoint').toHaveLength(1);
  expect(endSession[0].searchParams.get('id_token_hint'), 'id_token_hint').toBeTruthy();
  expect(endSession[0].searchParams.get('post_logout_redirect_uri')).toBe(home);

  const back = navigations.slice(navigations.indexOf(endSession[0]) + 1);
  expect(
    back.some((url) => `${url.origin}${url.pathname}` === home),
    'a navigation back to / after the end-session endpoint',
  ).toBe(true);
  expect(authorizeRequests, 'requests to the authorization endpoint').toHaveLength(0);
});
