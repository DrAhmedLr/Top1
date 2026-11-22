import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

function bundleFiles(root, subdir = '') {
  const files = [];
  for (const entry of readdirSync(join(root, subdir), { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(subdir, entry.name);
    if (entry.isDirectory()) files.push(...bundleFiles(root, path));
    if (entry.isFile()) files.push(path);
  }
  return files;
}

export function checkBundle(root, nativeCopies = []) {
  const index = join(root, 'index.html');
  if (!existsSync(index) || !statSync(index).isFile()) return ['Missing index.html. Build the mobile client.'];

  const problems = [];
  const html = readFileSync(index, 'utf8');
  const files = bundleFiles(root);
  const packaged = new Set(files.map(path => path.split(sep).join('/')));
  if (html.includes('data-development-shell')) problems.push('Development placeholder remains.');

  // Vite emits external module scripts and stylesheet links in the generated index.
  let hasEntry = false;
  for (const [tag, name] of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const attrs = Object.fromEntries(Array.from(
      tag.matchAll(/\s+([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g),
      ([, key, doubleQuoted, singleQuoted, bare]) => [key.toLowerCase(), doubleQuoted ?? singleQuoted ?? bare],
    ));
    const script = name.toLowerCase() === 'script';
    if (!script && !attrs.rel?.toLowerCase().split(/\s+/).includes('stylesheet')) continue;
    const ref = script ? attrs.src : attrs.href;
    if (script && attrs.type?.toLowerCase() === 'module' && ref) hasEntry = true;
    if (!ref) continue;
    try {
      const url = new URL(ref, 'https://bundle.invalid/');
      if (url.origin !== 'https://bundle.invalid' || !packaged.has(decodeURIComponent(url.pathname.slice(1)))) {
        problems.push(`Missing local asset in index.html: ${ref}`);
      }
    } catch {
      problems.push(`Invalid asset reference in index.html: ${ref}`);
    }
  }
  if (!hasEntry) problems.push('Missing application module entry in index.html.');

  for (const path of files) {
    const data = readFileSync(join(root, path));
    if (/\.(js|html)$/.test(path)) {
      const content = data.toString('utf8');
      if (/\bsb_secret_[A-Za-z0-9_-]+/.test(content) || /"role"\s*:\s*"service_role"/.test(content)) {
        problems.push(`Secret-like content found in ${path}`);
      }
      if (/process\.env\.NEXT_PUBLIC_/.test(content)) problems.push(`Unsubstituted configuration in ${path}`);
    }
    for (const { label, dir } of nativeCopies) {
      const copy = join(dir, path);
      if (!existsSync(copy) || !statSync(copy).isFile() || !data.equals(readFileSync(copy))) {
        problems.push(`${label} copy is missing or out of date: ${path}. Run pnpm sync.`);
      }
    }
  }
  return problems;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const problems = checkBundle(resolve(import.meta.dirname, '../www'));
  if (problems.length) {
    console.error(problems.join('\n'));
    process.exitCode = 1;
  } else {
    console.log('Bundled client assets and configuration checks passed.');
  }
}
