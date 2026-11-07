// The TypeScript suite's default app (CONTRACT.md): installs apps/react with npm ci unless it is already installed
// from the current package-lock.json, then starts its dev server on APP_PORT. playwright.config.ts runs this when
// EXAMPLE_APP_COMMAND is not set. Skipping a current install keeps the CI run from installing (and running install
// scripts) after the temporary configuration exists.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '../../apps/react');
// npm ci writes node_modules/.package-lock.json after a complete install.
const installed = join(app, 'node_modules', '.package-lock.json');
const lock = join(app, 'package-lock.json');

if (!existsSync(installed) || statSync(installed).mtimeMs < statSync(lock).mtimeMs) {
  const install = spawnSync('npm ci', { cwd: app, stdio: 'inherit', shell: true });
  if (install.status !== 0) process.exit(install.status ?? 1);
}

const dev = spawn('npm run dev', { cwd: app, stdio: 'inherit', shell: true });
dev.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => dev.kill(signal));
