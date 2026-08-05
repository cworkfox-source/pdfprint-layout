import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaperSettings, createSlot } from './model.js';
import {
  resolveZoom,
  computeContentAreaPt,
  computePaperPreviewLayout,
  computeSlotPx,
  PX_PER_PT_AT_ZOOM_1,
} from './preview.js';

function assertClose(actual, expected, epsilon = 1e-6, msg) {
  assert.ok(Math.abs(actual - expected) <= epsilon, msg ?? `expected ${actual} to be close to ${expected}`);
}

test('resolveZoom: named presets', () => {
  const ctx = { containerWidthPx: 1000, containerHeightPx: 1000, paperWidthPt: 595.276, paperHeightPt: 841.89 };
  assert.equal(resolveZoom('100%', ctx), 1);
  assert.equal(resolveZoom('50%', ctx), 0.5);
  assert.equal(resolveZoom('200%', ctx), 2);
});

test('resolveZoom: raw numeric zoom passes through, rejects non-positive', () => {
  const ctx = { containerWidthPx: 1000, containerHeightPx: 1000, paperWidthPt: 595.276, paperHeightPt: 841.89 };
  assert.equal(resolveZoom(1.33, ctx), 1.33);
  assert.throws(() => resolveZoom(0, ctx));
  assert.throws(() => resolveZoom(-1, ctx));
});

test('resolveZoom: unknown preset throws', () => {
  const ctx = { containerWidthPx: 1000, containerHeightPx: 1000, paperWidthPt: 595.276, paperHeightPt: 841.89 };
  assert.throws(() => resolveZoom('banana', ctx));
});

test('resolveZoom: fit-page picks the more constraining axis', () => {
  // A4 portrait (595.276 x 841.89 pt) in a container that's tight on
  // height should be limited by height, not width.
  const zoom = resolveZoom('fit-page', {
    containerWidthPx: 2000,
    containerHeightPx: 841.89, // exactly paper height in px at zoom 1
    paperWidthPt: 595.276,
    paperHeightPt: 841.89,
  });
  assertClose(zoom, 1);
});

test('resolveZoom: fit-width ignores container height entirely', () => {
  const zoom = resolveZoom('fit-width', {
    containerWidthPx: 1190.552, // exactly 2x A4 width
    containerHeightPx: 1, // absurdly small, must not matter
    paperWidthPt: 595.276,
    paperHeightPt: 841.89,
  });
  assertClose(zoom, 2, 1e-3);
});

test('computeContentAreaPt: A4 with margins produces the paper minus margins', () => {
  const paper = createPaperSettings({ marginTopPt: 10, marginBottomPt: 20, marginLeftPt: 5, marginRightPt: 15 });
  const area = computeContentAreaPt(paper);
  assertClose(area.x, 5);
  assertClose(area.y, 10);
  assertClose(area.width, 595.276 - 5 - 15);
  assertClose(area.height, 841.89 - 10 - 20);
});

test('computeContentAreaPt: throws when margins consume the whole page', () => {
  const paper = createPaperSettings({ marginLeftPt: 300, marginRightPt: 300 });
  assert.throws(() => computeContentAreaPt(paper));
});

test('computePaperPreviewLayout: A4 canvas ratio at zoom 1 matches exact pt values (§23.2 "A4 Canvas 比例正確")', () => {
  const paper = createPaperSettings();
  const layout = computePaperPreviewLayout(paper, 1);
  assertClose(layout.paperPx.width, 595.276 * PX_PER_PT_AT_ZOOM_1);
  assertClose(layout.paperPx.height, 841.89 * PX_PER_PT_AT_ZOOM_1);
  // aspect ratio must match the real A4 ratio, not an approximation
  assertClose(layout.paperPx.width / layout.paperPx.height, 595.276 / 841.89, 1e-9);
});

test('computePaperPreviewLayout: zoom scales px linearly, never touches pt (§23.2.4)', () => {
  const paper = createPaperSettings();
  const at100 = computePaperPreviewLayout(paper, 1);
  const at200 = computePaperPreviewLayout(paper, 2);
  assertClose(at200.paperPx.width, at100.paperPx.width * 2);
  assertClose(at200.paperPx.height, at100.paperPx.height * 2);
  // the pt values themselves are zoom-invariant — this is what makes
  // "Zoom 不影響輸出" true once Export reads paperPt, not paperPx.
  assert.deepEqual(at100.paperPt, at200.paperPt);
});

test('computePaperPreviewLayout: landscape swaps width/height (§23.2.3)', () => {
  const portrait = createPaperSettings({ orientation: 'portrait' });
  const landscape = createPaperSettings({ orientation: 'landscape' });
  const layoutP = computePaperPreviewLayout(portrait, 1);
  const layoutL = computePaperPreviewLayout(landscape, 1);
  assertClose(layoutL.paperPt.width, layoutP.paperPt.height);
  assertClose(layoutL.paperPt.height, layoutP.paperPt.width);
});

test('computePaperPreviewLayout: content area px is nested correctly inside paper px', () => {
  const paper = createPaperSettings({ marginTopPt: 10, marginBottomPt: 10, marginLeftPt: 10, marginRightPt: 10 });
  const layout = computePaperPreviewLayout(paper, 1.5);
  assertClose(layout.contentAreaPx.x, 10 * 1.5);
  assertClose(layout.contentAreaPx.y, 10 * 1.5);
  assertClose(layout.contentAreaPx.width, (595.276 - 20) * 1.5);
  // content area must stay fully inside the paper rect
  assert.ok(layout.contentAreaPx.x >= 0);
  assert.ok(layout.contentAreaPx.x + layout.contentAreaPx.width <= layout.paperPx.width + 1e-6);
});

test('computePaperPreviewLayout: A3 exact pt values', () => {
  const paper = createPaperSettings({ size: 'A3' });
  const layout = computePaperPreviewLayout(paper, 1);
  assertClose(layout.paperPt.width, 841.89, 0.01);
  assertClose(layout.paperPt.height, 1190.551, 0.01);
});

test('computeSlotPx converts a Normalized Slot rect to content-area-relative px', () => {
  const slot = createSlot({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 });
  const px = computeSlotPx(slot, 400, 800);
  assert.deepEqual(px, { x: 100, y: 400, width: 200, height: 200 });
});

test('computeSlotPx: a full-bleed slot (0,0,1,1) exactly fills the content area', () => {
  const slot = createSlot({ x: 0, y: 0, w: 1, h: 1 });
  const px = computeSlotPx(slot, 300, 500);
  assert.deepEqual(px, { x: 0, y: 0, width: 300, height: 500 });
});
