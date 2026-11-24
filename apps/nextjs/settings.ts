import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseEnv } from 'node:util';

export function readSettings() {
  const path = resolve(process.cwd(), '../../.env');
  const fileSettings = existsSync(path) ? parseEnv(readFileSync(path, 'utf8')) : {};
  const read = (name: string) => (process.env[name] ?? fileSettings[name] ?? '').trim();
  const authority = read('OIDC_AUTHORITY').replace(/\/+$/, '');
  const clientId = read('OIDC_CLIENT_ID');
  const secret = read('AUTH_SECRET');
  const missing = [
    ...(!authority ? ['OIDC_AUTHORITY'] : []),
    ...(!clientId ? ['OIDC_CLIENT_ID'] : []),
    ...(!secret ? ['AUTH_SECRET'] : []),
  ];
  return { authority, clientId, secret, missing };
}
