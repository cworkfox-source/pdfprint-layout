import test from 'node:test';
import assert from 'node:assert/strict';
import { createBinaryStore, isArrayBufferDetached } from './binary-store.js';

test('put/get/has round-trip an ArrayBuffer by docId', () => {
  const store = createBinaryStore();
  const bytes = new ArrayBuffer(16);
  store.put('doc-1', bytes);
  assert.equal(store.has('doc-1'), true);
  assert.equal(store.get('doc-1'), bytes);
  assert.equal(store.get('missing'), null);
});

test('put rejects anything that is not an ArrayBuffer', () => {
  const store = createBinaryStore();
  assert.throws(() => store.put('doc-1', new Uint8Array(4)));
  assert.throws(() => store.put('doc-1', 'not bytes'));
});

test('§12.3 — getCopyForPdfJs never returns the same buffer instance twice', () => {
  const store = createBinaryStore();
  const original = new ArrayBuffer(8);
  new Uint8Array(original).set([1, 2, 3, 4, 5, 6, 7, 8]);
  store.put('doc-1', original);

  const copy1 = store.getCopyForPdfJs('doc-1');
  const copy2 = store.getCopyForPdfJs('doc-1');
  assert.notEqual(copy1, original);
  assert.notEqual(copy1, copy2);
  assert.deepEqual([...new Uint8Array(copy1)], [...new Uint8Array(original)]);

  // Simulate PDF.js detaching the copy it was handed (structured-clone
  // transfer). The original in the store must remain completely unaffected.
  structuredClone(copy1, { transfer: [copy1] });
  assert.equal(isArrayBufferDetached(copy1), true);
  assert.equal(isArrayBufferDetached(original), false);
  assert.deepEqual([...new Uint8Array(store.get('doc-1'))], [1, 2, 3, 4, 5, 6, 7, 8]);
});

test('remove/clear/size/totalBytes', () => {
  const store = createBinaryStore();
  store.put('doc-1', new ArrayBuffer(10));
  store.put('doc-2', new ArrayBuffer(6));
  assert.equal(store.size(), 2);
  assert.equal(store.totalBytes(), 16);

  assert.equal(store.remove('doc-1'), true);
  assert.equal(store.remove('doc-1'), false);
  assert.equal(store.size(), 1);

  store.clear();
  assert.equal(store.size(), 0);
  assert.equal(store.totalBytes(), 0);
});

test('isArrayBufferDetached is false for a normal, untouched buffer', () => {
  assert.equal(isArrayBufferDetached(new ArrayBuffer(4)), false);
});
