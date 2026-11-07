import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

// The one settings file is .env at the repository root (see CONTRACT.md).
const envDir = '../..';

export default defineConfig(({ mode }) => {
  // Read on the server side only, to pick the port; APP_PORT never reaches the browser.
  const port = Number(loadEnv(mode, envDir, 'APP_PORT').APP_PORT || 5173);
  return {
    plugins: [react()],
    envDir,
    // Only these two settings are exposed to the browser (import.meta.env), never a secret.
    envPrefix: ['OIDC_AUTHORITY', 'OIDC_CLIENT_ID'],
    server: { host: 'localhost', port, strictPort: true },
    preview: { host: 'localhost', port, strictPort: true },
  };
});
