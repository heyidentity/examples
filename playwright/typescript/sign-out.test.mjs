import assert from 'node:assert/strict';
import test from 'node:test';
import { observeSignOut } from './sign-out.ts';

const home = 'http://localhost:5173/';
const endSession = 'https://issuer.example/end-session';

function logoutUrl() {
  const url = new URL(endSession);
  url.searchParams.set('id_token_hint', 'synthetic-id-token-hint');
  url.searchParams.set('post_logout_redirect_uri', home);
  return url.href;
}

test('recognizes one end-session navigation followed by the return to the app', () => {
  const logout = observeSignOut(endSession, home);
  logout.record(home);
  logout.record(logoutUrl());
  logout.record(home);
  logout.assertComplete();
});

test('a duplicate end-session navigation reports its count without its credentials', () => {
  const logout = observeSignOut(endSession, home);
  logout.record(logoutUrl());
  logout.record(logoutUrl());
  logout.record(home);

  assert.throws(() => logout.assertComplete(), (error) => {
    assert.match(error.message, /navigations to the end-session endpoint/);
    assert.match(error.message, /Received:\s*2/);
    const reporterData = JSON.stringify({
      message: error.message,
      stack: error.stack,
      matcherResult: error.matcherResult,
    });
    assert.equal(reporterData.includes('synthetic-id-token-hint'), false, 'the diagnostic exposed a token hint');
    assert.equal(reporterData.includes(logoutUrl()), false, 'the diagnostic exposed the full logout URL');
    return true;
  });
});
