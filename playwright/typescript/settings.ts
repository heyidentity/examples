import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseEnv } from 'node:util';

/** The repository root, which holds the one settings file `.env` (see CONTRACT.md). */
export const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const envPath = join(repositoryRoot, '.env');

const required = ['OIDC_AUTHORITY', 'OIDC_CLIENT_ID', 'ADMIN_USER_KEY', 'READER_USER_KEY'] as const;

export type Settings = Record<(typeof required)[number], string> & { APP_PORT: string };

/** Reads the root .env; throws an error naming each missing setting and the path, without printing any values. */
export function readSettings(): Settings {
  const fix = 'Copy .env.example to .env and fill it in (see CONTRACT.md), or run node ../../setup/provision.mjs --temporary.';
  if (!existsSync(envPath)) {
    throw new Error(`Missing settings file: ${envPath}\n${fix}`);
  }
  const values = parseEnv(readFileSync(envPath, 'utf8'));
  const missing = required.filter((name) => !values[name]?.trim());
  if (missing.length > 0) {
    throw new Error(missing.map((name) => `Missing setting: ${name} in ${envPath}`).join('\n') + `\n${fix}`);
  }
  return {
    OIDC_AUTHORITY: values.OIDC_AUTHORITY!.trim().replace(/\/+$/, ''),
    OIDC_CLIENT_ID: values.OIDC_CLIENT_ID!.trim(),
    ADMIN_USER_KEY: values.ADMIN_USER_KEY!.trim(),
    READER_USER_KEY: values.READER_USER_KEY!.trim(),
    APP_PORT: values.APP_PORT?.trim() || process.env.APP_PORT || '5173',
  };
}

/** Saved state, one file per test user (git-ignored). */
export const authDir = join(dirname(fileURLToPath(import.meta.url)), 'playwright', '.auth');
export const stateFile = (role: 'admin' | 'reader') => join(authDir, `${role}.json`);
/** The text of `signed-in-user` seen right after that user's sign-in. */
export const identityFile = (role: 'admin' | 'reader') => join(authDir, `${role}.identity.txt`);
