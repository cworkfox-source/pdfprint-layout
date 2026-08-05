import test from 'node:test';
import assert from 'node:assert/strict';
import { createLruCache } from './lru-cache.js';

test('get/set/has/size behave like a normal cache under the limit', () => {
  const cache = createLruCache({ limit: 3 });
  cache.set('a', 1);
  cache.set('b', 2);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.has('b'), true);
  assert.equal(cache.has('z'), false);
  assert.equal(cache.size(), 2);
});

test('evicts the least-recently-used entry once over the limit', () => {
  const evicted = [];
  const cache = createLruCache({ limit: 2, onEvict: (k, v) => evicted.push([k, v]) });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('c', 3); // over limit -> evict 'a' (oldest, never touched)
  assert.deepEqual(evicted, [['a', 1]]);
  assert.equal(cache.has('a'), false);
  assert.deepEqual(cache.keys(), ['b', 'c']);
});

test('get() refreshes recency so a just-read entry survives eviction', () => {
  const evicted = [];
  const cache = createLruCache({ limit: 2, onEvict: (k) => evicted.push(k) });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.get('a'); // 'a' is now more recently used than 'b'
  cache.set('c', 3); // should evict 'b', not 'a'
  assert.deepEqual(evicted, ['b']);
  assert.equal(cache.has('a'), true);
});

test('re-setting an existing key refreshes recency without growing size', () => {
  const cache = createLruCache({ limit: 2 });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.set('a', 99); // touch + overwrite
  assert.equal(cache.size(), 2);
  assert.equal(cache.get('a'), 99);
  assert.deepEqual(cache.keys(), ['b', 'a']);
});

test('explicit delete() removes the entry but does NOT call onEvict', () => {
  const evicted = [];
  const cache = createLruCache({ limit: 5, onEvict: (k) => evicted.push(k) });
  cache.set('a', 1);
  assert.equal(cache.delete('a'), true);
  assert.equal(cache.has('a'), false);
  assert.deepEqual(evicted, []);
  assert.equal(cache.delete('missing'), false);
});

test('clear() runs onEvict for every remaining entry, then empties the cache', () => {
  const evicted = [];
  const cache = createLruCache({ limit: 5, onEvict: (k, v) => evicted.push([k, v]) });
  cache.set('a', 1);
  cache.set('b', 2);
  cache.clear();
  assert.deepEqual(evicted.sort(), [['a', 1], ['b', 2]].sort());
  assert.equal(cache.size(), 0);
});

test('rejects a non-positive limit', () => {
  assert.throws(() => createLruCache({ limit: 0 }));
  assert.throws(() => createLruCache({ limit: -1 }));
  assert.throws(() => createLruCache({}));
});
