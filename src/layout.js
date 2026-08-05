// Layout Engine (docs/plan.md §9, Phase 3). Pure geometry only — no DOM, no
// Canvas — generating the same Normalized Coordinate rects (§5.3) that
// Slots are made of, from a content-area size + gap settings + a preset or
// custom grid shape. Preview drawing lives in preview.js (§13.1 "Preview
// Renderer 顯示...Slots"), not here, per §4.1's Layout Model / DOM split.
//
// Presets are recomputed from the CURRENT paper/gap settings every time
// they're applied (§8.2's "重新套用目前 Preset" button) — nothing here
// tries to preserve an absolute pt gap across different paper sizes by
// itself; that's an explicit user action, not automatic rescaling.

import { createSlot } from './model.js';

// Splits one axis of length `sizePt` into `weights.length` segments
// separated by `gapPt`, sized proportionally to `weights`. Returns
// segments already normalized to the 0..1 range (fraction of `sizePt`),
// since that's what Slot coordinates are stored as (§5.3).
export function splitAxis(sizePt, gapPt, weights) {
  if (!(sizePt > 0)) {
    throw new Error(`splitAxis requires a positive sizePt, got ${sizePt}`);
  }
  if (!(gapPt >= 0)) {
    throw new Error(`splitAxis requires a non-negative gapPt, got ${gapPt}`);
  }
  if (!Array.isArray(weights) || weights.length === 0) {
    throw new Error('splitAxis requires a non-empty weights array');
  }
  if (weights.some((w) => !(w > 0))) {
    throw new Error('splitAxis weights must all be positive');
  }

  const n = weights.length;
  const totalGapPt = (n - 1) * gapPt;
  const availablePt = sizePt - totalGapPt;
  if (availablePt <= 0) {
    throw new Error('Gap leaves zero or negative space to split (§9.1/§9.2)');
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const segments = [];
  let cursorPt = 0;
  for (const w of weights) {
    const segSizePt = availablePt * (w / totalWeight);
    segments.push({ start: cursorPt / sizePt, size: segSizePt / sizePt });
    cursorPt += segSizePt + gapPt;
  }
  return segments;
}

// §9.1 (uniform grids: 1/2/4/6/9/16-up) and §9.2 (custom rows × cols) share
// this one generator — a custom grid IS just a uniform grid with
// user-chosen rows/cols instead of a preset's fixed shape.
export function generateGridSlots({
  contentAreaWidthPt,
  contentAreaHeightPt,
  rows,
  cols,
  gapHorizontalPt = 0,
  gapVerticalPt = 0,
}) {
  if (!Number.isInteger(rows) || rows < 1) {
    throw new Error(`generateGridSlots requires a positive integer rows, got ${rows}`);
  }
  if (!Number.isInteger(cols) || cols < 1) {
    throw new Error(`generateGridSlots requires a positive integer cols, got ${cols}`);
  }

  const rowSegments = splitAxis(contentAreaHeightPt, gapVerticalPt, Array(rows).fill(1));
  const colSegments = splitAxis(contentAreaWidthPt, gapHorizontalPt, Array(cols).fill(1));

  const rects = [];
  for (const row of rowSegments) {
    for (const col of colSegments) {
      rects.push({ x: col.start, y: row.start, w: col.size, h: row.size });
    }
  }
  return rects;
}

// §9.1 asymmetric presets: a top row (split into `topCols` equal columns)
// stacked over a bottom row (split into `bottomCols` equal columns), the
// two rows equally tall. Covers 上2下1 (2,1), 上1下2 (1,2), and the [S]
// generalizations 上3下1 / 上1下3 (a.k.a. "3+1" / "1+3").
export function generateTopBottomSplit(topCols, bottomCols, {
  contentAreaWidthPt,
  contentAreaHeightPt,
  gapHorizontalPt = 0,
  gapVerticalPt = 0,
}) {
  const [topRow, bottomRow] = splitAxis(contentAreaHeightPt, gapVerticalPt, [1, 1]);
  const topColSegments = splitAxis(contentAreaWidthPt, gapHorizontalPt, Array(topCols).fill(1));
  const bottomColSegments = splitAxis(contentAreaWidthPt, gapHorizontalPt, Array(bottomCols).fill(1));

  const rects = [];
  for (const col of topColSegments) {
    rects.push({ x: col.start, y: topRow.start, w: col.size, h: topRow.size });
  }
  for (const col of bottomColSegments) {
    rects.push({ x: col.start, y: bottomRow.start, w: col.size, h: bottomRow.size });
  }
  return rects;
}

// Mirror of generateTopBottomSplit along the horizontal axis: a left column
// (split into `leftRows` equal rows) beside a right column (split into
// `rightRows` equal rows), the two columns equally wide. Covers 左1右2 (1,2)
// and 左2右1 (2,1).
export function generateLeftRightSplit(leftRows, rightRows, {
  contentAreaWidthPt,
  contentAreaHeightPt,
  gapHorizontalPt = 0,
  gapVerticalPt = 0,
}) {
  const [leftCol, rightCol] = splitAxis(contentAreaWidthPt, gapHorizontalPt, [1, 1]);
  const leftRowSegments = splitAxis(contentAreaHeightPt, gapVerticalPt, Array(leftRows).fill(1));
  const rightRowSegments = splitAxis(contentAreaHeightPt, gapVerticalPt, Array(rightRows).fill(1));

  const rects = [];
  for (const row of leftRowSegments) {
    rects.push({ x: leftCol.start, y: row.start, w: leftCol.size, h: row.size });
  }
  for (const row of rightRowSegments) {
    rects.push({ x: rightCol.start, y: row.start, w: rightCol.size, h: row.size });
  }
  return rects;
}

// §9.1's named preset list. MVP-required ([M]): 1up, 2up-h, 2up-v, 4up,
// 6up-2x3, 6up-3x2, 9up, top2-bottom1, top1-bottom2. The rest are [S].
// NOTE: plan.md §9.1 also lists a "2+2" preset alongside 3+1/1+3, but gives
// no geometry distinguishing it from a plain 2×2 (= 4up) grid — left out
// here as an unresolved spec gap rather than guessed at (see decision_log).
export const GRID_PRESETS = Object.freeze({
  '1up': { rows: 1, cols: 1 },
  '2up-h': { rows: 1, cols: 2 }, // side by side
  '2up-v': { rows: 2, cols: 1 }, // stacked
  '4up': { rows: 2, cols: 2 },
  '6up-2x3': { rows: 2, cols: 3 },
  '6up-3x2': { rows: 3, cols: 2 },
  '9up': { rows: 3, cols: 3 },
  '16up': { rows: 4, cols: 4 }, // [S]
});

const ASYMMETRIC_PRESETS = Object.freeze({
  'top2-bottom1': () => ({ fn: generateTopBottomSplit, args: [2, 1] }),
  'top1-bottom2': () => ({ fn: generateTopBottomSplit, args: [1, 2] }),
  'top3-bottom1': () => ({ fn: generateTopBottomSplit, args: [3, 1] }), // [S] "3+1"
  'top1-bottom3': () => ({ fn: generateTopBottomSplit, args: [1, 3] }), // [S] "1+3"
  'left1-right2': () => ({ fn: generateLeftRightSplit, args: [1, 2] }), // [S]
  'left2-right1': () => ({ fn: generateLeftRightSplit, args: [2, 1] }), // [S]
});

export function listPresetIds() {
  return [...Object.keys(GRID_PRESETS), ...Object.keys(ASYMMETRIC_PRESETS)];
}

// Single entry point covering every named §9.1 preset (grid or
// asymmetric). `contentArea` = { contentAreaWidthPt, contentAreaHeightPt,
// gapHorizontalPt, gapVerticalPt } — the same shape generateGridSlots takes.
export function generatePresetSlots(presetId, contentArea) {
  if (presetId in GRID_PRESETS) {
    const { rows, cols } = GRID_PRESETS[presetId];
    return generateGridSlots({ ...contentArea, rows, cols });
  }
  if (presetId in ASYMMETRIC_PRESETS) {
    const { fn, args } = ASYMMETRIC_PRESETS[presetId]();
    return fn(...args, contentArea);
  }
  throw new Error(`Unknown layout preset: ${presetId}`);
}

// Bridges pure rects (this module's output) to real Slot objects
// (model.js's createSlot — id generation, defaults). z defaults to array
// index order, which is already the correct §6.5 tie-break for
// non-overlapping preset layouts.
export function createSlotsFromRects(rects) {
  return rects.map((rect) => createSlot(rect));
}
