import { createServer } from 'node:http';

const port = Number(process.argv[2]);
const issuer = new URL(process.argv[3]);
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

// A public metadata response is enough to boot the apps. This stub never issues a code or a token.
createServer((request, response) => {
  if (request.method === 'GET' && request.url === issuer.pathname + '/.well-known/openid-configuration') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(discovery));
    return;
  }
  response.writeHead(404).end();
}).listen(port, '127.0.0.1');
