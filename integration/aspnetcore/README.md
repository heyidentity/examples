# ASP.NET Core integration tests with real access tokens

Use .NET SDK 10.0.404 (pinned in the checkout's `global.json`), Node.js 22.12 or later, Git, and PowerShell 7 (`pwsh`) to install the Playwright browser on Windows, Linux or macOS. Replace `{EXAMPLE_REVISION}` with the commit you want to run. From the directory that will hold the checkout:

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples
git checkout --detach {EXAMPLE_REVISION}
```

If `dotnet` reports `A compatible .NET SDK was not found`, install SDK `10.0.404` for your OS and CPU from the [.NET 10 downloads](https://dotnet.microsoft.com/en-us/download/dotnet/10.0). It can be installed alongside other SDKs. Run `dotnet --version` from the checkout root to confirm it selects `10.0.404`. The checkout shares this SDK pin with Blazor's locked restore.

Reuse an active Generic configuration with the matching issuer, client, callback and separately configured access-token audience. For an incompatible or expired setup, create a separate checkout so your current `.env` and agent token are available for recovery. Temporary setup requires accepting the Terms of Use. Unclaimed configurations expire after seven days. [Claim or recover a setup](../../setup/README.md).

From the checkout root:

```sh
node setup/provision.mjs --temporary --api-audience https://api.example.test/orders
```

For a configuration you own, register `http://localhost:5173/callback` on a public Generic client and set an access-token audience distinct from the client ID. Copy the issuer from **Connect your app** into `OIDC_AUTHORITY`, use the client ID in `OIDC_CLIENT_ID`, and put its configured audience in `API_AUDIENCE`. Use the admin and reader settings from [the contract](../../CONTRACT.md#configuration).

## Run the tests

From the checkout root, enter the example folder and install the browser used by the test fixture:

```powershell
cd integration/aspnetcore
dotnet restore --locked-mode
dotnet build --no-restore
pwsh Api.Tests/bin/Debug/net10.0/playwright.ps1 install chromium
dotnet test --no-build
```

The tests expect HTTP 200 for the admin access token, 403 for the reader and 401 for a missing token or an ID token. Each picker user signs in once. The fixture keeps tokens in memory and hosts the API through WebApplicationFactory, so there's no app server or callback listener to launch.
