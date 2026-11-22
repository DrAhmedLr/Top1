import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { checkBundle } from './check-bundle.mjs';

function fixture(t) {
  const base = mkdtempSync(join(tmpdir(), 'top1-mobile-bundle-'));
  t.after(() => rmSync(base, { recursive: true, force: true }));
  const web = join(base, 'www');
  mkdirSync(join(web, 'assets'), { recursive: true });
  writeFileSync(join(web, 'index.html'), [
    '<link rel="stylesheet" href="./assets/main.css">',
    '<script type="module" crossorigin src="/assets/main.js"></script>',
  ].join('\n'));
  return { base, web };
}

test('a module and stylesheet referenced by the built HTML must exist', t => {
  const { web } = fixture(t);
  assert.deepEqual(checkBundle(web), [
    'Missing local asset in index.html: ./assets/main.css',
    'Missing local asset in index.html: /assets/main.js',
  ]);
  writeFileSync(join(web, 'index.html'), '<!-- /assets/main.js -->');
  assert.ok(checkBundle(web).includes('Missing application module entry in index.html.'));
});

test('both native copies include the same content as the current build', t => {
  const { base, web } = fixture(t);
  writeFileSync(join(web, 'assets/main.css'), 'body{}');
  writeFileSync(join(web, 'assets/main.js'), 'import("./lazy.js");');
  writeFileSync(join(web, 'assets/lazy.js'), 'export default 1;');
  const copies = ['iOS', 'Android'].map(label => ({ label, dir: join(base, label) }));
  for (const copy of copies) {
    cpSync(web, copy.dir, { recursive: true });
    writeFileSync(join(copy.dir, 'cordova.js'), '');
  }
  assert.deepEqual(checkBundle(web, copies), []);
  writeFileSync(join(copies[0].dir, 'assets/lazy.js'), 'export default 0;');
  rmSync(join(copies[1].dir, 'assets/main.css'));
  const problems = checkBundle(web, copies);
  assert.equal(problems.length, 2);
  assert.ok(problems.some(message => message.includes('iOS') && message.includes('lazy.js')));
  assert.ok(problems.some(message => message.includes('Android') && message.includes('main.css')));
});
