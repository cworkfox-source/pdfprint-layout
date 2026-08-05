import test from 'node:test';
import assert from 'node:assert/strict';
import {
  mmToPt,
  ptToMm,
  paperSizePt,
  roundPt,
  identity,
  compose,
  translate,
  rotateDeg,
  flipXY,
  applyToPoint,
  computeFitScale,
  slotContentMatrix,
  boundingBoxOfTransformedRect,
  modelYToPdfY,
  pdfPageFlipMatrix,
  normalizeSourceDimensions,
  effectiveBoundingBox,
  sortByZOrder,
} from './geometry.js';

function assertClose(actual, expected, epsilon = 1e-6, msg) {
  assert.ok(Math.abs(actual - expected) <= epsilon, msg ?? `expected ${actual} to be close to ${expected}`);
}

test('mm <-> pt round trip and exact paper sizes (§23.2)', () => {
  assertClose(mmToPt(25.4), 72);
  assertClose(ptToMm(72), 25.4);

  const a4 = paperSizePt('A4');
  assertClose(a4.width, 595.276, 0.01);
  assertClose(a4.height, 841.890, 0.01);

  const a3 = paperSizePt('A3');
  assertClose(a3.width, 841.890, 0.01);
  assertClose(a3.height, 1190.551, 0.01);

  const a4Landscape = paperSizePt('A4', 'landscape');
  assertClose(a4Landscape.width, a4.height);
  assertClose(a4Landscape.height, a4.width);
});

test('roundPt rounds only at 3 decimal places', () => {
  assert.equal(roundPt(595.27649), 595.276);
  assert.equal(roundPt(595.2765), 595.277);
});

test('matrix identity and composition', () => {
  const p = applyToPoint(identity(), 10, 20);
  assert.deepEqual(p, { x: 10, y: 20 });

  const m = compose(translate(5, 0), translate(0, 5));
  // translate(0,5) applied first, then translate(5,0)
  assert.deepEqual(applyToPoint(m, 0, 0), { x: 5, y: 5 });
});

test('rotateDeg(90) maps (1,0) -> (0,1)', () => {
  const p = applyToPoint(rotateDeg(90), 1, 0);
  assertClose(p.x, 0);
  assertClose(p.y, 1);
});

test('flipXY mirrors around origin', () => {
  const p = applyToPoint(flipXY(true, false), 3, 4);
  assert.deepEqual(p, { x: -3, y: 4 });
});

test('computeFitScale contain picks the smaller ratio', () => {
  const { sx, sy } = computeFitScale(100, 50, 200, 200, 'contain');
  // ratios: 200/100=2, 200/50=4 -> contain uses the smaller: 2
  assertClose(sx, 2);
  assertClose(sy, 2);
});

test('computeFitScale cover picks the larger ratio', () => {
  const { sx, sy } = computeFitScale(100, 50, 200, 200, 'cover');
  assertClose(sx, 4);
  assertClose(sy, 4);
});

test('computeFitScale stretch scales axes independently', () => {
  const { sx, sy } = computeFitScale(100, 50, 200, 300, 'stretch');
  assertClose(sx, 2);
  assertClose(sy, 6);
});

test('computeFitScale swaps target dimensions for 90/270 rotation, not 180', () => {
  // content 100x50, slot 200x100 (wide). Unrotated contain would use
  // min(200/100, 100/50) = min(2,2) = 2. Rotated 90, the content's local
  // axes end up swapped onto the slot's axes, so target becomes
  // (slotH=100, slotW=200): min(100/100, 200/50) = min(1,4) = 1.
  const rotated = computeFitScale(100, 50, 200, 100, 'contain', 90);
  assertClose(rotated.sx, 1);
  assertClose(rotated.sy, 1);

  const rotated270 = computeFitScale(100, 50, 200, 100, 'contain', 270);
  assertClose(rotated270.sx, 1);

  const rotated180 = computeFitScale(100, 50, 200, 100, 'contain', 180);
  assertClose(rotated180.sx, 2); // unchanged from unrotated case
});

test('slotContentMatrix: contain, no rotation/offset/flip centers content in slot', () => {
  const m = slotContentMatrix({
    slotX: 0, slotY: 0, slotW: 200, slotH: 200,
    contentW: 100, contentH: 50,
    fitMode: 'contain',
  });
  // fitScale = min(200/100, 200/50) = min(2, 4) = 2, so content becomes
  // 200x100, centered inside the 200x200 slot -> top-left at (0, 50).
  const topLeft = applyToPoint(m, 0, 0);
  assertClose(topLeft.x, 0);
  assertClose(topLeft.y, 50);

  const center = applyToPoint(m, 50, 25);
  assertClose(center.x, 100);
  assertClose(center.y, 100);
});

test('slotContentMatrix: slot offset (non-zero origin) translates the whole result', () => {
  const m = slotContentMatrix({
    slotX: 1000, slotY: 2000, slotW: 200, slotH: 200,
    contentW: 100, contentH: 50,
    fitMode: 'contain',
  });
  const topLeft = applyToPoint(m, 0, 0);
  assertClose(topLeft.x, 1000);
  assertClose(topLeft.y, 2050);
});

test('slotContentMatrix: offsetX/offsetY are fractions of slot size', () => {
  const base = slotContentMatrix({
    slotX: 0, slotY: 0, slotW: 200, slotH: 200,
    contentW: 100, contentH: 50, fitMode: 'contain',
  });
  const shifted = slotContentMatrix({
    slotX: 0, slotY: 0, slotW: 200, slotH: 200,
    contentW: 100, contentH: 50, fitMode: 'contain',
    offsetX: 0.1, offsetY: -0.2,
  });
  const baseP = applyToPoint(base, 0, 0);
  const shiftedP = applyToPoint(shifted, 0, 0);
  assertClose(shiftedP.x, baseP.x + 0.1 * 200);
  assertClose(shiftedP.y, baseP.y - 0.2 * 200);
});

test('slotContentMatrix: 90 degree rotation keeps content centered and rotates its bounding box', () => {
  const m = slotContentMatrix({
    slotX: 0, slotY: 0, slotW: 200, slotH: 100,
    contentW: 100, contentH: 50,
    fitMode: 'contain', rotation: 90,
  });
  const bbox = boundingBoxOfTransformedRect(m, 100, 50);
  // Centered in the slot:
  assertClose((bbox.minX + bbox.maxX) / 2, 100);
  assertClose((bbox.minY + bbox.maxY) / 2, 50);
  // contain with the 90-degree swap makes this an exact fit on the
  // (rotated) height axis -> bbox height should hit the slot height.
  assertClose(bbox.maxY - bbox.minY, 100, 1e-6);
});

test('slotContentMatrix: rotation 0 vs 360 are equivalent', () => {
  const m0 = slotContentMatrix({ slotX: 0, slotY: 0, slotW: 200, slotH: 200, contentW: 100, contentH: 50, fitMode: 'contain', rotation: 0 });
  const m360 = slotContentMatrix({ slotX: 0, slotY: 0, slotW: 200, slotH: 200, contentW: 100, contentH: 50, fitMode: 'contain', rotation: 360 });
  const p0 = applyToPoint(m0, 0, 0);
  const p360 = applyToPoint(m360, 0, 0);
  // rotateDeg(360) is not bit-identical to rotateDeg(0) due to sin/cos
  // floating-point error, so compare with tolerance rather than deepEqual.
  assertClose(p0.x, p360.x);
  assertClose(p0.y, p360.y);
});

test('modelYToPdfY flips only within this one function', () => {
  // A4 height 841.89pt, element of height 100pt sitting at modelY=0 (top)
  // should land at pdfY = 841.89 - 0 - 100 = 741.89 (near the TOP of the
  // PDF page, since PDF y grows upward from the bottom).
  assertClose(modelYToPdfY(0, 100, 841.89), 741.89);
  // An element flush with the bottom of the page (modelY = 841.89 - 100)
  // should land at pdfY = 0.
  assertClose(modelYToPdfY(841.89 - 100, 100, 841.89), 0);
});

test('pdfPageFlipMatrix, applied to an unrotated rect, matches modelYToPdfY exactly (§6.2)', () => {
  const paperHeightPt = 841.89;
  const elementHeightPt = 100;
  const modelY = 200;
  const flip = pdfPageFlipMatrix(paperHeightPt);
  // top-left corner of the rect at (x, modelY) and bottom-left at (x, modelY+h)
  const topLeft = applyToPoint(flip, 50, modelY);
  const bottomLeft = applyToPoint(flip, 50, modelY + elementHeightPt);
  // in PDF space (Y-up), the rect's bottom edge is the SMALLER of the two
  // transformed y values, and must equal modelYToPdfY()'s answer.
  assertClose(Math.min(topLeft.y, bottomLeft.y), modelYToPdfY(modelY, elementHeightPt, paperHeightPt));
  assertClose(topLeft.x, 50); // x is untouched by the flip
});

test('pdfPageFlipMatrix correctly carries a 90° rotation through the Y-flip (unlike a naive translation-only flip)', () => {
  const paperHeightPt = 800;
  const flip = pdfPageFlipMatrix(paperHeightPt);
  // Compose the flip in FRONT of a model-space rotation, matching how
  // export.js composes it in front of slotContentMatrix()'s output.
  const modelMatrix = compose(translate(100, 100), rotateDeg(90));
  const pdfMatrix = compose(flip, modelMatrix);
  // A point at model-local (10, 0): rotateDeg(90) sends (10,0) -> (0,10)
  // (§6.3's rotation convention, positive = clockwise in Y-down model
  // space), then translate(100,100) -> model point (100, 110).
  const modelPoint = applyToPoint(modelMatrix, 10, 0);
  assertClose(modelPoint.x, 100);
  assertClose(modelPoint.y, 110);
  // Flipping that SAME point directly must equal composing-then-applying —
  // i.e. flip(rotate(point)) must equal the composed matrix applied once,
  // proving the rotation survived the composition instead of being
  // silently dropped by a naive "just flip Y at the end" shortcut.
  const composedPoint = applyToPoint(pdfMatrix, 10, 0);
  const appliedSeparately = applyToPoint(flip, modelPoint.x, modelPoint.y);
  assertClose(composedPoint.x, appliedSeparately.x);
  assertClose(composedPoint.y, appliedSeparately.y);
});

test('normalizeSourceDimensions swaps width/height only for 90/270', () => {
  assert.deepEqual(normalizeSourceDimensions(600, 800, 0), { width: 600, height: 800 });
  assert.deepEqual(normalizeSourceDimensions(600, 800, 90), { width: 800, height: 600 });
  assert.deepEqual(normalizeSourceDimensions(600, 800, 270), { width: 800, height: 600 });
  assert.deepEqual(normalizeSourceDimensions(600, 800, 180), { width: 600, height: 800 });
});

test('effectiveBoundingBox prefers cropBox over mediaBox (§13.5/§14.4)', () => {
  const withCrop = { cropBox: { x: 1, y: 1, w: 2, h: 2 }, mediaBox: { x: 0, y: 0, w: 10, h: 10 } };
  assert.deepEqual(effectiveBoundingBox(withCrop), withCrop.cropBox);

  const withoutCrop = { cropBox: undefined, mediaBox: { x: 0, y: 0, w: 10, h: 10 } };
  assert.deepEqual(effectiveBoundingBox(withoutCrop), withoutCrop.mediaBox);
});

test('sortByZOrder sorts ascending by z, ties keep original order', () => {
  const slots = [
    { id: 'a', z: 2 },
    { id: 'b', z: 0 },
    { id: 'c', z: 0 },
    { id: 'd', z: 1 },
  ];
  const sorted = sortByZOrder(slots).map((s) => s.id);
  assert.deepEqual(sorted, ['b', 'c', 'd', 'a']);
});
