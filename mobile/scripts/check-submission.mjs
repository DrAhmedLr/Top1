import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { checkBundle } from './check-bundle.mjs';

const root = resolve(import.meta.dirname, '..');
const config = JSON.parse(readFileSync(resolve(root, 'capacitor.config.json'), 'utf8'));
const problems = checkBundle(resolve(root, config.webDir), [
  { label: 'iOS', dir: resolve(root, 'ios/App/App/public') },
  { label: 'Android', dir: resolve(root, 'android/app/src/main/assets/public') },
]);

if (config.server?.url || config.server?.allowNavigation?.length) {
  problems.push('Remove live-reload/remote navigation configuration. Package the app assets.');
}
if (config.server?.cleartext || config.android?.allowMixedContent) problems.push('Disable cleartext/mixed content.');
if (!existsSync(resolve(root, 'ios/App')) || !existsSync(resolve(root, 'android/app'))) {
  problems.push('Generate and build both native projects.');
}
if (!existsSync(resolve(root, 'store-acceptance.json'))) {
  problems.push('Complete device, auth, sync, deletion, export and store privacy acceptance.');
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Automated packaging checks passed; store review and signing remain separate.');
}
