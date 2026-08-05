import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot } from './model.js';
import {
  FILL_ORDERS,
  FILL_FILTERS,
  applyFillRule,
  generateAutoFillPages,
  generateAutoFillPageObjects,
  detectMixedSourceSizes,
} from './auto-fill.js';

// --- applyFillRule -----------------------------------------------------------

test('applyFillRule defaults to sequential/all/repeat-1: passes the list through unchanged', () => {
  assert.deepEqual(applyFillRule(['a', 'b', 'c']), ['a', 'b', 'c']);
});

test('applyFillRule order:"reverse" reverses the list', () => {
  assert.deepEqual(applyFillRule(['a', 'b', 'c'], { order: 'reverse' }), ['c', 'b', 'a']);
});

test('applyFillRule filter:"odd"/"even" keep 1-based odd/even POSITIONS, not source content', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(applyFillRule(ids, { filter: 'odd' }), ['a', 'c', 'e']); // positions 1,3,5
  assert.deepEqual(applyFillRule(ids, { filter: 'even' }), ['b', 'd']); // positions 2,4
});

test('applyFillRule filter applies AFTER order:"reverse" (operates on the already-reversed list)', () => {
  const ids = ['a', 'b', 'c', 'd', 'e'];
  // reversed: e,d,c,b,a -> odd positions (1,3,5): e,c,a
  assert.deepEqual(applyFillRule(ids, { order: 'reverse', filter: 'odd' }), ['e', 'c', 'a']);
});

test('applyFillRule repeatCount repeats each surviving id N times CONSECUTIVELY (§11.2 ID-photo example)', () => {
  assert.deepEqual(applyFillRule(['photo'], { repeatCount: 8 }), Array(8).fill('photo'));
  assert.deepEqual(applyFillRule(['a', 'b'], { repeatCount: 2 }), ['a', 'a', 'b', 'b']);
});

test('applyFillRule rejects an unknown order, filter, or non-positive-integer repeatCount', () => {
  assert.throws(() => applyFillRule(['a'], { order: 'shuffle' }), /unknown order/);
  assert.throws(() => applyFillRule(['a'], { filter: 'every-third' }), /unknown filter/);
  assert.throws(() => applyFillRule(['a'], { repeatCount: 0 }), /positive integer/);
  assert.throws(() => applyFillRule(['a'], { repeatCount: 1.5 }), /positive integer/);
});

test('FILL_ORDERS / FILL_FILTERS list exactly the supported values', () => {
  assert.deepEqual(FILL_ORDERS, ['sequential', 'reverse']);
  assert.deepEqual(FILL_FILTERS, ['all', 'odd', 'even']);
});

// --- generateAutoFillPages ---------------------------------------------------

function templateOf(n) {
  return Array.from({ length: n }, (_, i) => createSlot({ x: i * 0.25, y: 0, w: 0.25, h: 1, fitMode: 'cover', scale: 1.2 }));
}

test('§11.1 worked example: 30 sources + 4-up -> 8 pages, last page 2 Sources + 2 Empty Slots', () => {
  const template = templateOf(4);
  const sourceIds = Array.from({ length: 30 }, (_, i) => `src-${i}`);
  const pages = generateAutoFillPages(template, sourceIds);
  assert.equal(pages.length, 8);
  for (let p = 0; p < 7; p += 1) {
    assert.ok(pages[p].every((slot) => slot.sourceId !== null));
  }
  const lastPage = pages[7];
  assert.equal(lastPage.filter((s) => s.sourceId !== null).length, 2);
  assert.equal(lastPage.filter((s) => s.sourceId === null).length, 2);
});

test('generateAutoFillPages fills sequentially across page boundaries in source order', () => {
  const template = templateOf(2);
  const pages = generateAutoFillPages(template, ['a', 'b', 'c']);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].map((s) => s.sourceId), ['a', 'b']);
  assert.deepEqual(pages[1].map((s) => s.sourceId), ['c', null]);
});

test('generateAutoFillPages preserves every template transform field (fitMode/scale/etc) on every generated page', () => {
  const template = templateOf(1);
  const pages = generateAutoFillPages(template, ['a', 'b']);
  assert.equal(pages.length, 2);
  assert.equal(pages[0][0].fitMode, 'cover');
  assert.equal(pages[0][0].scale, 1.2);
  assert.equal(pages[1][0].fitMode, 'cover');
  assert.equal(pages[1][0].scale, 1.2);
});

test('generateAutoFillPages mints fresh Slot ids per page (no id collisions across generated pages)', () => {
  const template = templateOf(2);
  const pages = generateAutoFillPages(template, ['a', 'b', 'c', 'd']);
  const allIds = pages.flat().map((s) => s.id);
  assert.equal(new Set(allIds).size, allIds.length);
});

test('generateAutoFillPages with an empty source list still produces exactly ONE page, fully empty', () => {
  const template = templateOf(3);
  const pages = generateAutoFillPages(template, []);
  assert.equal(pages.length, 1);
  assert.ok(pages[0].every((s) => s.sourceId === null));
});

test('generateAutoFillPages rejects an empty template layout', () => {
  assert.throws(() => generateAutoFillPages([], ['a']), /non-empty templateSlots/);
});

// --- generateAutoFillPageObjects ---------------------------------------------------

test('generateAutoFillPageObjects wraps each generated slot array in a full Page carrying the template paper settings', () => {
  const template = templateOf(2);
  const paper = { size: 'A3', orientation: 'landscape' };
  const pages = generateAutoFillPageObjects(paper, template, ['a', 'b', 'c']);
  assert.equal(pages.length, 2);
  assert.deepEqual(pages[0].paper, paper);
  assert.deepEqual(pages[1].paper, paper);
  assert.equal(pages[0].slots.length, 2);
  assert.ok(pages[0].id && pages[1].id && pages[0].id !== pages[1].id);
});

// --- detectMixedSourceSizes (§11.4) ---------------------------------------------------

test('detectMixedSourceSizes is false when every source shares the same size', () => {
  const a = { naturalWidth: 595.276, naturalHeight: 841.89 };
  const b = { naturalWidth: 595.276, naturalHeight: 841.89 };
  assert.equal(detectMixedSourceSizes([a, b]), false);
});

test('detectMixedSourceSizes is true when sizes differ (e.g. A4 mixed with A3)', () => {
  const a4 = { naturalWidth: 595.276, naturalHeight: 841.89 };
  const a3 = { naturalWidth: 841.89, naturalHeight: 1190.551 };
  assert.equal(detectMixedSourceSizes([a4, a3]), true);
});

test('detectMixedSourceSizes tolerates float noise (rounds to 0.01)', () => {
  const a = { naturalWidth: 595.276, naturalHeight: 841.89 };
  const bNearlyIdentical = { naturalWidth: 595.2760001, naturalHeight: 841.8899999 };
  assert.equal(detectMixedSourceSizes([a, bNearlyIdentical]), false);
});
