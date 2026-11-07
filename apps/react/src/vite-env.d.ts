/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly OIDC_AUTHORITY?: string;
  readonly OIDC_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
