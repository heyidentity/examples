import { expect, savedIdentity, settings, test } from './fixtures';
import { observeSignOut } from '../sign-out';

test('signing out shows sign-in again', async ({ page, context, authorizeRequests, discovery }) => {
  const home = `http://localhost:${settings.APP_PORT}/`;
  const signOut = observeSignOut(discovery.end_session_endpoint, home);
  context.on('request', (request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) signOut.record(request.url());
  });

  await page.goto('/');
  await expect(page.getByTestId('signed-in-user')).toHaveText(savedIdentity('admin'));
  await page.getByTestId('sign-out').click();

  await expect(page.getByTestId('sign-in')).toBeVisible();
  await expect(page.getByTestId('signed-in-user')).toHaveCount(0);
  await expect.poll(() => page.url() === home, { message: 'returned to the signed-out home URL' }).toBe(true);

  signOut.assertComplete();
  expect(authorizeRequests.length, 'requests to the authorization endpoint').toBe(0);
});
