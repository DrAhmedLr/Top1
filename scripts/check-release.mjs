import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Verify public/app-manifest.json points to existing built static assets
const manifestPath = path.join(process.cwd(), 'public', 'app-manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.error('Missing public/app-manifest.json — run pnpm sync:app first.');
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
for (const key of ['css', 'js']) {
  const rel = typeof manifest[key] === 'string' ? manifest[key].replace(/^\/+/, '') : '';
  const target = path.join(process.cwd(), 'public', rel);
  if (!rel || !fs.existsSync(target)) {
    console.error(`public/app-manifest.json ${key} asset missing: ${target}`);
    process.exit(1);
  }
}

// One reproducible gate; no production credentials or database writes needed.
const hasPnpm = spawnSync('pnpm', ['--version'], { stdio: 'ignore' }).status === 0;
const runner = hasPnpm ? 'pnpm' : 'npm';

for (const task of ['test', 'test:backup', 'test:database', 'typecheck', 'build']) {
  const args = hasPnpm ? [task] : ['run', task];
  const result = spawnSync(runner, args, { stdio: 'inherit' });
  if (result.error) {
    console.error(`Release check ${task} could not start.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log('All release checks passed.');
