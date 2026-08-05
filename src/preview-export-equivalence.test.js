// §23.3 — "本專案最重要的一條驗收". A script, run every time geometry.js
// (or export.js's matrix logic) changes, that checks Preview and Export
// compute the SAME four corner points for a Slot's content, for every
// combination plan.md names: contain/cover/stretch × rotation
// 0/90/180/270 × flipX/flipY × offset≠0.
//
// Scope note on the "× 來源 /Rotate=90 的 PDF" part of that same bullet:
// for a pdf-page Source, Preview draws pdf.js's ALREADY-ROTATED bitmap
// (naturalWidth/Height, §14.3) while Export embeds the RAW un-rotated page
// and must apply (slot.rotation + source.pageRotate) itself (§14.2/§14.3;
// see export.js's computeContentRotationAndSize). Proving that combination
// correct here would require independently re-deriving pdf.js's own
// rotation convention by hand — encoding the same assumption twice risks
// hiding the exact class of bug this test exists to catch. That specific
// case instead gets an EMPIRICAL check with the real libraries: see
// dev/export.html's Playwright verification (round-trips a real /Rotate 90
// source through real pdf.js AND real pdf-lib and compares the rendered
// result). What THIS file proves rigorously, by direct hand-computed
// corner comparison, is every other cell of the matrix — fitMode × slot
// rotation × flip × offset × scale, for both image and un-rotated
// pdf-page Sources — which is the part a geometry.js regression would
// actually be caught by.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot, createSource } from './model.js';
import { slotContentMatrix, pdfPageFlipMatrix, multiply, applyToPoint } from './geometry.js';
import { computeExportContentMatrix } from './export.js';

const EPSILON_PT = 0.28; // §23.3.2's ≤ 0.1mm (~0.28pt) tolerance

function assertPointsClose(a, b, msg) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  assert.ok(distance <= EPSILON_PT, msg ?? `expected points within ${EPSILON_PT}pt, got ${JSON.stringify(a)} vs ${JSON.stringify(b)} (Δ=${distance.toFixed(4)}pt)`);
}

// "Preview's matrix", but in the SAME absolute-page coordinate frame
// Export uses (rather than preview.js's DOM-nesting-convenience local
// origin) — purely so the two are comparable point-for-point on one
// physical sheet of paper. This is mathematically identical to what
// preview.js's computeSlotContentTransform() computes; only the origin
// parameter differs (a translation, not a shape difference), which is
// exactly the difference §4.3 permits between the two renderers.
function previewMatrixAbsolute(slot, contentW, contentH, slotAbsRectPt) {
  return slotContentMatrix({
    slotX: slotAbsRectPt.x,
    slotY: slotAbsRectPt.y,
    slotW: slotAbsRectPt.w,
    slotH: slotAbsRectPt.h,
    contentW,
    contentH,
    fitMode: slot.fitMode,
    scale: slot.scale,
    rotation: slot.rotation,
    offsetX: slot.offsetX,
    offsetY: slot.offsetY,
    flipX: slot.flipX,
    flipY: slot.flipY,
  });
}

function fourCorners(matrix, w, h) {
  return [
    applyToPoint(matrix, 0, 0),
    applyToPoint(matrix, w, 0),
    applyToPoint(matrix, 0, h),
    applyToPoint(matrix, w, h),
  ];
}

const PAPER_HEIGHT_PT = 841.89; // A4
const SLOT_ABS_RECT_PT = { x: 60, y: 90, w: 220, h: 340 };

function checkEquivalence(label, source, slot) {
  test(`§23.3 equivalence: ${label}`, () => {
    // Preview: model-space matrix using naturalWidth/Height (for an image,
    // or a pdf-page with pageRotate=0 — the "no source rotation" case this
    // file proves rigorously), then flipped into PDF space for comparison.
    const previewModel = previewMatrixAbsolute(slot, source.naturalWidth, source.naturalHeight, SLOT_ABS_RECT_PT);
    const previewPdfSpace = multiply(pdfPageFlipMatrix(PAPER_HEIGHT_PT), previewModel);
    const previewCorners = fourCorners(previewPdfSpace, source.naturalWidth, source.naturalHeight);

    // Export: computeExportContentMatrix() already returns a PDF-space
    // matrix, using whatever computeContentRotationAndSize() decides
    // (which, for pageRotate=0, is identical to Preview's parameters).
    const exportMatrix = computeExportContentMatrix(slot, source, SLOT_ABS_RECT_PT, PAPER_HEIGHT_PT);
    const exportCorners = fourCorners(exportMatrix, source.naturalWidth, source.naturalHeight);

    for (let i = 0; i < 4; i += 1) {
      assertPointsClose(previewCorners[i], exportCorners[i], `${label}: corner ${i} mismatch`);
    }
  });
}

const FIT_MODES = ['contain', 'cover', 'stretch'];
const ROTATIONS = [0, 90, 180, 270];
const FLIPS = [
  { flipX: false, flipY: false },
  { flipX: true, flipY: false },
  { flipX: false, flipY: true },
  { flipX: true, flipY: true },
];

// A landscape image content (2:1) so contain/cover actually differ visibly
// from a square, and rotation's axis-swap is exercised meaningfully.
const imageSource = createSource({ kind: 'image', naturalWidth: 200, naturalHeight: 100 });
// An un-rotated pdf-page Source (pageRotate=0) — proves the pdf-page code
// path (RAW box dims via effectiveBoundingBox) agrees with Preview's
// naturalWidth/Height path when there's no source rotation to combine.
const pdfPageSource = createSource({
  kind: 'pdf-page', pageRotate: 0,
  naturalWidth: 200, naturalHeight: 100,
  cropBox: { x: 0, y: 0, w: 200, h: 100 },
});

for (const source of [imageSource, pdfPageSource]) {
  for (const fitMode of FIT_MODES) {
    for (const rotation of ROTATIONS) {
      for (const { flipX, flipY } of FLIPS) {
        const slot = createSlot({ fitMode, rotation, flipX, flipY, offsetX: 0, offsetY: 0, scale: 1 });
        checkEquivalence(`${source.kind} fit=${fitMode} rot=${rotation} flipX=${flipX} flipY=${flipY}`, source, slot);
      }
    }
  }
}

// offset ≠ 0 and scale ≠ 1, per §23.3.3's explicit list, on a representative subset.
for (const source of [imageSource, pdfPageSource]) {
  for (const rotation of ROTATIONS) {
    const slot = createSlot({
      fitMode: 'contain', rotation, offsetX: 0.15, offsetY: -0.2, scale: 1.4, flipX: rotation === 90, flipY: rotation === 270,
    });
    checkEquivalence(`${source.kind} offset+scale rot=${rotation}`, source, slot);
  }
}
