import test from 'node:test';
import assert from 'node:assert/strict';
import {
  offsetRect,
  computeBleedExpandedRect,
  computeSafeAreaRect,
  computeHeaderFooterBandsPt,
  computeTextAnchorInBand,
  formatPageNumber,
  computePageNumberAnchorPt,
  computeWatermarkCenterPt,
  computeWatermarkImageSizePt,
  computeWatermarkMatrix,
  computeAlignedTextOrigin,
  TEXT_BASELINE_OFFSET_FACTOR,
} from './print-aids.js';
import { applyToPoint } from './geometry.js';

// --- offsetRect / Bleed / Safe Area -----------------------------------------

test('offsetRect expands outward on all sides for a positive amount, staying centered', () => {
  const rect = { x: 10, y: 10, w: 100, h: 50 };
  const expanded = offsetRect(rect, 5);
  assert.deepEqual(expanded, { x: 5, y: 5, w: 110, h: 60 });
});

test('offsetRect insets on all sides for a negative amount, staying centered', () => {
  const rect = { x: 10, y: 10, w: 100, h: 50 };
  const inset = offsetRect(rect, -5);
  assert.deepEqual(inset, { x: 15, y: 15, w: 90, h: 40 });
});

test('offsetRect clamps to zero size (collapses to center) rather than going negative', () => {
  const rect = { x: 0, y: 0, w: 10, h: 10 };
  const inset = offsetRect(rect, -20);
  assert.equal(inset.w, 0);
  assert.equal(inset.h, 0);
  assert.equal(inset.x, 5); // collapsed to the rect's own center
  assert.equal(inset.y, 5);
});

test('computeBleedExpandedRect expands by bleedSize and is a no-op for bleedSize 0', () => {
  const rect = { x: 10, y: 10, w: 100, h: 50 };
  assert.deepEqual(computeBleedExpandedRect(rect, 3), { x: 7, y: 7, w: 106, h: 56 });
  assert.deepEqual(computeBleedExpandedRect(rect, 0), rect);
});

test('computeSafeAreaRect insets by marginSize and is a no-op for marginSize 0', () => {
  const rect = { x: 10, y: 10, w: 100, h: 50 };
  assert.deepEqual(computeSafeAreaRect(rect, 5), { x: 15, y: 15, w: 90, h: 40 });
  assert.deepEqual(computeSafeAreaRect(rect, 0), rect);
});

// --- Header / Footer / Page Number bands ------------------------------------

test('computeHeaderFooterBandsPt derives header/footer bands from the content area margins', () => {
  const contentAreaPt = { x: 20, y: 30, width: 500, height: 700 };
  const bands = computeHeaderFooterBandsPt(595, 842, contentAreaPt);
  assert.deepEqual(bands.header, { x: 20, y: 0, w: 500, h: 30 });
  assert.deepEqual(bands.footer, { x: 20, y: 730, w: 500, h: 112 });
});

test('computeTextAnchorInBand anchors left/center/right, vertically centered in the band', () => {
  const band = { x: 100, y: 200, w: 300, h: 40 };
  assert.deepEqual(computeTextAnchorInBand(band, 'left'), { x: 100, y: 220, align: 'left' });
  assert.deepEqual(computeTextAnchorInBand(band, 'center'), { x: 250, y: 220, align: 'center' });
  assert.deepEqual(computeTextAnchorInBand(band, 'right'), { x: 400, y: 220, align: 'right' });
});

test('computeTextAnchorInBand defaults to left for an unrecognized align', () => {
  const band = { x: 0, y: 0, w: 100, h: 10 };
  assert.equal(computeTextAnchorInBand(band, 'bogus').align, 'left');
});

test('formatPageNumber substitutes {page} and {total} tokens', () => {
  assert.equal(formatPageNumber('{page} / {total}', 3, 10), '3 / 10');
  assert.equal(formatPageNumber('Page {page} of {total}', 1, 1), 'Page 1 of 1');
});

test('computePageNumberAnchorPt resolves a "bottom-center" position into the footer band', () => {
  const contentAreaPt = { x: 20, y: 30, width: 500, height: 700 };
  const anchor = computePageNumberAnchorPt('bottom-center', 595, 842, contentAreaPt);
  assert.deepEqual(anchor, { x: 270, y: 786, align: 'center' });
});

test('computePageNumberAnchorPt resolves a "top-left" position into the header band', () => {
  const contentAreaPt = { x: 20, y: 30, width: 500, height: 700 };
  const anchor = computePageNumberAnchorPt('top-left', 595, 842, contentAreaPt);
  assert.deepEqual(anchor, { x: 20, y: 15, align: 'left' });
});

test('computePageNumberAnchorPt throws for an unknown position', () => {
  const contentAreaPt = { x: 0, y: 0, width: 100, height: 100 };
  assert.throws(() => computePageNumberAnchorPt('middle-center', 200, 200, contentAreaPt), /unknown position/);
});

// --- Watermark ---------------------------------------------------------------

test('computeWatermarkCenterPt returns the content area\'s own center point', () => {
  const contentAreaPt = { x: 20, y: 30, width: 500, height: 700 };
  assert.deepEqual(computeWatermarkCenterPt(contentAreaPt), { x: 270, y: 380 });
});

test('computeWatermarkImageSizePt fits width to widthFraction, preserving aspect ratio', () => {
  const size = computeWatermarkImageSizePt(500, 200, 100, 0.6);
  assert.equal(size.width, 300); // 500 * 0.6
  assert.equal(size.height, 150); // 300/200 * 100
});

test('computeWatermarkMatrix places content centered at centerPt with no rotation', () => {
  const matrix = computeWatermarkMatrix({ x: 100, y: 100 }, 0, 40, 20);
  // top-left corner of the (unrotated) content should land at (100-20, 100-10)
  const topLeft = applyToPoint(matrix, 0, 0);
  assert.deepEqual(topLeft, { x: 80, y: 90 });
  const center = applyToPoint(matrix, 20, 10);
  assert.deepEqual(center, { x: 100, y: 100 });
});

// --- computeAlignedTextOrigin -------------------------------------------

test('computeAlignedTextOrigin aligns left/center/right within the box width', () => {
  assert.deepEqual(computeAlignedTextOrigin(100, 40, 30, 12, 'left'), { x: 0, y: 20 + 12 * TEXT_BASELINE_OFFSET_FACTOR });
  assert.deepEqual(computeAlignedTextOrigin(100, 40, 30, 12, 'center'), { x: 35, y: 20 + 12 * TEXT_BASELINE_OFFSET_FACTOR });
  assert.deepEqual(computeAlignedTextOrigin(100, 40, 30, 12, 'right'), { x: 70, y: 20 + 12 * TEXT_BASELINE_OFFSET_FACTOR });
});

test('computeAlignedTextOrigin centers vertically regardless of how much taller the box is than the font size', () => {
  const tight = computeAlignedTextOrigin(50, 12, 30, 12, 'left'); // box height == font size (watermark case)
  const tall = computeAlignedTextOrigin(50, 400, 30, 12, 'left'); // a much taller Text Box
  assert.equal(tight.y, 6 + 12 * TEXT_BASELINE_OFFSET_FACTOR);
  assert.equal(tall.y, 200 + 12 * TEXT_BASELINE_OFFSET_FACTOR);
});

test('computeWatermarkMatrix rotates content around centerPt', () => {
  const matrix = computeWatermarkMatrix({ x: 0, y: 0 }, 90, 40, 20);
  // the content's own center (20,10) must still map to (0,0) after rotation
  const center = applyToPoint(matrix, 20, 10);
  assert.ok(Math.abs(center.x) < 1e-9);
  assert.ok(Math.abs(center.y) < 1e-9);
});
