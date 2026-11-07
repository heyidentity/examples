#!/usr/bin/env node
// Checks the root .env, or with --temporary creates a temporary HeyIdentity configuration and writes it.
// Dependency-free: Node.js 22 or later. See setup/README.md.
//
//   node setup/provision.mjs              check the root .env; creates nothing
//   node setup/provision.mjs --temporary  create a temporary configuration (asks you to accept the Terms of Use)
//
// Environment:
//   HEYIDENTITY_API           Agent API origin (default https://api.heyidentity.dev)
//   HEYIDENTITY_ACCEPT_TERMS  the Terms of Use version you accept (catalog terms.current_version)
//   APP_PORT                  the app's port for the redirect URIs (default 5173)

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const envPath = join(root, '.env');
const tokenPath = join(root, '.heyidentity', 'agent-token');
const required = ['OIDC_AUTHORITY', 'OIDC_CLIENT_ID', 'ADMIN_USER_KEY', 'READER_USER_KEY'];

const inGitHubActions = Boolean(process.env.GITHUB_ACTIONS);
const api = (process.env.HEYIDENTITY_API || 'https://api.heyidentity.dev').replace(/\/+$/, '');
const appPort = process.env.APP_PORT || '5173';

const example = {
  clientId: 'example-app',
  redirectUris: [`http://localhost:${appPort}/callback`, `http://localhost:${appPort}/`],
  users: [
    { key: 'admin', display_name: 'Ada Admin', claims: { roles: ['admin'] } },
    { key: 'reader', display_name: 'Riley Reader', claims: { roles: ['reader'] } },
  ],
  starterClient: 'demo-client',
  starterUser: 'demo-user',
};

// Under GitHub Actions nothing is printed before the agent token exists, so that the first line after the creation
// response can be its ::add-mask:: command. Lines written earlier are held and printed after the mask (or on failure).
const held = [];
let holding = inGitHubActions;
function say(line = '') {
  if (holding) held.push(line);
  else console.log(line);
}
function release() {
  holding = false;
  for (const line of held.splice(0)) console.log(line);
}
/** Stops the run with a message on stderr and a failing exit code. */
class Stop extends Error {}
function fail(message) {
  throw new Stop(message);
}

function readEnvFile() {
  if (!existsSync(envPath)) return null;
  return parseEnv(readFileSync(envPath, 'utf8'));
}

function check() {
  const settings = readEnvFile();
  const fix = 'Copy .env.example to .env and fill it in (see CONTRACT.md), or run node setup/provision.mjs --temporary.';
  if (settings === null) {
    fail(`Missing settings file: ${envPath}\n${fix}`);
  }
  const missing = required.filter((name) => !settings[name]?.trim());
  if (missing.length > 0) {
    fail(missing.map((name) => `Missing setting: ${name} in ${envPath}`).join('\n') + `\n${fix}`);
  }
  try {
    new URL(settings.OIDC_AUTHORITY);
  } catch {
    fail(`Invalid setting: OIDC_AUTHORITY in ${envPath} is not an absolute URL. Use the configuration's issuer.`);
  }
  console.log(`All settings are present in ${envPath}.`);
}

/** A random key of 32 lowercase hex characters (within the Agent API's 32-128 [A-Za-z0-9_-]), kept in memory only, with at least 8 distinct characters. */
function newIdempotencyKey() {
  for (;;) {
    const key = randomUUID().replaceAll('-', '');
    if (new Set(key).size >= 8) return key;
  }
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 500) };
  }
}

async function acceptedVersion(currentVersion) {
  const fromEnv = process.env.HEYIDENTITY_ACCEPT_TERMS?.trim();
  if (fromEnv) return fromEnv;
  if (!process.stdin.isTTY || process.env.CI) return null;
  release();
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return (await rl.question(`To accept the Terms of Use, type the version ${currentVersion} (or press Enter to stop): `)).trim();
  } finally {
    rl.close();
  }
}

async function configure(base, token, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const result = await readJson(response);
    const retryAfter = response.headers.get('retry-after');
    fail(
      `${method} ${path} failed: ${response.status} ${result.error ?? ''} ${result.message ?? ''}`.trim() +
        (retryAfter ? `\nRetry-After: ${retryAfter} seconds` : '') +
        `\nThe temporary tenant exists, but .env was not written. Its agent token is in ${tokenPath}.`,
    );
  }
}

async function temporary() {
  if (existsSync(envPath)) {
    fail(
      `${envPath} already exists, so nothing was created. Reuse it, or delete it to create a new temporary configuration.\n` +
        'Each temporary configuration counts toward the creation limits (10 per source address per hour).',
    );
  }
  if (existsSync(tokenPath)) {
    fail(
      `${tokenPath} already exists, so nothing was created.\n` +
        'It holds the agent token of an earlier temporary tenant, which you need only to change that tenant through the ' +
        'Agent API or to claim it. If you no longer need that tenant, delete the file (or the whole .heyidentity folder) ' +
        'and run again; the tenant expires on its own 7 days after creation.',
    );
  }

  // 1. The current Terms of Use version.
  let catalog;
  try {
    const response = await fetch(`${api}/agent/v1/catalog`, { headers: { Accept: 'application/json' } });
    if (!response.ok) fail(`Reading ${api}/agent/v1/catalog failed: ${response.status}. Nothing was created.`);
    catalog = await response.json();
  } catch (error) {
    if (error instanceof Stop) throw error;
    fail(`Reading ${api}/agent/v1/catalog failed: ${error.message}. Nothing was created.`);
  }
  const terms = catalog?.data?.terms;
  if (!terms?.current_version) fail(`${api}/agent/v1/catalog has no terms.current_version. Nothing was created.`);
  say(`HeyIdentity Terms of Use: ${terms.terms_url} (version ${terms.current_version})`);

  const accepted = await acceptedVersion(terms.current_version);
  if (accepted !== terms.current_version) {
    fail(
      (accepted ? `HEYIDENTITY_ACCEPT_TERMS is ${accepted}, but the current Terms of Use version is ${terms.current_version}.\n` : '') +
        `Creating a temporary configuration accepts the HeyIdentity Terms of Use at ${terms.terms_url} (version ${terms.current_version}).\n` +
        `Read them, then run again with HEYIDENTITY_ACCEPT_TERMS=${terms.current_version}. Nothing was created.`,
    );
  }

  // 2. Create one tenant. A refusal (any received status) stops the run and is never retried. Only when no response
  // arrives at all (fetch throws a network error) is the request sent once more, with the same Idempotency-Key and
  // body, so that a tenant whose creation response was lost is returned again instead of a second one being created.
  const displayName = inGitHubActions || process.env.CI ? 'heyidentity-examples-ci' : 'heyidentity-examples-local';
  const createRequest = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'Idempotency-Key': newIdempotencyKey() },
    body: JSON.stringify({ accepted_terms_version: accepted, display_name: displayName, profile: 'Generic' }),
  };
  let response;
  try {
    response = await fetch(`${api}/agent/v1/tenants`, createRequest);
  } catch (first) {
    say(`Creating the temporary configuration failed: ${first.message}. Retrying once with the same Idempotency-Key.`);
    try {
      response = await fetch(`${api}/agent/v1/tenants`, createRequest);
    } catch (second) {
      fail(
        `Creating the temporary configuration failed again: ${second.message}. Nothing more is retried.\n` +
          'A tenant may have been created without its response arriving; it expires on its own 7 days after creation.',
      );
    }
  }
  const created = await readJson(response);
  if (!response.ok) {
    const retryAfter = response.headers.get('retry-after') ?? created.retry_after_seconds;
    fail(
      `Creating the temporary configuration was refused: ${response.status} ${created.error ?? ''}\n${created.message ?? ''}`.trim() +
        (retryAfter ? `\nRetry-After: ${retryAfter} seconds` : '') +
        '\nNothing is retried. Wait, or use your own configuration (cp .env.example .env).',
    );
  }

  const data = created.data ?? {};
  const token = data.agent_token;
  if (!token) fail('The creation response has no agent token.');
  if (inGitHubActions) console.log(`::add-mask::${token}`);
  release();

  mkdirSync(dirname(tokenPath), { recursive: true });
  writeFileSync(tokenPath, `${token}\n`, { mode: 0o600 });

  // 3. The example's client and users, then remove the starter content.
  const base = `${api}/agent/v1/configurations/${data.configuration_id}`;
  await configure(base, token, 'POST', '/clients', {
    client_id: example.clientId,
    redirect_uris: example.redirectUris,
    allow_all_return_urls: false,
  });
  for (const user of example.users) await configure(base, token, 'POST', '/users', user);
  await configure(base, token, 'DELETE', `/clients/${example.starterClient}`);
  await configure(base, token, 'DELETE', `/users/${example.starterUser}`);

  // 4. The root .env.
  const lines = [
    '# Written by node setup/provision.mjs --temporary: a temporary HeyIdentity configuration.',
    `# It expires after 7 days unless claimed. The agent token is in ${relative(root, tokenPath).replaceAll('\\', '/')}.`,
    `OIDC_AUTHORITY=${data.endpoints.issuer}`,
    `OIDC_CLIENT_ID=${example.clientId}`,
    `ADMIN_USER_KEY=${example.users[0].key}`,
    `READER_USER_KEY=${example.users[1].key}`,
    ...(process.env.APP_PORT ? [`APP_PORT=${appPort}`] : []),
    '',
  ];
  writeFileSync(envPath, lines.join('\n'));

  console.log('Created a temporary configuration:');
  console.log(`  tenant route id:  ${data.tenant_route_id}`);
  console.log(`  configuration id: ${data.configuration_id}`);
  for (const [name, url] of Object.entries(data.endpoints)) console.log(`  ${name.padEnd(16)}  ${url}`);
  console.log(`Wrote ${envPath} and ${tokenPath} (git-ignored).`);
}

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== '--temporary');
try {
  if (unknown.length > 0) fail(`Unknown argument: ${unknown.join(' ')}. Use no arguments or --temporary.`);
  if (args.includes('--temporary')) await temporary();
  else check();
} catch (error) {
  release();
  console.error(error instanceof Stop ? error.message : error);
  // process.exitCode instead of process.exit(), so pending sockets close cleanly (Windows).
  process.exitCode = 1;
}
