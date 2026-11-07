# Example contract

Every app in `apps/` and every Playwright suite in `playwright/` follows this contract, so any suite can run against any app. A suite relies only on the settings, routes, test ids and picker control below, never on an app's own markup.

## Settings file

There is one settings file: `.env` at the repository root (next to this file). Every app, suite and `setup/` reads it, and every missing-setting message names that path. `.env.example` is its template; `.env` is git-ignored.

Create it in one of two ways:

- **Your own configuration:** `cp .env.example .env`, then fill in the settings below.
- **No account:** `node setup/provision.mjs --temporary` creates a temporary configuration and writes `.env` for you (it asks you to accept the HeyIdentity Terms of Use; the configuration expires after 7 days unless claimed).

## Settings

| Setting | Required | Meaning |
|---|---|---|
| `OIDC_AUTHORITY` | yes | The configuration's issuer, for example `https://app.heyidentity.dev/t/<tenantRouteId>/c/<configurationId>`. Discovery is at `<OIDC_AUTHORITY>/.well-known/openid-configuration`. |
| `OIDC_CLIENT_ID` | yes | The client the app signs in with. Browser apps use a public client (no secret). |
| `ADMIN_USER_KEY` | yes | The key of a user whose `roles` claim contains `admin`. |
| `READER_USER_KEY` | yes | The key of a user whose `roles` claim contains `reader` and not `admin`. |
| `OIDC_CLIENT_SECRET` | server-side apps only | The client secret. It never reaches a browser. |
| `APP_PORT` | no (default `5173`) | The port the app listens on, `http://localhost:<APP_PORT>`. Changing it changes both redirect URIs. |

Browser apps expose only `OIDC_AUTHORITY` and `OIDC_CLIENT_ID` to the browser, never a secret or any other setting.

## Configuration

A HeyIdentity configuration with the **Generic** profile, containing:

- **A client** with ID `OIDC_CLIENT_ID`. For browser apps it is a public client (no secret; sign-in uses Authorization Code with S256 PKCE). Its redirect URIs are exactly:
  - `http://localhost:<APP_PORT>/callback` (sign-in callback)
  - `http://localhost:<APP_PORT>/` (sign-out return; HeyIdentity accepts a `post_logout_redirect_uri` only when it is one of the client's redirect URIs)

  "Accept any redirect URI" (`allow_all_return_urls`) stays off.
- **An admin user** (key `ADMIN_USER_KEY`) with the claim `roles: ["admin"]`.
- **A reader user** (key `READER_USER_KEY`) with the claim `roles: ["reader"]`.

Roles are lowercase. `roles` is a top-level claim in the ID token, which is the Generic profile's default: a user claim goes into the ID and access tokens unless you target it otherwise, and the Generic roles claim name is `roles`. Give both users a display name; apps show it.

With two or more users and no pinned user, HeyIdentity always shows its user picker, so a suite can choose the user. Apps never send `prompt` on a normal sign-in.

## Routes

| Route | What it shows |
|---|---|
| `/` | Home. Signed out: the `sign-in` button. Signed in: `signed-in-user` and `sign-out`. |
| `/callback` | The sign-in callback. On success it returns to `/`; on an error it shows `sign-in-error` and `sign-in`. |
| `/admin` | The admin view. Signed in: `signed-in-user`, then `admin-area` for a user with the `admin` role, or `access-denied` for anyone else. |

## Test ids

Each is a `data-testid` attribute.

| Test id | Element |
|---|---|
| `sign-in` | The button that starts sign-in. Visible whenever no one is signed in, including after sign-out and after a sign-in error. |
| `signed-in-user` | Shows who is signed in; its text contains the user's display name (the `name` claim). |
| `admin-area` | The admin view's content, shown only to a user whose `roles` claim contains `admin`. |
| `access-denied` | Shown on `/admin` to a signed-in user without the `admin` role; its text says "Access denied". |
| `sign-out` | The button that signs out through HeyIdentity's end-session endpoint and returns to `/`, where `sign-in` is visible again. |
| `sign-in-error` | Shown when the callback returns an error; its text contains the `error` code and `error_description`. |

## Picker

Suites select the user on HeyIdentity's user picker with the test id `authorize-btn-<user key, lowercased>`:

```ts
await page.getByTestId(`authorize-btn-${userKey.toLowerCase()}`).click();
```

The button's text contains the user's display name.

## Defaults

Each suite has a default app it starts:

| Suite | Default app |
|---|---|
| `playwright/typescript` | `apps/react` |
