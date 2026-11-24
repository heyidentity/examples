// start.mjs loads the root .env into the process environment (CONTRACT.md settings grammar), where a variable that
// is already set wins. Settings are read only from there, so the file is parsed once, by one rule.
export function readSettings() {
  const read = (name: string) => (process.env[name] ?? '').trim();
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
