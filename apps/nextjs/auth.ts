import NextAuth from 'next-auth';
import { readSettings } from './settings';

declare module 'next-auth' {
  interface Session {
    roles: string[];
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  const { authority, clientId, secret, missing } = readSettings();
  if (missing.length) {
    throw new Error(missing.map(setting => `Missing setting: ${setting} in .env`).join('\n'));
  }

  return {
    secret,
    providers: [{
      id: 'heyidentity',
      name: 'HeyIdentity',
      type: 'oidc',
      issuer: authority,
      clientId,
      client: { token_endpoint_auth_method: 'none' },
      checks: ['pkce', 'state'],
      authorization: { params: { scope: 'openid profile' } },
    }],
    pages: { error: '/callback' },
    // Log only Auth.js's error type: the message and cause can carry provider responses.
    logger: { error(error) { console.error('Auth.js sign-in error:', 'type' in error ? error.type : error.name); } },
    callbacks: {
      jwt({ token, account, profile }) {
        if (account) {
          token.roles = Array.isArray(profile?.roles) ? profile.roles.filter(role => typeof role === 'string') : [];
          token.idToken = account.id_token;
        }
        return token;
      },
      session({ session, token }) {
        session.roles = Array.isArray(token.roles) ? token.roles : [];
        return session;
      },
    },
  };
});
