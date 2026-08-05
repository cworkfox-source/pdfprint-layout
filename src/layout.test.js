import test from 'node:test';
import assert from 'node:assert/strict';
import {
  splitAxis,
  generateGridSlots,
  generateTopBottomSplit,
  generateLeftRightSplit,
  generatePresetSlots,
  createSlotsFromRects,
  listPresetIds,
} from './layout.js';

// --- splitAxis -------------------------------------------------------------

test('splitAxis with equal weights and no gap splits evenly', () => {
  assert.deepEqual(splitAxis(100, 0, [1, 1]), [
    { start: 0, size: 0.5 },
    { start: 0.5, size: 0.5 },
  ]);
});

test('splitAxis subtracts the gap before dividing (hand-computed)', () => {
  // 100pt axis, 10pt gap between 2 segments -> 90pt available, 45pt each.
  const segments = splitAxis(100, 10, [1, 1]);
  assert.deepEqual(segments, [
    { start: 0, size: 0.45 },
    { start: 0.55, size: 0.45 },
  ]);
});

test('splitAxis proportions segments by weight', () => {
  const segments = splitAxis(90, 0, [1, 2]);
  assert.equal(segments[0].size, 1 / 3);
  assert.equal(segments[1].size, 2 / 3);
  assert.equal(segments[0].start, 0);
  assert.equal(Math.abs(segments[1].start - 1 / 3) < 1e-12, true);
});

test('splitAxis rejects a gap that consumes the entire axis', () => {
  assert.throws(() => splitAxis(10, 10, [1, 1]), /zero or negative space/);
  assert.throws(() => splitAxis(10, 20, [1, 1]), /zero or negative space/);
});

test('splitAxis rejects invalid inputs', () => {
  assert.throws(() => splitAxis(0, 0, [1]));
  assert.throws(() => splitAxis(-5, 0, [1]));
  assert.throws(() => splitAxis(100, -1, [1])); // negative gap
  assert.throws(() => splitAxis(100, 0, [])); // empty weights
  assert.throws(() => splitAxis(100, 0, [1, 0])); // non-positive weight
  assert.throws(() => splitAxis(100, 0, [1, -1]));
});

// --- generateGridSlots (§9.1 uniform grids / §9.2 custom grid) ------------

test('1x1 grid fills the whole content area', () => {
  const rects = generateGridSlots({ contentAreaWidthPt: 500, contentAreaHeightPt: 700, rows: 1, cols: 1 });
  assert.deepEqual(rects, [{ x: 0, y: 0, w: 1, h: 1 }]);
});

test('2x2 grid with no gap produces 4 equal quarters in row-major order', () => {
  const rects = generateGridSlots({ contentAreaWidthPt: 100, contentAreaHeightPt: 100, rows: 2, cols: 2 });
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ]);
});

test('2x2 grid with gap (hand-computed): (100-10)/2 = 45pt cells, 0.45 normalized', () => {
  const rects = generateGridSlots({
    contentAreaWidthPt: 100,
    contentAreaHeightPt: 100,
    rows: 2,
    cols: 2,
    gapHorizontalPt: 10,
    gapVerticalPt: 10,
  });
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 0.45, h: 0.45 },
    { x: 0.55, y: 0, w: 0.45, h: 0.45 },
    { x: 0, y: 0.55, w: 0.45, h: 0.45 },
    { x: 0.55, y: 0.55, w: 0.45, h: 0.45 },
  ]);
});

test('3x2 grid (§9.1 6-up) produces 6 rects', () => {
  const rects = generateGridSlots({ contentAreaWidthPt: 300, contentAreaHeightPt: 600, rows: 3, cols: 2 });
  assert.equal(rects.length, 6);
});

test('generateGridSlots rejects non-positive-integer rows/cols', () => {
  assert.throws(() => generateGridSlots({ contentAreaWidthPt: 100, contentAreaHeightPt: 100, rows: 0, cols: 2 }));
  assert.throws(() => generateGridSlots({ contentAreaWidthPt: 100, contentAreaHeightPt: 100, rows: 2, cols: 1.5 }));
});

test('§23.4 spirit — zero-gap grids are identical Normalized values regardless of paper size', () => {
  const a4 = generateGridSlots({ contentAreaWidthPt: 539, contentAreaHeightPt: 785, rows: 2, cols: 2 });
  const a3 = generateGridSlots({ contentAreaWidthPt: 785, contentAreaHeightPt: 1134, rows: 2, cols: 2 });
  assert.deepEqual(a4, a3);
});

test('non-zero-gap presets legitimately differ across paper sizes (by design — §8.2 "reapply" semantics)', () => {
  const small = generateGridSlots({ contentAreaWidthPt: 100, contentAreaHeightPt: 100, rows: 2, cols: 2, gapHorizontalPt: 10, gapVerticalPt: 10 });
  const large = generateGridSlots({ contentAreaWidthPt: 1000, contentAreaHeightPt: 1000, rows: 2, cols: 2, gapHorizontalPt: 10, gapVerticalPt: 10 });
  assert.notDeepEqual(small, large);
});

// --- asymmetric presets -----------------------------------------------------

test('generateTopBottomSplit(2, 1) — 上2下1 (hand-computed, no gap)', () => {
  const rects = generateTopBottomSplit(2, 1, { contentAreaWidthPt: 100, contentAreaHeightPt: 100 });
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 0.5, h: 0.5 }, // top-left
    { x: 0.5, y: 0, w: 0.5, h: 0.5 }, // top-right
    { x: 0, y: 0.5, w: 1, h: 0.5 }, // bottom, full width
  ]);
});

test('generateTopBottomSplit(1, 2) — 上1下2 (hand-computed, no gap)', () => {
  const rects = generateTopBottomSplit(1, 2, { contentAreaWidthPt: 100, contentAreaHeightPt: 100 });
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 1, h: 0.5 }, // top, full width
    { x: 0, y: 0.5, w: 0.5, h: 0.5 }, // bottom-left
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, // bottom-right
  ]);
});

test('generateLeftRightSplit(1, 2) — 左1右2 (hand-computed, no gap)', () => {
  const rects = generateLeftRightSplit(1, 2, { contentAreaWidthPt: 100, contentAreaHeightPt: 100 });
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 0.5, h: 1 }, // left, full height
    { x: 0.5, y: 0, w: 0.5, h: 0.5 }, // right-top
    { x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, // right-bottom
  ]);
});

test('generateLeftRightSplit(2, 1) — 左2右1 (hand-computed, no gap)', () => {
  const rects = generateLeftRightSplit(2, 1, { contentAreaWidthPt: 100, contentAreaHeightPt: 100 });
  assert.deepEqual(rects, [
    { x: 0, y: 0, w: 0.5, h: 0.5 }, // left-top
    { x: 0, y: 0.5, w: 0.5, h: 0.5 }, // left-bottom
    { x: 0.5, y: 0, w: 0.5, h: 1 }, // right, full height
  ]);
});

// --- preset registry ---------------------------------------------------------

test('generatePresetSlots dispatches grid presets correctly (1up/4up)', () => {
  const contentArea = { contentAreaWidthPt: 100, contentAreaHeightPt: 100 };
  assert.deepEqual(generatePresetSlots('1up', contentArea), [{ x: 0, y: 0, w: 1, h: 1 }]);
  assert.equal(generatePresetSlots('4up', contentArea).length, 4);
  assert.equal(generatePresetSlots('9up', contentArea).length, 9);
  assert.equal(generatePresetSlots('6up-2x3', contentArea).length, 6);
  assert.equal(generatePresetSlots('6up-3x2', contentArea).length, 6);
});

test('generatePresetSlots dispatches asymmetric presets correctly', () => {
  const contentArea = { contentAreaWidthPt: 100, contentAreaHeightPt: 100 };
  assert.deepEqual(
    generatePresetSlots('top2-bottom1', contentArea),
    generateTopBottomSplit(2, 1, contentArea),
  );
  assert.equal(generatePresetSlots('top3-bottom1', contentArea).length, 4);
  assert.equal(generatePresetSlots('left1-right2', contentArea).length, 3);
});

test('generatePresetSlots throws for an unknown preset id', () => {
  assert.throws(() => generatePresetSlots('does-not-exist', { contentAreaWidthPt: 100, contentAreaHeightPt: 100 }), /Unknown layout preset/);
});

test('listPresetIds includes every MVP-required preset (§9.1)', () => {
  const ids = listPresetIds();
  for (const required of ['1up', '2up-h', '2up-v', '4up', '6up-2x3', '6up-3x2', '9up', 'top2-bottom1', 'top1-bottom2']) {
    assert.ok(ids.includes(required), `missing MVP preset: ${required}`);
  }
});

// --- createSlotsFromRects ----------------------------------------------------

test('createSlotsFromRects produces real Slot objects with unique ids and null sourceId', () => {
  const rects = generateGridSlots({ contentAreaWidthPt: 100, contentAreaHeightPt: 100, rows: 2, cols: 2 });
  const slots = createSlotsFromRects(rects);
  assert.equal(slots.length, 4);
  const ids = new Set(slots.map((s) => s.id));
  assert.equal(ids.size, 4);
  for (let i = 0; i < slots.length; i += 1) {
    assert.equal(slots[i].x, rects[i].x);
    assert.equal(slots[i].y, rects[i].y);
    assert.equal(slots[i].w, rects[i].w);
    assert.equal(slots[i].h, rects[i].h);
    assert.equal(slots[i].sourceId, null);
    assert.equal(slots[i].z, 0); // default; array index is the §6.5 tie-break
  }
});
