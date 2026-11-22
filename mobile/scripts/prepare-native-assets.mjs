import { createHash } from 'node:crypto';
import { link, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';

const mobileRoot = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const cliManifest = require.resolve('@capacitor/cli/package.json');
const { extract } = createRequire(cliManifest)('tar');

// Pinned archives from @capacitor/cli 8.6.2. Review the resource list on upgrade.
const templates = [
  ['android', 'android-template.tar.gz', '4c79927aeae3aadf352819248cadb80bf0ecf85216d8a2a7f704573d225c7e4a'],
  ['ios', 'ios-spm-template.tar.gz', '4d8f00a05cebde3e3e9fc99ce9ab21cffc95ae31d72391ddcab0b620e0b0abea'],
];

let restored = 0;
for (const [platform, archive, checksum] of templates) {
  const file = join(dirname(cliManifest), 'assets', archive);
  const digest = createHash('sha256').update(await readFile(file)).digest('hex');
  if (digest !== checksum) throw new Error(`Review the installed Capacitor template before using ${archive}.`);

  const root = join(mobileRoot, platform);
  const staging = await mkdtemp(join(root, '.top1-native-assets-'));
  try {
    const paths = [];
    await extract({
      file,
      cwd: staging,
      strict: true,
      filter(path, entry) {
        if (entry.type !== 'File' || !(path.endsWith('.png') || path === 'gradle/wrapper/gradle-wrapper.jar')) return false;
        paths.push(path);
        return true;
      },
    });
    for (const path of paths) {
      const target = join(root, path);
      await mkdir(dirname(target), { recursive: true });
      try {
        // Publish a complete file atomically and preserve any existing artwork.
        await link(join(staging, path), target);
        restored++;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
      }
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}
console.log(`Restored ${restored} missing native template assets.`);
