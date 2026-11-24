import { expect } from '@playwright/test';

/** Store only counts and booleans so a failed assertion cannot dump credential-bearing navigation URLs. */
export function observeSignOut(endSessionEndpoint: string, home: string) {
  let endSessionCount = 0;
  let sentIdTokenHint = false;
  let sentExactReturnUrl = false;
  let returnedHome = false;

  return {
    record(requestUrl: string) {
      const url = new URL(requestUrl);
      const endpoint = `${url.origin}${url.pathname}`;
      if (endpoint === endSessionEndpoint) {
        endSessionCount++;
        sentIdTokenHint = !!url.searchParams.get('id_token_hint');
        sentExactReturnUrl = url.searchParams.get('post_logout_redirect_uri') === home;
      }
      if (endSessionCount > 0 && endpoint === home) returnedHome = true;
    },
    assertComplete() {
      expect(endSessionCount, 'navigations to the end-session endpoint').toBe(1);
      expect(sentIdTokenHint, 'sent an ID-token hint').toBe(true);
      expect(sentExactReturnUrl, 'sent the exact post-logout return URL').toBe(true);
      expect(returnedHome, 'navigated back to / after the end-session endpoint').toBe(true);
    },
  };
}
