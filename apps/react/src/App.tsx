import type { User } from 'oidc-client-ts';
import { useEffect, useState } from 'react';
import { missingSettings, rolesOf, settings, userManager } from './auth';

type SignInError = { error: string; description: string };

type State =
  | { kind: 'loading' }
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; user: User }
  | { kind: 'error'; error: SignInError };

const path = window.location.pathname;

// Loaded once per page, so React's development double-render never handles the callback twice.
let loading: Promise<State> | undefined;

export function App() {
  return (
    <main>
      <h1>Example app (React)</h1>
      {missingSettings.length > 0 ? (
        <MissingSettings />
      ) : (
        <>
          <p className="authority">
            Signs in through HeyIdentity at <code>{settings.OIDC_AUTHORITY}</code>
          </p>
          <Routes />
        </>
      )}
    </main>
  );
}

function MissingSettings() {
  return (
    <section role="alert" className="notice">
      {missingSettings.map((name) => (
        <p key={name}>
          Missing setting: <code>{name}</code> in <code>.env</code> at the repository root.
        </p>
      ))}
      <p>
        Copy <code>.env.example</code> to <code>.env</code>, or run <code>node setup/provision.mjs --temporary</code>. Then
        restart the app.
      </p>
    </section>
  );
}

function Routes() {
  const [state, setState] = useState<State>({ kind: 'loading' });

  useEffect(() => {
    let cancelled = false;
    (loading ??= load()).then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.kind === 'loading') return <p>Loading…</p>;
  if (state.kind === 'error') {
    return (
      <>
        <section role="alert" className="notice" data-testid="sign-in-error">
          <p>
            Sign-in failed: <code>{state.error.error}</code>
            {state.error.description ? <> – {state.error.description}</> : null}
          </p>
        </section>
        <SignInButton />
      </>
    );
  }
  if (state.kind === 'signed-out') {
    return (
      <>
        {path === '/admin' ? <p>Sign in to open the admin area.</p> : <p>You are signed out.</p>}
        <SignInButton />
      </>
    );
  }

  const { user } = state;
  const name = String(user.profile.name ?? user.profile.sub);
  const isAdmin = rolesOf(user.profile).includes('admin');
  return (
    <>
      <p data-testid="signed-in-user">
        Signed in as <strong>{name}</strong>
      </p>
      <nav>
        <a href="/">Home</a> · <a href="/admin">Admin</a>
      </nav>
      {path === '/admin' ? (
        isAdmin ? (
          <section data-testid="admin-area" className="panel">
            <h2>Admin area</h2>
            <p>Only users whose roles claim contains admin see this.</p>
          </section>
        ) : (
          <section data-testid="access-denied" className="notice">
            <h2>Access denied</h2>
            <p>The admin area needs the admin role. Your roles: {rolesOf(user.profile).join(', ') || 'none'}.</p>
          </section>
        )
      ) : null}
      <button type="button" data-testid="sign-out" onClick={() => userManager!.signoutRedirect()}>
        Sign out
      </button>
    </>
  );
}

function SignInButton() {
  return (
    <button type="button" data-testid="sign-in" onClick={() => userManager!.signinRedirect()}>
      Sign in
    </button>
  );
}

async function load(): Promise<State> {
  const manager = userManager!;
  const params = new URLSearchParams(window.location.search);

  if (path === '/callback') {
    const error = params.get('error');
    if (error) {
      // Drop the pending sign-in state that this response belongs to.
      await manager.clearStaleState().catch(() => undefined);
      return { kind: 'error', error: { error, description: params.get('error_description') ?? '' } };
    }
    try {
      await manager.signinRedirectCallback();
      window.location.replace('/');
      return { kind: 'loading' };
    } catch (e) {
      return { kind: 'error', error: { error: 'callback_failed', description: e instanceof Error ? e.message : String(e) } };
    }
  }

  // Back from HeyIdentity's end-session endpoint: finish the sign-out and tidy the URL.
  if (path === '/' && params.has('state')) {
    await manager.signoutRedirectCallback().catch(() => undefined);
    window.history.replaceState(null, '', '/');
  }

  const user = await manager.getUser();
  return user && !user.expired ? { kind: 'signed-in', user } : { kind: 'signed-out' };
}
