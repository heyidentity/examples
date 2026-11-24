import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const settings = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(settings)) process.loadEnvFile(settings);
const port = process.env.APP_PORT || '5173';
const next = fileURLToPath(new URL('./node_modules/next/dist/bin/next', import.meta.url));
const command = process.argv[2];
const running = spawn(process.execPath, [next, command, '--hostname', 'localhost', '--port', port], {
  stdio: 'inherit',
  env: { ...process.env, AUTH_URL: `http://localhost:${port}`, NEXT_TELEMETRY_DISABLED: '1' },
});

running.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => running.kill(signal));
