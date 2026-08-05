import test from 'node:test';
import assert from 'node:assert/strict';
import { computeContentHash } from './hash.js';

test('computeContentHash returns a 64-char lowercase hex SHA-256 digest', async () => {
  const hash = await computeContentHash(new TextEncoder().encode('hello world'));
  assert.equal(hash.length, 64);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, 'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
});

test('computeContentHash is deterministic for the same bytes', async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const a = await computeContentHash(bytes);
  const b = await computeContentHash(bytes);
  assert.equal(a, b);
});

test('computeContentHash differs for different bytes', async () => {
  const a = await computeContentHash(new Uint8Array([1, 2, 3]));
  const b = await computeContentHash(new Uint8Array([1, 2, 4]));
  assert.notEqual(a, b);
});

test('computeContentHash accepts a plain ArrayBuffer, not just Uint8Array', async () => {
  const buf = new Uint8Array([9, 9, 9]).buffer;
  const hash = await computeContentHash(buf);
  assert.equal(hash.length, 64);
});
