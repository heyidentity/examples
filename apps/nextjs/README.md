# Next.js and Auth.js sign-in

This app uses a public Generic OIDC client with Authorization Code and S256 PKCE. The admin and reader can both sign in, and the server checks their roles before rendering the admin area.

## Clone and prepare

Use Node.js 22.12 or later. Replace `{EXAMPLE_REVISION}` with the commit you want to run. Start in the directory that will hold the checkout.

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples
git checkout --detach {EXAMPLE_REVISION}
```

Reuse an active Generic configuration if its client, issuer and exact redirects match. If the existing root settings belong to another profile or an expired temporary tenant, start in a separate checkout. Temporary setup asks you to accept the Terms of Use. The tenant expires after seven days unless you claim it. [Claim or recover a setup](../../setup/README.md).

From the repository root, create a temporary Generic configuration:

```sh
node setup/provision.mjs --temporary
```

For your own configuration, copy `.env.example` to `.env`, fill in the authority from **Connect your app**, and use your client ID from **Clients**. Register `http://localhost:5173/api/auth/callback/heyidentity` and `http://localhost:5173/` on the client. See [user role settings](../../CONTRACT.md#configuration).

With the root `.env` ready, generate `AUTH_SECRET` once for this checkout. This keeps it in the ignored settings file.

```sh
node -e "require('node:fs').appendFileSync('.env', '\nAUTH_SECRET=' + require('node:crypto').randomBytes(32).toString('base64url') + '\n')"
```

## Run and verify

From the repository root:

```sh
npm --prefix apps/nextjs ci
npm --prefix apps/nextjs run dev
```

Open `http://localhost:5173/`. Sign in as the admin, open `/admin` and confirm the admin area is visible. Sign out, then repeat with the reader and confirm `/admin` says **Access denied**.

To run the shared browser tests, set `EXAMPLE_APP_COMMAND="npm --prefix apps/nextjs run dev"` in the root `.env`. Stop any previous example on the configured port so Playwright starts this app. From the repository root:

```sh
cd playwright/typescript
npm ci
npx playwright install chromium
npx playwright test
npx playwright test --config missing-settings.config.ts
```

The app binds to localhost for development. Keep the session secret in the server's environment and use a different secret for other checkouts.
