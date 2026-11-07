# Example app (React)

A Vite + React + TypeScript app that signs in through HeyIdentity with [oidc-client-ts](https://github.com/authts/oidc-client-ts): Authorization Code with S256 PKCE, as a public client (no secret). It follows the [contract](../../CONTRACT.md), so every suite in [`playwright/`](../../playwright) can test it.

| Route | Shows |
|---|---|
| `/` | Sign in, or who is signed in and Sign out |
| `/callback` | Completes sign-in and returns to `/`; on an error shows "Sign-in failed: `<error>` – `<error_description>`" and Sign in |
| `/admin` | The admin area for a user whose `roles` claim contains `admin`, "Access denied" for anyone else |

The Playwright suite starts this app itself; you only need these steps to run it on its own.

## Run it

You need Node.js 22.12 or later and the settings file `.env` in the repository root. [CONTRACT.md](../../CONTRACT.md#settings-file) shows how to create it, from a temporary or your own configuration.

```sh
git clone https://github.com/heyidentity/examples.git heyidentity-examples
cd heyidentity-examples/apps/react
npm ci
npm run dev
```

Open `http://localhost:5173` (or the port in `APP_PORT`), choose **Sign in**, pick a user on HeyIdentity's user picker, then open **Admin**. The configuration's client needs exactly the redirect URIs `http://localhost:5173/callback` and `http://localhost:5173/` (the second one is where sign-out returns).

Without settings the page names each missing one, for example "Missing setting: OIDC_AUTHORITY in .env at the repository root." Restart `npm run dev` after editing `.env`.

`npm run build` type-checks and builds to `dist/`.

## How it is set up

- **Settings.** `vite.config.ts` reads `.env` from the repository root (`envDir: '../..'`) and exposes only `OIDC_AUTHORITY` and `OIDC_CLIENT_ID` to the browser (`envPrefix`). Nothing else from `.env`, such as `OIDC_CLIENT_SECRET` for server-side apps, reaches the bundle. `APP_PORT` only picks the dev server's port.
- **Sign-in** (`src/auth.ts`): a `UserManager` with `redirect_uri` `/callback`, scope `openid profile`, and no `prompt`, so HeyIdentity shows its user picker. Roles are read from the ID token's top-level `roles` claim.
- **Sign-out** goes through HeyIdentity's end-session endpoint with `id_token_hint` and `post_logout_redirect_uri` `http://localhost:<APP_PORT>/`.
- **Storage: localStorage, for test automation only.** The signed-in user is kept in `localStorage` so that Playwright's `storageState` can save and restore it (it does not capture `sessionStorage`). That keeps tokens beyond the tab's lifetime and readable by any script on the origin; in a real app prefer `sessionStorage` (oidc-client-ts's default), in-memory storage, or a backend that keeps tokens out of the browser.
- **Silent renew and session monitoring are off** (`automaticSilentRenew: false`, `monitorSession: false`), so a restored browser context sends no request to HeyIdentity. When the token expires, the app shows the signed-out state and you sign in again.

## The admin view is not authorization

The admin area is hidden in the browser by reading the ID token's `roles` claim. That only decides what the page shows: anyone can change code running in their browser. A real API must validate the access token and check the caller's roles or scopes on every request itself.
