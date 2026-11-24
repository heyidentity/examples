'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getToken } from 'next-auth/jwt';
import { sessionCookie, signIn, signOut } from './auth';
import { readSettings } from './settings';

export async function beginSignIn() {
  await signIn('heyidentity', { redirectTo: '/' });
}

export async function endSignIn() {
  const { authority, secret } = readSettings();
  const session = await getToken({ req: { headers: await headers() }, secret, cookieName: sessionCookie });
  if (typeof session?.idToken !== 'string') {
    await signOut({ redirectTo: '/' });
    return;
  }

  const authUrl = process.env.AUTH_URL;
  if (!authUrl) throw new Error('Missing AUTH_URL. Start the example with npm run dev or npm run start.');

  const metadata = await fetch(`${authority}/.well-known/openid-configuration`);
  if (!metadata.ok) throw new Error('Could not load HeyIdentity discovery for sign-out.');
  const discovery = await metadata.json();
  const endpoint = new URL(discovery.end_session_endpoint);
  if (discovery.issuer !== authority || endpoint.origin !== new URL(authority).origin) {
    throw new Error('Unexpected end-session endpoint in HeyIdentity discovery.');
  }
  endpoint.searchParams.set('id_token_hint', session.idToken);
  endpoint.searchParams.set('post_logout_redirect_uri', new URL('/', authUrl).href);
  await signOut({ redirect: false });
  redirect(endpoint.href);
}
