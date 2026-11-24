import { generateKeyPairSync } from 'node:crypto';
import { createServer } from 'node:http';

const port = Number(process.argv[2]);
const issuer = new URL(process.argv[3]);
const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwks = { keys: [{ ...publicKey.export({ format: 'jwk' }), kid: 'offline', use: 'sig' }] };
const discovery = {
  issuer: issuer.href,
  authorization_endpoint: issuer.href + '/authorize',
  token_endpoint: issuer.href + '/token',
  jwks_uri: issuer.href + '/jwks',
  end_session_endpoint: issuer.href + '/logout',
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['none'],
};

// This fixture supplies metadata and refuses sign-in. It never issues a code or a token.
createServer((request, response) => {
  const url = new URL(request.url, issuer.origin);
  if (request.method === 'GET' && [issuer.pathname + '/.well-known/openid-configuration', issuer.pathname + '/jwks'].includes(url.pathname)) {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(url.pathname.endsWith('/jwks') ? jwks : discovery));
    return;
  }
  if (request.method === 'GET' && url.pathname === issuer.pathname + '/authorize') {
    const redirectUri = URL.parse(url.searchParams.get('redirect_uri') ?? '');
    const state = url.searchParams.get('state');
    if (!redirectUri || redirectUri.origin !== `http://localhost:${port - 1}` || !state) {
      response.writeHead(400).end();
      return;
    }
    redirectUri.searchParams.set('state', state);
    redirectUri.searchParams.set('error', 'access_denied');
    redirectUri.searchParams.set('error_description', 'Approval required for R&D + QA.');
    response.writeHead(302, { Location: redirectUri.href }).end();
    return;
  }
  response.writeHead(404).end();
}).listen(port, '127.0.0.1');
