import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRange } from './page-range.js';

test('empty string and "all" mean every page, 0-based', () => {
  assert.deepEqual(parsePageRange('', 3), [0, 1, 2]);
  assert.deepEqual(parsePageRange('all', 3), [0, 1, 2]);
  assert.deepEqual(parsePageRange(undefined, 3), [0, 1, 2]);
});

test('odd/even keywords use 1-based page numbering', () => {
  assert.deepEqual(parsePageRange('odd', 5), [0, 2, 4]); // pages 1,3,5
  assert.deepEqual(parsePageRange('even', 5), [1, 3]); // pages 2,4
});

test('single pages and comma lists', () => {
  assert.deepEqual(parsePageRange('1,3,5', 5), [0, 2, 4]);
});

test('ranges, including combined range + list, dedupe and sort', () => {
  assert.deepEqual(parsePageRange('1-5,8,10-12', 12), [0, 1, 2, 3, 4, 7, 9, 10, 11]);
});

test('overlapping segments deduplicate', () => {
  assert.deepEqual(parsePageRange('1-3,2-4', 5), [0, 1, 2, 3]);
});

test('whitespace around segments is tolerated', () => {
  assert.deepEqual(parsePageRange(' 1 - 3 , 5 ', 5), [0, 1, 2, 4]);
});

test('rejects a range where start > end', () => {
  assert.throws(() => parsePageRange('5-2', 10), /start > end/);
});

test('rejects out-of-range page numbers', () => {
  assert.throws(() => parsePageRange('1-5', 3), /out of range/);
  assert.throws(() => parsePageRange('0', 3), /out of range/);
});

test('rejects garbage syntax instead of silently ignoring it', () => {
  assert.throws(() => parsePageRange('abc', 3), /Invalid page range segment/);
  assert.throws(() => parsePageRange('1-2-3', 3), /Invalid page range segment/);
});

test('rejects a non-positive pageCount', () => {
  assert.throws(() => parsePageRange('all', 0));
  assert.throws(() => parsePageRange('all', -1));
});
