# Example contract

The browser apps and Playwright suites share the settings, routes, test IDs and picker control below. The ASP.NET Core API integration example shares the root settings file and picker control and runs its own API tests.

## Settings file

There is one settings file: `.env` at the repository root (next to this file). Every app, suite and `setup/` reads it, and every missing-setting message names that path. `.env.example` is its template; `.env` is git-ignored.

Create it in one of two ways:

- **Your own configuration:** `cp .env.example .env`, then fill in the settings below.
- **No account:** `node setup/provision.mjs --temporary` creates a temporary configuration and writes `.env` for you (it asks you to accept the HeyIdentity Terms of Use; the configuration expires after 7 days unless claimed).

## Settings

### Settings file grammar

Every example reads `.env` the same way, and `setup/provision.mjs` writes only this:

- One `NAME=value` per line. Lines that are empty or start with `#` (after any spaces) are ignored.
- A value is either unquoted, with no `#`, quote or surrounding spaces, or wrapped in one pair of `"` or `'` with no backslash or matching quote inside. Anything after the closing quote is ignored. There are no escapes and no inline comments.
- A variable already set in the process environment wins over `.env`. A value that is empty counts as missing.

`setup/settings-grammar.env` and `setup/settings-grammar.json` pin this grammar: the Node, C# and Java readers each parse the file in their example's offline check and must produce the JSON.

| Setting | Required | Meaning |
|---|---|---|
| `OIDC_AUTHORITY` | yes | The configuration's issuer, for example `https://app.heyidentity.dev/t/<tenantRouteId>/c/<configurationId>`. Discovery is at `<OIDC_AUTHORITY>/.well-known/openid-configuration`. |
| `OIDC_CLIENT_ID` | yes | The client the app signs in with, `example-app` in a temporary configuration. |
| `ADMIN_USER_KEY` | yes | The key of a user whose `roles` claim contains `admin`. |
| `READER_USER_KEY` | yes | The key of a user whose `roles` claim contains `reader` and not `admin`. |
| `OIDC_CLIENT_SECRET` | only for a server-side app whose client checks secrets | The client secret. It never reaches a browser. |
| `ENTRA_INSTANCE`, `ENTRA_TENANT_ID` | Blazor | The Entra instance URL with a trailing slash and the HeyIdentity configuration ID. Set `OIDC_AUTHORITY` to the Entra issuer. |
| `AUTH_SECRET` | Next.js | A separate generated secret for Auth.js sessions. Keep it on the server. |
| `API_AUDIENCE` | ASP.NET Core API integration | The client's configured access-token audience. It differs from `OIDC_CLIENT_ID`. |
| `APP_PORT` | no (default `5173`) | The local app port. Changing it changes each registered URL. |
| `EXAMPLE_OIDC_CALLBACK_PATH` | no | The app's protocol callback path, for example `/signin-oidc`. When set, suite setup checks that the authorize request's `redirect_uri` uses it. |
| `EXAMPLE_CALLBACK_ERRORS` | no (default `provider`) | `normalized` when the app's framework replaces the provider's error with its own code, as Auth.js does. The offline callback-failure check (`framework-callback.config.ts`) then expects a non-empty `code: message` instead of the provider's exact error. |
| `EXAMPLE_APP_COMMAND` | no (default: the suite's default app) | A shell command, run from the repository root, that installs and starts the app under test on `APP_PORT`. Every suite runs it as its web server step; without it a suite installs and starts its [default app](#defaults). |

Browser apps expose only `OIDC_AUTHORITY` and `OIDC_CLIENT_ID` to the browser, never a secret or any other setting. No setting name may start with the name of a browser-exposed setting (for example `OIDC_CLIENT_ID_EXTRA`): build tools such as Vite expose settings by name prefix, so such a setting would reach the browser too.

### Missing settings

Every app, suite and `setup/` names each missing setting and the `.env` path, and prints no values. A browser app shows `Missing setting: <NAME> in .env` on every route instead of `sign-in`. An app treats a setting that is set to empty in its process environment as missing, whatever `.env` says, so a suite can start it without settings (the TypeScript suite's `missing-settings.config.ts`).

## Configuration

A HeyIdentity configuration with the **Generic** profile for React, Next.js, Spring Boot and the API integration example, or **Microsoft** for Blazor, containing:

- **A client** with ID `OIDC_CLIENT_ID` (`example-app` in a temporary configuration). Temporary setup registers all of these paths on the exact `http://localhost:<APP_PORT>` origin:
  - `/callback` for React and the ASP.NET Core integration fixture.
  - `/api/auth/callback/heyidentity` for Next.js.
  - `/login/oauth2/code/heyidentity` for Spring Boot.
  - `/signin-oidc` for Blazor.
  - `/` for the exact sign-out return URL used by browser apps.

  Sign-in uses Authorization Code with S256 PKCE. "Allow all return URLs" (`allow_all_return_urls`) stays off. HeyIdentity checks a client secret only when the client's `validate_client_secrets` is on; `setup/provision.mjs` leaves it off, so browser and server-side apps share the client. A server-side app that turns it on adds `OIDC_CLIENT_SECRET`.
- **An admin user** (key `ADMIN_USER_KEY`) with the claim `roles: ["admin"]`.
- **A reader user** (key `READER_USER_KEY`) with the claim `roles: ["reader"]`.

Roles are lowercase. `roles` is a top-level array claim in the ID token, which is the Generic profile's default: a user claim goes into the ID and access tokens unless you target it otherwise, and the Generic roles claim name is `roles`. Give both users a display name; apps show it.

With two or more users and no pinned user, HeyIdentity shows its user picker, so a suite can choose the user. Normal sign-ins omit `prompt`.

When switching examples, reuse an active configuration only if its profile, issuer, settings, callback URLs and API audience match. Use a separate checkout if they differ or the temporary tenant has expired. Stop the previous local app or use an unused port with matching registered URLs. See [temporary setup and recovery](setup/README.md).

## Routes

| Route | What it shows |
|---|---|
| `/` | Home. Signed out: the `sign-in` button. Signed in: `signed-in-user` and `sign-out`. |
| `/callback` | The shared error page. It shows `sign-in-error` and `sign-in`. React also handles its protocol callback here. |
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
