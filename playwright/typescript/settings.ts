import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));

/** The repository root, which holds the one settings file `.env` (see CONTRACT.md). */
export const repositoryRoot = resolve(here, '../..');
export const envPath = join(repositoryRoot, '.env');

const required = ['OIDC_AUTHORITY', 'OIDC_CLIENT_ID', 'ADMIN_USER_KEY', 'READER_USER_KEY'] as const;

export type Settings = Record<(typeof required)[number], string> & { APP_PORT: string; EXAMPLE_APP_COMMAND: string };

/**
 * The suite's default app (CONTRACT.md: playwright/typescript -> apps/react): installs it unless it is already
 * installed, then starts it on APP_PORT. Run from the repository root.
 */
export const defaultAppCommand = 'node playwright/typescript/start-default-app.mjs';

function readValues(): Record<string, string | undefined> {
  return existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {};
}

/** The optional settings, from .env or else the environment. They never need a complete .env. */
export function readAppSettings(values = readValues()) {
  return {
    APP_PORT: values.APP_PORT?.trim() || process.env.APP_PORT?.trim() || '5173',
    // A shell command, run from the repository root, that installs and starts the app under test on APP_PORT.
    EXAMPLE_APP_COMMAND: values.EXAMPLE_APP_COMMAND?.trim() || process.env.EXAMPLE_APP_COMMAND?.trim() || defaultAppCommand,
  };
}

/** Reads the root .env; throws an error naming each missing setting and the path, without printing any values. */
export function readSettings(): Settings {
  const fix = 'Copy .env.example to .env and fill it in (see CONTRACT.md), or run node ../../setup/provision.mjs --temporary.';
  if (!existsSync(envPath)) {
    throw new Error(`Missing settings file: ${envPath}\n${fix}`);
  }
  const values = readValues();
  const missing = required.filter((name) => !values[name]?.trim());
  if (missing.length > 0) {
    throw new Error(missing.map((name) => `Missing setting: ${name} in ${envPath}`).join('\n') + `\n${fix}`);
  }
  return {
    OIDC_AUTHORITY: values.OIDC_AUTHORITY!.trim().replace(/\/+$/, ''),
    OIDC_CLIENT_ID: values.OIDC_CLIENT_ID!.trim(),
    ADMIN_USER_KEY: values.ADMIN_USER_KEY!.trim(),
    READER_USER_KEY: values.READER_USER_KEY!.trim(),
    ...readAppSettings(values),
  };
}

/**
 * Saved state, one file per test user (git-ignored). CONTRACT.md: a suite writes per-user state and identity files
 * only under <suite>/playwright/.auth/.
 */
export const authDir = join(here, 'playwright', '.auth');
export const stateFile = (role: 'admin' | 'reader') => join(authDir, `${role}.json`);
/** The text of `signed-in-user` seen right after that user's sign-in. */
export const identityFile = (role: 'admin' | 'reader') => join(authDir, `${role}.identity.txt`);
/** Markers the admin and reader tests write when they start, to prove they run at the same time (CI only). */
export const runningDir = join(authDir, 'running');
