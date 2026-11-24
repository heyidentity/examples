# Blazor sign-in with Microsoft.Identity.Web

Use .NET SDK 10.0.404 (pinned in the checkout's `global.json`), Node.js 22.12 or later, and Git. Replace `{EXAMPLE_REVISION}` with the commit you want to run. From the directory that will hold the checkout:

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples
git checkout --detach {EXAMPLE_REVISION}
```

If `dotnet` reports `A compatible .NET SDK was not found`, install SDK `10.0.404` for your OS and CPU from the [.NET 10 downloads](https://dotnet.microsoft.com/en-us/download/dotnet/10.0). It can be installed alongside other SDKs. Run `dotnet --version` from the checkout root to confirm it selects `10.0.404`. Blazor's locked static asset dependency changes between SDK patches.

Reuse an active Microsoft-profile configuration only if its Entra issuer and client settings match. Use a separate checkout if you already have a Generic configuration or an expired setup. Temporary setup asks you to accept the Terms of Use, and the tenant expires after seven days unless you claim it. [Claim or recover a setup](../../setup/README.md).

From the checkout root:

```sh
node setup/provision.mjs --temporary --profile microsoft
```

For your own Microsoft-profile configuration, copy `.env.example` to `.env` and open **Connect your app → All endpoints and IDs**. Copy **Instance** to `ENTRA_INSTANCE`, copy **Configuration id (Entra tenant ID)** to `ENTRA_TENANT_ID` and set `OIDC_AUTHORITY` to `https://app.heyidentity.dev/{configurationId}/v2.0`. Copy the client ID from **Clients**. Register `http://localhost:5173/signin-oidc` and `http://localhost:5173/` for your client. If it checks a secret, set `OIDC_CLIENT_SECRET` in `.env`.

## Run and verify

From the checkout root:

```sh
dotnet restore apps/blazor/Blazor.csproj --locked-mode
dotnet run --project apps/blazor/Blazor.csproj --no-restore --no-launch-profile
```

Open `http://localhost:5173/`. Sign in as the admin, open **Admin** and check that the admin area appears. Sign out, then repeat with the reader and check for **Access denied**.

For the shared browser suite, set `EXAMPLE_APP_COMMAND="dotnet run --project apps/blazor/Blazor.csproj --no-build --no-launch-profile"` in the root `.env`. Build the app first and stop the previous app on this port. From the checkout root:

```sh
dotnet build apps/blazor/Blazor.csproj --no-restore
cd playwright/typescript
npm ci
npx playwright install chromium
npx playwright test
npx playwright test --config missing-settings.config.ts
```

The example renders on the server and covers sign-in and roles. It does not acquire a token for a downstream API.
