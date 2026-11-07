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
| `OIDC_CLIENT_ID` | yes | The client the app signs in with, `example-app` in a temporary configuration. One public client serves every app (see [Configuration](#configuration)). |
| `ADMIN_USER_KEY` | yes | The key of a user whose `roles` claim contains `admin`. |
| `READER_USER_KEY` | yes | The key of a user whose `roles` claim contains `reader` and not `admin`. |
| `OIDC_CLIENT_SECRET` | only for a server-side app whose client checks secrets | The client secret. It never reaches a browser. |
| `APP_PORT` | no (default `5173`) | The port the app listens on, `http://localhost:<APP_PORT>`. Changing it changes both redirect URIs, so update them on the client too. |
| `EXAMPLE_APP_COMMAND` | no (default: the suite's default app) | A shell command, run from the repository root, that installs and starts the app under test on `APP_PORT`. Every suite runs it as its web server step; without it a suite installs and starts its [default app](#defaults). |

Browser apps expose only `OIDC_AUTHORITY` and `OIDC_CLIENT_ID` to the browser, never a secret or any other setting. No setting name may start with the name of a browser-exposed setting (for example `OIDC_CLIENT_ID_EXTRA`): build tools such as Vite expose settings by name prefix, so such a setting would reach the browser too.

### Missing settings

Every app, suite and `setup/` names each missing setting and the `.env` path, and prints no values. A browser app shows `Missing setting: <NAME> in .env` on every route instead of `sign-in`. An app treats a setting that is set to empty in its process environment as missing, whatever `.env` says, so a suite can start it without settings (the TypeScript suite's `missing-settings.config.ts`).

## Configuration

A HeyIdentity configuration with the **Generic** profile, containing:

- **One public client** with ID `OIDC_CLIENT_ID` (`example-app` in a temporary configuration) that serves every app: every app uses the same two redirect URIs on `APP_PORT`, exactly:
  - `http://localhost:<APP_PORT>/callback` (sign-in callback)
  - `http://localhost:<APP_PORT>/` (sign-out return; HeyIdentity accepts a `post_logout_redirect_uri` only when it is one of the client's redirect URIs)

  Sign-in uses Authorization Code with S256 PKCE. "Allow all return URLs" (`allow_all_return_urls`) stays off. HeyIdentity checks a client secret only when the client's `validate_client_secrets` is on; `setup/provision.mjs` leaves it off, so browser and server-side apps share the client. A server-side app that turns it on adds `OIDC_CLIENT_SECRET`.
- **An admin user** (key `ADMIN_USER_KEY`) with the claim `roles: ["admin"]`.
- **A reader user** (key `READER_USER_KEY`) with the claim `roles: ["reader"]`.

Roles are lowercase. `roles` is a top-level array claim in the ID token, which is the Generic profile's default: a user claim goes into the ID and access tokens unless you target it otherwise, and the Generic roles claim name is `roles`. Give both users a display name; apps show it.

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

## Saved state

Every suite writes its per-user saved state (for example Playwright `storageState`) and identity files only under `<suite>/playwright/.auth/`, for example `playwright/typescript/playwright/.auth/admin.json`. That folder is git-ignored (`**/playwright/.auth/`), excluded from CI artifacts and removed at the end of each CI run. It holds the users' tokens: never write them anywhere else, and never commit or upload them.

## Defaults

Each suite starts its default app unless `EXAMPLE_APP_COMMAND` is set:

| Suite | Default app |
|---|---|
| `playwright/typescript` | `apps/react` (installed with `npm ci` unless already installed, then `npm run dev`) |
