#!/usr/bin/env node
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const mobileDir = path.join(root, 'apps', 'mobile');
const distDir = path.join(mobileDir, 'app', 'dist');
const publicDir = path.join(root, 'public');

console.log('[sync:app] Exporting Expo web bundle...');
execSync('npm --workspace=@apexlift/app run export:web', { cwd: mobileDir, stdio: 'inherit' });

const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
const cssMatch = html.match(/href="(\/_expo\/static\/css\/[^"]+\.css)"/);
const jsMatch = html.match(/src="(\/_expo\/static\/js\/web\/[^"]+\.js)"/);
if (!cssMatch || !jsMatch) {
  throw new Error('Could not locate exported CSS/JS bundle paths in dist/index.html');
}

for (const folder of ['_expo', 'assets', 'media']) {
  const src = path.join(distDir, folder);
  const dst = path.join(publicDir, folder);
  fs.rmSync(dst, { recursive: true, force: true });
  if (fs.existsSync(src)) {
    fs.cpSync(src, dst, { recursive: true });
  }
}

// Prune unused @expo/vector-icons font families (~3.6 MB saved; only Ionicons is used)
const vectorFontsDir = path.join(
  publicDir,
  'assets',
  '_node_modules',
  '@expo',
  'vector-icons',
  'build',
  'vendor',
  'react-native-vector-icons',
  'Fonts'
);
if (fs.existsSync(vectorFontsDir)) {
  let prunedCount = 0;
  let prunedBytes = 0;
  for (const file of fs.readdirSync(vectorFontsDir)) {
    if (!file.startsWith('Ionicons')) {
      const full = path.join(vectorFontsDir, file);
      prunedBytes += fs.statSync(full).size;
      fs.rmSync(full, { force: true });
      prunedCount++;
    }
  }
  if (prunedCount > 0) {
    console.log(
      `[sync:app] Pruned ${prunedCount} unused icon font files (${(prunedBytes / 1024 / 1024).toFixed(2)} MB saved).`
    );
  }
}

const manifest = { css: cssMatch[1], js: jsMatch[1] };
fs.writeFileSync(path.join(publicDir, 'app-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log('[sync:app] Synced manifest:', manifest);
