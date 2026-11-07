# Playwright tests (TypeScript)

Playwright tests that sign in through HeyIdentity **once per test user**, save each user's browser state, and run the role tests in parallel from the saved state, without another sign-in. They start their default app, [`apps/react`](../../apps/react), themselves and rely only on the [contract](../../CONTRACT.md): its routes, test ids and HeyIdentity's picker control `authorize-btn-<lowercased user key>`.

| Project | What it does |
|---|---|
| `setup` | Signs in as `ADMIN_USER_KEY` and as `READER_USER_KEY`, each in its own browser context, by clicking `authorize-btn-<key>` on HeyIdentity's user picker. Saves `playwright/.auth/admin.json` and `reader.json`. Traces, screenshots and videos are off. |
| `admin` | From `admin.json` only: `/admin` shows the user and `admin-area`; signing out shows `sign-in` again. |
| `reader` | From `reader.json` only: `/admin` shows the user and `access-denied`. |
| `signed-out` | Without saved state: `sign-in` is shown, and a callback error shows `sign-in-error`. |

`admin` and `reader` run in parallel after `setup`, and each test checks that its browser context sent **zero requests** to the configuration's authorization endpoint (read from discovery).

## Run the tests

You need Node.js 22.12 or later.

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples/playwright/typescript
npm ci
npx playwright install
```

Create the settings file `.env` in the repository root, either with a temporary configuration (no account needed):

```sh
node ../../setup/provision.mjs --temporary
```

It prints the [Terms of Use](https://heyidentity.dev/terms.html) URL and asks you to type the current version to accept them (or set `HEYIDENTITY_ACCEPT_TERMS` to it). The configuration expires after 7 days unless you claim it; see [setup/README.md](../../setup/README.md) for what it creates and what `.heyidentity/agent-token` is for.

or from your own configuration ([prepare it first](#prepare-your-own-configuration)):

```sh
cp ../../.env.example ../../.env
```

and fill in `OIDC_AUTHORITY`, `OIDC_CLIENT_ID`, `ADMIN_USER_KEY` and `READER_USER_KEY`. Then:

```sh
npx playwright test
```

The `webServer` in `playwright.config.ts` runs `npm ci` and `npm run dev` in `apps/react` and waits for `http://localhost:5173` (or `APP_PORT`). Locally it reuses a server that already listens there, so stop any other app on that port or set `APP_PORT` (and change both redirect URIs to match).

Watch a run with `npx playwright test --headed`: you see the example app, HeyIdentity's user picker and the way back.

When a setting is missing, the run stops before starting anything and names it, for example `Missing setting: OIDC_CLIENT_ID in /path/to/heyidentity-examples/.env`. Check your settings without running tests with `node ../../setup/provision.mjs`.

## Prepare your own configuration

In HeyIdentity, use a configuration dedicated to these tests with the **Generic** profile:

1. **Client** (Clients → Add): a client ID of your choice (for `OIDC_CLIENT_ID`), no secret, and exactly these two redirect URIs:
   - `http://localhost:5173/callback`
   - `http://localhost:5173/`

   Leave "accept any redirect URI" off. Changing `APP_PORT` changes both.
2. **Users** (Users → Add):
   - an admin user, for example key `admin`, display name `Ada Admin`, claim `roles` = `["admin"]`;
   - a reader user, for example key `reader`, display name `Riley Reader`, claim `roles` = `["reader"]`.

   Roles are lowercase. Keep the `roles` claim in the ID token (the default target, "both tokens"). Use fictional people only.
3. **Settings** (Connect your app): copy the Authority (issuer) to `OIDC_AUTHORITY`.

With two or more users, HeyIdentity always shows its user picker, which the setup project clicks. Saved state is not session pinning: pinning (a Pro feature) skips the picker in one browser, while saved state restores the app's own sign-in, works on every plan and needs no picker at all after setup.

What you see when something is missing:

| Missing | What fails |
|---|---|
| The callback redirect URI | HeyIdentity answers the sign-in with `invalid_request` "redirect_uri is not registered for this client." and the `setup` project fails waiting for `authorize-btn-<key>`. |
| The sign-out redirect URI | Sign-out ends on HeyIdentity's "You are signed out" page instead of returning to the app; `signing out shows sign-in again` fails. |
| The client ID | HeyIdentity answers `invalid_request` "Unknown client_id."; `setup` fails. |
| A user, or a wrong key in `.env` | `setup` fails waiting for `authorize-btn-<key>` on the picker. |
| The `admin` role, or the role only in the access token | The admin test sees `access-denied` instead of `admin-area`. |

## Saved state and cleanup

The setup project writes `playwright/.auth/admin.json`, `reader.json` and their `*.identity.txt` (the `signed-in-user` text seen at sign-in). They contain the users' tokens: they are git-ignored, are never uploaded by the CI workflow, and are replaced on every run. Delete them with:

```sh
rm -rf playwright/.auth test-results playwright-report
```

The app keeps the signed-in user in `localStorage` only so that Playwright's `storageState` can save and restore it; silent renew is off, so a restored context never contacts HeyIdentity. When a token expires (the configuration's token lifetime), run the tests again: setup signs in anew.

## Rate limits

Requests are rate limited per source and per tenant, and nothing retries a rejected sign-in automatically. How your suite gets tokens decides which plan it fits:

| How the suite signs in | Plan |
|---|---|
| One sign-in per test user, reused for the whole run (Playwright storage state, as here, or a cached token) | Free |
| One sign-in per test class or fixture | Pro, within its burst |
| A fresh sign-in or token request per test | Not recommended on any plan. From one runner it is stopped by the per-source limits, which no plan raises. |

Creating temporary configurations is limited separately: 10 per source address and 100 overall per hour. See [all limits](https://heyidentity.dev/docs/limits.html).

## CI in your own repository

This repository's own workflow ([`react-typescript.yml`](../../.github/workflows/react-typescript.yml)) creates a temporary configuration per run. In your own repository, use your own configuration instead: store its settings as repository variables (they are not secrets for a public client) and write `.env` from them. A copyable workflow, for a repository laid out like this one:

```yaml
name: E2E

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - name: Write .env from repository variables
        run: |
          {
            echo "OIDC_AUTHORITY=${{ vars.OIDC_AUTHORITY }}"
            echo "OIDC_CLIENT_ID=${{ vars.OIDC_CLIENT_ID }}"
            echo "ADMIN_USER_KEY=${{ vars.ADMIN_USER_KEY }}"
            echo "READER_USER_KEY=${{ vars.READER_USER_KEY }}"
          } > .env
      - run: npm ci
        working-directory: playwright/typescript
      - run: npx playwright install --with-deps
        working-directory: playwright/typescript
      - run: npx playwright test
        working-directory: playwright/typescript
      - if: always()
        run: rm -rf .env playwright/typescript/playwright/.auth
      - if: always()
        uses: actions/upload-artifact@v7
        with:
          name: playwright-report
          path: playwright/typescript/playwright-report/
          if-no-files-found: ignore
```

A server-side app would also need `OIDC_CLIENT_SECRET`; take it from a repository secret, never a variable. Keep traces and videos off (as `playwright.config.ts` does) or don't upload them: they can contain the users' tokens.
