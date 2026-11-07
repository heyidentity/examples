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
2. Creates one unverified tenant with a Generic configuration (display name `heyidentity-examples-local`, or `heyidentity-examples-ci` in CI), with a random `Idempotency-Key` (32 hexadecimal characters) kept in memory. When the Agent API answers with a refusal (any status, for example `429` because the creation limit of 10 per source address per hour is reached), it prints the message and `Retry-After` and exits with failure, without retrying. Only when no response arrives at all (a network error) does it send the same request once more, with the same `Idempotency-Key` and body: if the first request did create a tenant, the Agent API returns that tenant again (with a new agent token) instead of creating a second one. A second network error stops the run.
3. Adds the client `example-app` (a public client with exactly the redirect URIs `http://localhost:<APP_PORT>/callback` and `http://localhost:<APP_PORT>/`) and the users `admin` (`roles: ["admin"]`) and `reader` (`roles: ["reader"]`), then removes the starter `demo-client` and `demo-user`.
4. Writes `.env` and the tenant's agent token to `.heyidentity/agent-token` (both git-ignored) and prints the tenant route id, configuration id and endpoints. It never prints the agent token; under GitHub Actions it masks it first.

It stops without creating anything when `.env` or `.heyidentity/agent-token` already exists. Reuse `.env`, or delete it to start over. The agent token belongs to an earlier temporary tenant: keep it while you want to change or claim that tenant, otherwise delete `.heyidentity/` (the tenant expires on its own). Refusing to overwrite it means a token is never lost while its tenant still exists. Each temporary configuration counts toward the creation limits.

**When a step after creation fails** (adding the client or a user, or removing the starter content), the tenant exists but `.env` is not written: the run prints the failed request and the path of the agent token, which it has already saved. Either finish the configuration through the [Agent API](https://api.heyidentity.dev/agent) with that token and write `.env` yourself, or delete `.heyidentity/` and run again (the half-configured tenant expires after 7 days).

| Variable | Default | Meaning |
|---|---|---|
| `HEYIDENTITY_ACCEPT_TERMS` | (none) | The Terms of Use version you accept. |
| `HEYIDENTITY_API` | `https://api.heyidentity.dev` | The Agent API origin. |
| `APP_PORT` | `5173` | The app's port, used in the redirect URIs (and written to `.env` when set). |

**The temporary tenant** expires 7 days after creation unless you claim it, and is then deleted. You need `.heyidentity/agent-token` only to change the tenant through the [Agent API](https://api.heyidentity.dev/agent) or to claim it (request a claim code with the token, then enter it on the claim page) and keep it. Keep the token secret, and delete `.heyidentity/` when you no longer need it.

## Tests

```sh
node --test setup/*.test.mjs
```

`provision.test.mjs` runs `provision.mjs` in temporary folders against an in-process stub of the Agent API (`HEYIDENTITY_API`), so it creates no tenant: terms refusal, a `429` refusal, the GitHub Actions mask, the `Idempotency-Key` format, the single network-error retry, the refusals when `.env` or the agent token exists, and the missing-settings messages.
