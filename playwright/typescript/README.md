# Playwright tests (TypeScript)

Playwright tests that sign in through HeyIdentity **once per test user**, save each user's browser state, and run the role tests in parallel from the saved state, without another sign-in. They start their default app, [`apps/react`](../../apps/react), themselves and rely only on the [contract](../../CONTRACT.md): its routes, test ids and HeyIdentity's picker control `authorize-btn-<lowercased user key>`.

## Run the tests

You need Node.js 22.12 or later and Git. The commands work in bash, zsh and PowerShell.

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

It prints the [Terms of Use](https://heyidentity.dev/terms.html) URL and asks you to type the current version to accept them (in scripts and CI, set `HEYIDENTITY_ACCEPT_TERMS` instead). The configuration expires after 7 days unless you claim it; see [setup/README.md](../../setup/README.md) for what it creates and what `.heyidentity/agent-token` is for.

or from your own configuration ([prepare it first](#prepare-your-own-configuration)):

```sh
cp ../../.env.example ../../.env
```

and fill in `OIDC_AUTHORITY`, `OIDC_CLIENT_ID`, `ADMIN_USER_KEY` and `READER_USER_KEY`. Then:

```sh
npx playwright test
```

The `webServer` in `playwright.config.ts` runs `EXAMPLE_APP_COMMAND` from the repository root, or by default `start-default-app.mjs`, which runs `npm ci` in `apps/react` unless it is already installed from the current `package-lock.json` and then `npm run dev`. It waits for `http://localhost:5173` (or `APP_PORT`). Locally it reuses a server that already listens there, so stop any other app on that port or set `APP_PORT` (and change both redirect URIs to match).

Watch a run with `npx playwright test --headed`: you see the example app, HeyIdentity's user picker and the way back.

When a setting is missing, the run stops before starting anything and names it, for example `Missing setting: OIDC_CLIENT_ID in /path/to/heyidentity-examples/.env`. Check your settings without running tests with `node ../../setup/provision.mjs`.

### Another app

To test another app that follows the [contract](../../CONTRACT.md), set `EXAMPLE_APP_COMMAND` in `.env` (or the environment; `.env` wins) to a shell command that installs and starts it on `APP_PORT`, for example `EXAMPLE_APP_COMMAND=npm ci --prefix apps/other && npm --prefix apps/other start`. The same client, users and redirect URIs serve it.

## What the tests check

| Project | What it does |
|---|---|
| `setup` | Signs in as `ADMIN_USER_KEY` and as `READER_USER_KEY`, each in its own browser context, by clicking `authorize-btn-<key>` on HeyIdentity's user picker. Saves `playwright/.auth/admin.json` and `reader.json`. Traces, screenshots and videos are off. |
| `admin` | From `admin.json` only: `/admin` shows the user and `admin-area`; signing out navigates once to the end-session endpoint (from discovery) with `id_token_hint` and `post_logout_redirect_uri=http://localhost:<APP_PORT>/`, returns to `/` and shows `sign-in` again. |
| `reader` | From `reader.json` only: `/admin` shows the user and `access-denied`. |
| `signed-out` | Without saved state: `sign-in` is shown, and a callback error shows `sign-in-error`. |

`admin` and `reader` run in parallel after `setup`, and each test checks that its browser context sent **zero requests** to the configuration's authorization endpoint (read from discovery). In CI (`CI` set) the admin and reader tests also prove they overlap: each marks its start under `playwright/.auth/running/` and waits up to 20 seconds for the other's mark, so a serial run fails.

A separate configuration, `missing-settings.config.ts`, starts the app a second time on `APP_PORT + 1` with `OIDC_AUTHORITY` and `OIDC_CLIENT_ID` set to empty and checks that `/` and `/admin` name each missing setting and `.env`. It needs no `.env` and contacts no HeyIdentity:

```sh
npx playwright test --config missing-settings.config.ts
```

## Prepare your own configuration

In HeyIdentity, use a configuration dedicated to these tests, with the profile **Generic OIDC / OAuth 2.0**:

1. **Client** (Clients → Add): a client ID of your choice (for `OIDC_CLIENT_ID`; a temporary configuration uses `example-app`), an empty client secret, and exactly these two redirect URIs:
   - `http://localhost:5173/callback`
   - `http://localhost:5173/`

   Leave "Allow all return URLs" off. Changing `APP_PORT` changes both.
2. **Users** (Users → Add):
   - an admin user, for example key `admin`, display name `Ada Admin`, claim `roles` of type `array` with the value `admin`;
   - a reader user, for example key `reader`, display name `Riley Reader`, claim `roles` of type `array` with the value `reader`.

   Roles are lowercase. Keep the claim's token target at "ID and access tokens" (the default), so `roles` is in the ID token. Use fictional people only.
3. **Connect your app**: copy Authority (issuer) to `OIDC_AUTHORITY`.

With two or more users and no pinned user, HeyIdentity always shows its user picker, which the setup project clicks. Saved state is not session pinning: pinning (a Pro feature) skips the picker in one browser, while saved state restores the app's own sign-in, works on every plan and needs no picker at all after setup.

What you see when something is missing:

| Missing | What fails |
|---|---|
| The callback redirect URI | HeyIdentity answers the sign-in with `invalid_request` "redirect_uri is not registered for this client." and the `setup` project fails waiting for `authorize-btn-<key>`. |
| The sign-out redirect URI | Sign-out ends on HeyIdentity's "You are signed out" page instead of returning to the app; `signing out shows sign-in again` fails. |
| The client ID | HeyIdentity answers `invalid_request` "Unknown client_id."; `setup` fails. |
| A user, or a wrong key in `.env` | `setup` fails waiting for `authorize-btn-<key>` on the picker. |
| The `admin` role, or the role only in the access token | The admin test sees `access-denied` instead of `admin-area`. |

## Saved state and cleanup

The setup project writes `playwright/.auth/admin.json`, `reader.json` and their `*.identity.txt` (the `signed-in-user` text seen at sign-in), and nothing outside `playwright/.auth/` (the contract's [saved state](../../CONTRACT.md#saved-state) rule). They contain the users' tokens: they are git-ignored, are never uploaded by the CI workflow, and are replaced on every run. Delete them with:

```sh
rm -rf playwright/.auth test-results playwright-report
```

In PowerShell:

```powershell
Remove-Item -Recurse -Force -ErrorAction SilentlyContinue playwright/.auth, test-results, playwright-report
```

The app keeps the signed-in user in `localStorage` only so that Playwright's `storageState` can save and restore it; silent renew is off, so a restored context never contacts HeyIdentity. When a token expires (the configuration's token lifetime), run the tests again: setup signs in anew.

## Rate limits

Requests are rate limited per source and per tenant, and nothing retries a rejected sign-in automatically. How your suite gets tokens decides which plan it fits:

| How the suite signs in | Plan |
|---|---|
| One sign-in per test user, reused for the whole run (Playwright storage state, as here, or a cached token) | Free |
| One sign-in per test class or fixture | Pro, within its burst |
| A fresh sign-in or token request per test | Not recommended on any plan. From one runner it is stopped by the per-source limits, which no plan raises. |

Creating temporary configurations is limited separately: 10 per source address and 100 overall per hour. See [all limits](https://heyidentity.dev/docs/limits.html?utm_source=github).

## CI in your own repository

This repository's own workflow ([`react-typescript.yml`](../../.github/workflows/react-typescript.yml)) has two jobs:

- **`checks`**, on every trigger, including pull requests from forks, without any HeyIdentity configuration: `node --test setup/*.test.mjs`, a build of `apps/react` with a random `OIDC_CLIENT_SECRET` marker in `.env` that fails if the marker reaches `apps/react/dist`, and the missing-settings check.
- **`test`** creates one temporary configuration per run and runs this suite: on staging for pushes to `main`, same-repository pull requests and manual runs, and on staging and production nightly. To re-run the nightly matrix by hand, run the workflow with `environments` = `staging and production` (Actions → React + TypeScript → Run workflow, or `gh workflow run react-typescript.yml -f environments="staging and production"`). All installs run before the configuration is created, so no install script runs while the agent token is on disk.

The job's `if:` skips `test` for pull requests from forks, but that only prevents accidental runs: whoever can change a pull request can change the workflow file in it. The real control is the repository setting **Settings → Actions → General → "Require approval for all external contributors"**, which the maintainer keeps on, so no fork's workflow runs before a maintainer has reviewed it.

In your own repository, use your own configuration instead: store its settings as repository variables (they are not secrets for a public client) and write `.env` from them. A copyable workflow, for a repository laid out like this one (it uses version tags for brevity; pin each action to a full commit SHA, as `react-typescript.yml` does, so a moved tag can't change what runs):

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
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: 24
      - run: npm ci
        working-directory: playwright/typescript
      - run: npx playwright install --with-deps
        working-directory: playwright/typescript
      - run: npm ci
        working-directory: apps/react
      - name: Write .env from repository variables
        env:
          OIDC_AUTHORITY: ${{ vars.OIDC_AUTHORITY }}
          OIDC_CLIENT_ID: ${{ vars.OIDC_CLIENT_ID }}
          ADMIN_USER_KEY: ${{ vars.ADMIN_USER_KEY }}
          READER_USER_KEY: ${{ vars.READER_USER_KEY }}
        run: |
          {
            printf 'OIDC_AUTHORITY=%s\n' "$OIDC_AUTHORITY"
            printf 'OIDC_CLIENT_ID=%s\n' "$OIDC_CLIENT_ID"
            printf 'ADMIN_USER_KEY=%s\n' "$ADMIN_USER_KEY"
            printf 'READER_USER_KEY=%s\n' "$READER_USER_KEY"
          } > .env
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

The values go through `env:` and `printf` rather than being written into the script, so a value can never be run as shell code. A server-side app whose client checks secrets would also need `OIDC_CLIENT_SECRET`; take it from a repository secret, never a variable. Keep traces and videos off (as `playwright.config.ts` does) or don't upload them: they can contain the users' tokens.
