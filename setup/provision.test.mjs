// Tests for provision.mjs: node --test setup/
//
// Each test copies provision.mjs into its own temporary folder (so its "repository root" is that folder and the real
// .env is never touched) and runs it against an in-process stub of the Agent API (HEYIDENTITY_API). No tenant is
// created anywhere.

import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after, afterEach, before, beforeEach, describe, test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'provision.mjs');
const TERMS = '2026-10-01';
const TOKEN = 'hid_agent_STUBTOKEN0123456789abcdefghijklmnop';

// --- The Agent API stub -------------------------------------------------------------------------------------------

/** Every request the stub received: { method, path, headers, body }. */
let requests = [];
/** Answers POST /agent/v1/tenants: (request, index of that POST) => void, or a function that writes the response. */
let onCreate;
let server;
let api;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify(body));
}

const catalog = {
  data: { terms: { current_version: TERMS, terms_url: 'https://heyidentity.dev/terms.html' } },
};

function created() {
  return {
    data: {
      agent_token: TOKEN,
      tenant_route_id: 'tenant-1',
      configuration_id: 'config-1',
      endpoints: { issuer: 'https://app.example.test/t/tenant-1/c/config-1' },
    },
  };
}

before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const entry = { method: req.method, path: req.url, headers: req.headers, body };
      requests.push(entry);
      if (req.method === 'GET' && req.url === '/agent/v1/catalog') return send(res, 200, catalog);
      if (req.method === 'POST' && req.url === '/agent/v1/tenants') {
        const index = requests.filter((r) => r.method === 'POST' && r.path === '/agent/v1/tenants').length - 1;
        return onCreate(req, res, index);
      }
      if (req.url.startsWith('/agent/v1/configurations/config-1/')) return send(res, req.method === 'DELETE' ? 200 : 201, { data: {} });
      send(res, 404, { error: 'not_found' });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  api = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

// --- A temporary repository root per test -------------------------------------------------------------------------

let root;

beforeEach(() => {
  requests = [];
  onCreate = (req, res) => send(res, 201, created());
  root = mkdtempSync(join(tmpdir(), 'heyidentity-provision-'));
  mkdirSync(join(root, 'setup'));
  copyFileSync(script, join(root, 'setup', 'provision.mjs'));
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

const envPath = () => join(root, '.env');
const tokenPath = () => join(root, '.heyidentity', 'agent-token');
const creates = () => requests.filter((r) => r.method === 'POST' && r.path === '/agent/v1/tenants');

/** Runs the copied provision.mjs with only the given environment (plus PATH), stdin not a terminal. */
function run(args, env = {}) {
  const base = { PATH: process.env.PATH, HEYIDENTITY_API: api };
  if (process.env.SystemRoot) base.SystemRoot = process.env.SystemRoot;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, 'setup', 'provision.mjs'), ...args], {
      cwd: root,
      env: { ...base, ...env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.stdin.end();
    child.on('error', reject);
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

// --- Tests --------------------------------------------------------------------------------------------------------

describe('--temporary', () => {
  test('without accepting the terms it reads only the catalog and exits with failure', async () => {
    const result = await run(['--temporary'], { CI: 'true' });
    assert.equal(result.code, 1);
    assert.deepEqual(
      requests.map((r) => `${r.method} ${r.path}`),
      ['GET /agent/v1/catalog'],
    );
    assert.match(result.stderr, new RegExp(`HEYIDENTITY_ACCEPT_TERMS=${TERMS}`));
    assert.equal(existsSync(envPath()), false);
  });

  test('a different accepted version is refused the same way', async () => {
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: '2020-01-01' });
    assert.equal(result.code, 1);
    assert.deepEqual(
      requests.map((r) => `${r.method} ${r.path}`),
      ['GET /agent/v1/catalog'],
    );
  });

  test('a 429 refusal sends one creation request, prints Retry-After and exits with failure', async () => {
    onCreate = (req, res) =>
      send(res, 429, { error: 'rate_limited', message: 'Too many tenants.' }, { 'Retry-After': '120' });
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 1);
    assert.equal(creates().length, 1);
    assert.match(result.stderr, /Retry-After: 120/);
    assert.equal(existsSync(envPath()), false);
    assert.equal(existsSync(tokenPath()), false);
  });

  test('a received 5xx status is never retried', async () => {
    onCreate = (req, res) => send(res, 503, { error: 'unavailable' });
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 1);
    assert.equal(creates().length, 1);
  });

  test('the Idempotency-Key has 32-128 [A-Za-z0-9_-] characters, at least 8 distinct', async () => {
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 0, result.stderr);
    const key = creates()[0].headers['idempotency-key'];
    assert.match(key, /^[A-Za-z0-9_-]{32,128}$/);
    assert.ok(new Set(key).size >= 8, `distinct characters in ${key}`);
  });

  test('creates the client example-app, the users and the root .env', async () => {
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS, APP_PORT: '5199' });
    assert.equal(result.code, 0, result.stderr);
    const client = requests.find((r) => r.method === 'POST' && r.path.endsWith('/clients'));
    assert.deepEqual(JSON.parse(client.body), {
      client_id: 'example-app',
      redirect_uris: ['http://localhost:5199/callback', 'http://localhost:5199/'],
      allow_all_return_urls: false,
    });
    assert.ok(client.headers.authorization === `Bearer ${TOKEN}`);
    const env = readFileSync(envPath(), 'utf8');
    assert.match(env, /^OIDC_CLIENT_ID=example-app$/m);
    assert.match(env, /^APP_PORT=5199$/m);
    assert.doesNotMatch(env, new RegExp(TOKEN));
    assert.equal(readFileSync(tokenPath(), 'utf8').trim(), TOKEN);
  });

  test('under GitHub Actions the first line masks the token, which appears exactly once', async () => {
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS, GITHUB_ACTIONS: 'true', CI: 'true' });
    assert.equal(result.code, 0, result.stderr);
    assert.equal(result.stdout.split(/\r?\n/)[0], `::add-mask::${TOKEN}`);
    assert.equal((result.stdout + result.stderr).split(TOKEN).length - 1, 1);
  });

  test('a network error is retried exactly once with the same Idempotency-Key and body', async () => {
    onCreate = (req, res, index) => (index === 0 ? req.socket.destroy() : send(res, 201, created()));
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 0, result.stderr);
    const [first, second] = creates();
    assert.equal(creates().length, 2);
    assert.equal(second.headers['idempotency-key'], first.headers['idempotency-key']);
    assert.equal(second.body, first.body);
  });

  test('a second network error stops the run without a third request', async () => {
    onCreate = (req) => req.socket.destroy();
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 1);
    assert.equal(creates().length, 2);
    assert.equal(existsSync(envPath()), false);
  });

  test('refuses when .env exists, sending nothing', async () => {
    writeFileSync(envPath(), 'OIDC_CLIENT_ID=mine\n');
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 1);
    assert.equal(requests.length, 0);
    assert.ok(result.stderr.includes(envPath()), result.stderr);
    assert.equal(readFileSync(envPath(), 'utf8'), 'OIDC_CLIENT_ID=mine\n');
  });

  test('refuses when .heyidentity/agent-token exists, naming it, sending nothing', async () => {
    mkdirSync(dirname(tokenPath()));
    writeFileSync(tokenPath(), 'earlier\n');
    const result = await run(['--temporary'], { HEYIDENTITY_ACCEPT_TERMS: TERMS });
    assert.equal(result.code, 1);
    assert.equal(requests.length, 0);
    assert.ok(result.stderr.includes(tokenPath()), result.stderr);
    assert.match(result.stderr, /delete the file/);
    assert.equal(readFileSync(tokenPath(), 'utf8'), 'earlier\n');
  });
});

describe('default mode', () => {
  test('names the missing settings file', async () => {
    const result = await run([]);
    assert.equal(result.code, 1);
    assert.ok(result.stderr.includes(`Missing settings file: ${envPath()}`), result.stderr);
    assert.equal(requests.length, 0);
  });

  test('names each missing setting with the .env path', async () => {
    writeFileSync(envPath(), 'OIDC_AUTHORITY=https://app.example.test/t/a/c/b\nADMIN_USER_KEY=admin\n');
    const result = await run([]);
    assert.equal(result.code, 1);
    for (const name of ['OIDC_CLIENT_ID', 'READER_USER_KEY']) {
      assert.ok(result.stderr.includes(`Missing setting: ${name} in ${envPath()}`), result.stderr);
    }
    assert.ok(!result.stderr.includes('Missing setting: OIDC_AUTHORITY'));
    assert.equal(requests.length, 0);
  });

  test('passes when every setting is present', async () => {
    writeFileSync(
      envPath(),
      'OIDC_AUTHORITY=https://app.example.test/t/a/c/b\nOIDC_CLIENT_ID=example-app\nADMIN_USER_KEY=admin\nREADER_USER_KEY=reader\n',
    );
    const result = await run([]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(requests.length, 0);
  });
});
