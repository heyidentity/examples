# HeyIdentity examples

Runnable examples of apps that sign in through [HeyIdentity](https://heyidentity.dev), a test OpenID Connect provider, and Playwright suites that test them: real Authorization Code + PKCE sign-ins, role-based access, sign-in once per test user with saved state, and CI.

Every app and suite follows one [contract](CONTRACT.md) (settings, routes, test ids, roles), so any suite runs against any app.

## Examples

| App | Playwright suite | CI |
|---|---|---|
| [`apps/react`](apps/react) (Vite, React, TypeScript, oidc-client-ts) | [`playwright/typescript`](playwright/typescript) | [`react-typescript.yml`](.github/workflows/react-typescript.yml) |

Each suite starts its default app itself (TypeScript → `apps/react`).

## Quick start

You need Node.js 22.12 or later and Git.

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples/playwright/typescript
npm ci
npx playwright install
```

Then create the settings file, `.env` in the repository root, in one of two ways:

- **No account:** `node ../../setup/provision.mjs --temporary` creates a temporary HeyIdentity configuration and writes `.env`. It asks you to accept the [HeyIdentity Terms of Use](https://heyidentity.dev/terms.html), and the configuration expires after 7 days unless you claim it.
- **Your own configuration:** `cp ../../.env.example ../../.env`, then fill it in (see [Prepare your own configuration](playwright/typescript/README.md#prepare-your-own-configuration)).

Run the tests:

```sh
npx playwright test
```

The suite installs and starts `apps/react`, signs in once as the admin and once as the reader through HeyIdentity's user picker, and checks from the saved state that the admin sees the admin area and the reader is denied.

## Repository layout

```
├─ CONTRACT.md          settings, .env location, routes, test ids, roles, picker
├─ .env.example         the settings file template (copy to .env, git-ignored)
├─ setup/               provision.mjs: checks .env, or creates a temporary configuration
├─ apps/<framework>/    example apps
├─ playwright/<language>/  Playwright suites
└─ .github/workflows/   one workflow per app and suite pair
```

Read more:

- [`playwright/typescript/README.md`](playwright/typescript/README.md): running the tests, your own configuration, CI for your own repository, rate limits.
- [`apps/react/README.md`](apps/react/README.md): running the app on its own and how it signs in.
- [`setup/README.md`](setup/README.md): what `provision.mjs` does.

## For development and testing only

HeyIdentity is a test identity provider. Use fictional test users only, and never use it to protect production identities.

## License

[MIT](LICENSE)
