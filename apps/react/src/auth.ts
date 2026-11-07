import { UserManager, WebStorageStateStore } from 'oidc-client-ts';

/** The browser-visible settings (see vite.config.ts envPrefix): nothing else from .env reaches the bundle. */
export const settings = {
  OIDC_AUTHORITY: import.meta.env.OIDC_AUTHORITY?.trim() ?? '',
  OIDC_CLIENT_ID: import.meta.env.OIDC_CLIENT_ID?.trim() ?? '',
};

export const missingSettings = (Object.keys(settings) as (keyof typeof settings)[]).filter((name) => !settings[name]);

const origin = window.location.origin;

/**
 * A public client: Authorization Code with S256 PKCE (oidc-client-ts's default), no secret.
 *
 * The user is kept in localStorage so that Playwright's storageState captures it. That is an example-only choice for
 * test automation; see README.md. Silent renew and session monitoring are off, so a restored browser context sends no
 * request to the authorization endpoint.
 */
export const userManager =
  missingSettings.length === 0
    ? new UserManager({
        authority: settings.OIDC_AUTHORITY,
        client_id: settings.OIDC_CLIENT_ID,
        redirect_uri: `${origin}/callback`,
        post_logout_redirect_uri: `${origin}/`,
        response_type: 'code',
        scope: 'openid profile',
        userStore: new WebStorageStateStore({ store: window.localStorage }),
        automaticSilentRenew: false,
        monitorSession: false,
      })
    : null;

/** The roles claim (Generic profile default: a top-level `roles` array in the ID token). */
export function rolesOf(profile: Record<string, unknown>): string[] {
  const roles = profile.roles;
  if (Array.isArray(roles)) return roles.map(String);
  return typeof roles === 'string' ? [roles] : [];
}
