import test from 'node:test';import assert from 'node:assert/strict';
import {contentSecurityPolicy} from './securityHeaders';
test('production CSP allows nonce-bearing scripts without unsafe script execution',()=>{const csp=contentSecurityPolicy('test-nonce');assert.match(csp,/script-src 'self' 'nonce-test-nonce' 'strict-dynamic'/);assert.doesNotMatch(csp,/unsafe-eval/);assert.match(csp,/object-src 'none'/);assert.throws(()=>contentSecurityPolicy("bad'nonce"));});
