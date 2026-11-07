# Setup

`provision.mjs` prepares the one settings file, `.env` in the repository root (see [CONTRACT.md](../CONTRACT.md)). It needs Node.js 22.12 or later and no dependencies. Run it from anywhere; the commands below are from the repository root.

## Check your settings

```sh
node setup/provision.mjs
```

Names each missing setting with the path of `.env` and exits with failure, or says that all settings are present. It creates nothing.

## Create a temporary configuration

```sh
node setup/provision.mjs --temporary
```

For trying the examples without a HeyIdentity account. It:

1. Reads the current Terms of Use version from the Agent API catalog and prints the terms URL. Creating a configuration accepts the [HeyIdentity Terms of Use](https://heyidentity.dev/terms.html) on your behalf, so it continues only when you type that version, or when `HEYIDENTITY_ACCEPT_TERMS` equals it (for scripts and CI). Otherwise it stops and creates nothing.
2. Creates one unverified tenant with a Generic configuration (display name `heyidentity-examples-local`, or `heyidentity-examples-ci` in CI), with a random `Idempotency-Key` kept in memory. It never retries: when the Agent API refuses (for example because the creation limit of 10 per source address per hour is reached), it prints the message and `Retry-After` and exits with failure.
3. Adds the client `react-example` (a public client with exactly the redirect URIs `http://localhost:<APP_PORT>/callback` and `http://localhost:<APP_PORT>/`) and the users `admin` (`roles: ["admin"]`) and `reader` (`roles: ["reader"]`), then removes the starter `demo-client` and `demo-user`.
4. Writes `.env` and the tenant's agent token to `.heyidentity/agent-token` (both git-ignored) and prints the tenant route id, configuration id and endpoints. It never prints the agent token; under GitHub Actions it masks it first.

It stops without creating anything when `.env` already exists: reuse it, or delete it to start over. Each temporary configuration counts toward the creation limits.

| Variable | Default | Meaning |
|---|---|---|
| `HEYIDENTITY_ACCEPT_TERMS` | (none) | The Terms of Use version you accept. |
| `HEYIDENTITY_API` | `https://api.heyidentity.dev` | The Agent API origin. |
| `APP_PORT` | `5173` | The app's port, used in the redirect URIs (and written to `.env` when set). |

**The temporary tenant** expires 7 days after creation unless you claim it, and is then deleted. You need `.heyidentity/agent-token` only to change the tenant through the [Agent API](https://api.heyidentity.dev/agent) or to claim it (request a claim code with the token, then enter it on the claim page) and keep it. Keep the token secret, and delete `.heyidentity/` when you no longer need it.
