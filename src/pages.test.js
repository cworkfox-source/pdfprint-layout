import test from 'node:test';
import assert from 'node:assert/strict';
import { createPage, createSlot } from './model.js';
import { addPage, deletePage, duplicatePage, movePage } from './pages.js';

function pagesOf(ids) {
  return ids.map((id) => createPage({ id }));
}

// --- addPage -----------------------------------------------------------------

test('addPage appends by default', () => {
  const pages = pagesOf(['a', 'b']);
  const newPage = createPage({ id: 'c' });
  const result = addPage(pages, newPage);
  assert.deepEqual(result.map((p) => p.id), ['a', 'b', 'c']);
});

test('addPage inserts at a specific index', () => {
  const pages = pagesOf(['a', 'b']);
  const newPage = createPage({ id: 'x' });
  const result = addPage(pages, newPage, 1);
  assert.deepEqual(result.map((p) => p.id), ['a', 'x', 'b']);
});

test('addPage clamps an out-of-range index', () => {
  const pages = pagesOf(['a', 'b']);
  const newPage = createPage({ id: 'x' });
  assert.deepEqual(addPage(pages, newPage, 99).map((p) => p.id), ['a', 'b', 'x']);
  assert.deepEqual(addPage(pages, newPage, -5).map((p) => p.id), ['x', 'a', 'b']);
});

// --- deletePage ---------------------------------------------------------------

test('deletePage removes the targeted page', () => {
  const pages = pagesOf(['a', 'b', 'c']);
  assert.deepEqual(deletePage(pages, 'b').map((p) => p.id), ['a', 'c']);
});

test('deletePage throws for an unknown id', () => {
  assert.throws(() => deletePage(pagesOf(['a']), 'missing'), /no page with id/);
});

test('deletePage refuses to remove the last remaining page', () => {
  assert.throws(() => deletePage(pagesOf(['a']), 'a'), /last remaining page/);
});

// --- duplicatePage ---------------------------------------------------------------

test('duplicatePage inserts a copy immediately after the original, with a fresh page id', () => {
  const original = createPage({ id: 'a', paper: { size: 'A3' }, slots: [createSlot({ id: 's1', sourceId: 'src-1' })] });
  const pages = [original, createPage({ id: 'b' })];
  const result = duplicatePage(pages, 'a');
  assert.equal(result.length, 3);
  assert.equal(result[0].id, 'a');
  assert.equal(result[2].id, 'b');
  const clone = result[1];
  assert.notEqual(clone.id, 'a');
  assert.deepEqual(clone.paper, { size: 'A3' });
});

test('duplicatePage copies Slot CONTENT too (sourceId included), unlike a Template (§17.3)', () => {
  const original = createPage({ id: 'a', slots: [createSlot({ id: 's1', sourceId: 'src-1', rotation: 90 })] });
  const clone = duplicatePage([original], 'a')[1];
  assert.equal(clone.slots[0].sourceId, 'src-1');
  assert.equal(clone.slots[0].rotation, 90);
  assert.notEqual(clone.slots[0].id, 's1'); // fresh slot id
});

test('duplicatePage throws for an unknown id', () => {
  assert.throws(() => duplicatePage(pagesOf(['a']), 'missing'), /no page with id/);
});

// --- movePage ---------------------------------------------------------------

test('movePage repositions a page forward and backward', () => {
  const pages = pagesOf(['a', 'b', 'c']);
  assert.deepEqual(movePage(pages, 'a', 2).map((p) => p.id), ['b', 'c', 'a']);
  assert.deepEqual(movePage(pages, 'c', 0).map((p) => p.id), ['c', 'a', 'b']);
});

test('movePage clamps an out-of-range target index instead of throwing', () => {
  const pages = pagesOf(['a', 'b', 'c']);
  assert.deepEqual(movePage(pages, 'a', 99).map((p) => p.id), ['b', 'c', 'a']);
  assert.deepEqual(movePage(pages, 'c', -5).map((p) => p.id), ['c', 'a', 'b']);
});

test('movePage throws for an unknown id', () => {
  assert.throws(() => movePage(pagesOf(['a']), 'missing', 0), /no page with id/);
});
