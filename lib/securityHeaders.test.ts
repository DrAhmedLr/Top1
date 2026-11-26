import test from 'node:test';
import assert from 'node:assert/strict';
import { appShellContentSecurityPolicy, contentSecurityPolicy } from './securityHeaders';

test('production CSP allows nonce-bearing scripts without unsafe script execution', () => {
  const csp = contentSecurityPolicy('test-nonce');
  assert.match(csp, /script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /object-src 'none'/);
  assert.throws(() => contentSecurityPolicy("bad'nonce"));
});

test('app-shell CSP validates nonce and allows Rive WASM without unsafe-eval', () => {
  const csp = appShellContentSecurityPolicy('shell-nonce-1');
  assert.match(csp, /script-src 'self' 'nonce-shell-nonce-1' 'strict-dynamic' 'wasm-unsafe-eval'/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
  assert.match(csp, /worker-src 'self' blob:/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.throws(() => appShellContentSecurityPolicy('bad;nonce'));
});
