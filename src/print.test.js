import test from 'node:test';
import assert from 'node:assert/strict';
import { mmToPt } from './geometry.js';
import {
  computeCropMarksForSlot,
  cropMarkSegmentsToPdfSpace,
  computeCalibrationPageContent,
  exportCalibrationPagePdf,
  CALIBRATION_SQUARE_SIZE_PT,
  CALIBRATION_MARGIN_PT,
} from './print.js';

// --- computeCropMarksForSlot (§16) ------------------------------------------

test('computeCropMarksForSlot returns 8 segments (2 per corner) standing off by gapPt and extending lengthPt further', () => {
  const slotAbsRectPt = { x: 100, y: 200, w: 50, h: 80 };
  const cropMarks = { lengthPt: 10, gapPt: 5 };
  const segments = computeCropMarksForSlot(slotAbsRectPt, cropMarks);
  assert.equal(segments.length, 8);

  // top-left corner (100, 200): horizontal mark extends further LEFT (smaller x),
  // vertical mark extends further UP (smaller y, model space is Y-down).
  assert.deepEqual(segments[0], { x1: 95, y1: 200, x2: 85, y2: 200 });
  assert.deepEqual(segments[1], { x1: 100, y1: 195, x2: 100, y2: 185 });

  // top-right corner (150, 200): horizontal extends further RIGHT, vertical further UP.
  assert.deepEqual(segments[2], { x1: 155, y1: 200, x2: 165, y2: 200 });
  assert.deepEqual(segments[3], { x1: 150, y1: 195, x2: 150, y2: 185 });

  // bottom-left corner (100, 280): horizontal extends further LEFT, vertical further DOWN.
  assert.deepEqual(segments[4], { x1: 95, y1: 280, x2: 85, y2: 280 });
  assert.deepEqual(segments[5], { x1: 100, y1: 285, x2: 100, y2: 295 });

  // bottom-right corner (150, 280): horizontal extends further RIGHT, vertical further DOWN.
  assert.deepEqual(segments[6], { x1: 155, y1: 280, x2: 165, y2: 280 });
  assert.deepEqual(segments[7], { x1: 150, y1: 285, x2: 150, y2: 295 });
});

test('computeCropMarksForSlot: no segment ever touches the Slot rect itself (always >= gapPt away)', () => {
  const slotAbsRectPt = { x: 0, y: 0, w: 100, h: 100 };
  const cropMarks = { lengthPt: 20, gapPt: 4 };
  const segments = computeCropMarksForSlot(slotAbsRectPt, cropMarks);
  for (const seg of segments) {
    const nearestX = Math.min(Math.abs(seg.x1 - 0), Math.abs(seg.x1 - 100), Math.abs(seg.x2 - 0), Math.abs(seg.x2 - 100));
    const nearestY = Math.min(Math.abs(seg.y1 - 0), Math.abs(seg.y1 - 100), Math.abs(seg.y2 - 0), Math.abs(seg.y2 - 100));
    // At least one axis must maintain the gap (the mark's own axis-aligned end sits ON the slot's line
    // for the OTHER axis by design — e.g. a horizontal mark's y sits exactly at the corner's y — but the
    // x coordinate is always outside the slot, and vice versa for vertical marks).
    assert.ok(nearestX >= 4 || nearestY >= 4);
  }
});

// --- cropMarkSegmentsToPdfSpace (§6.2 Y-flip) -------------------------------

test('cropMarkSegmentsToPdfSpace flips only the Y coordinates, X untouched', () => {
  const segments = [{ x1: 10, y1: 20, x2: 30, y2: 40 }];
  const pdfSegments = cropMarkSegmentsToPdfSpace(segments, 800);
  assert.deepEqual(pdfSegments, [{ x1: 10, y1: 780, x2: 30, y2: 760 }]);
});

// --- computeCalibrationPageContent (§15.3) ----------------------------------

test('computeCalibrationPageContent: the square is exactly 100mm x 100mm, offset by the fixed 20mm margin', () => {
  const { squareRectModel } = computeCalibrationPageContent(mmToPt(210), mmToPt(297)); // A4 portrait
  assert.equal(squareRectModel.w, CALIBRATION_SQUARE_SIZE_PT);
  assert.equal(squareRectModel.h, CALIBRATION_SQUARE_SIZE_PT);
  assert.equal(squareRectModel.x, CALIBRATION_MARGIN_PT);
  assert.equal(squareRectModel.y, CALIBRATION_MARGIN_PT);
});

test('computeCalibrationPageContent: 11 tick positions per edge (0..100mm every 10mm) => 22 ticks total', () => {
  const { ticks } = computeCalibrationPageContent(mmToPt(210), mmToPt(297));
  assert.equal(ticks.length, 22);
});

test('computeCalibrationPageContent: first and last top-edge ticks sit exactly at the square\'s own corners', () => {
  const { squareRectModel, ticks } = computeCalibrationPageContent(mmToPt(210), mmToPt(297));
  // Top-edge ticks are vertical strokes (x1 === x2), ending at the square's top edge (y2 === squareRectModel.y).
  const topTicks = ticks.filter((t) => t.x1 === t.x2 && t.y2 === squareRectModel.y);
  assert.equal(topTicks.length, 11);
  assert.equal(topTicks[0].x2, squareRectModel.x);
  assert.equal(topTicks[topTicks.length - 1].x2, squareRectModel.x + squareRectModel.w);
});

test('computeCalibrationPageContent throws if the fixed layout does not fit the given paper', () => {
  assert.throws(() => computeCalibrationPageContent(mmToPt(50), mmToPt(50)), /does not fit/);
});

// --- exportCalibrationPagePdf — orchestration, with a FAKE pdfLib -----------

function makeFakePdfLibForCalibration() {
  const rectangleCalls = [];
  const lineCalls = [];
  const textCalls = [];
  let embeddedFont = null;

  function makeFakePage(size) {
    return {
      size,
      drawRectangle(opts) { rectangleCalls.push(opts); },
      drawLine(opts) { lineCalls.push(opts); },
      drawText(text, opts) { textCalls.push({ text, ...opts }); },
    };
  }

  function makeFakeOutDoc() {
    const pages = [];
    return {
      pages,
      addPage(size) {
        const page = makeFakePage(size);
        pages.push(page);
        return page;
      },
      async embedFont(font) { embeddedFont = font; return { __font: font }; },
      async save() { return new Uint8Array([9, 9, 9]); },
    };
  }

  return {
    rectangleCalls,
    lineCalls,
    textCalls,
    getEmbeddedFont: () => embeddedFont,
    StandardFonts: { Helvetica: 'Helvetica' },
    rgb: (r, g, b) => ({ r, g, b }),
    PDFDocument: { create: async () => makeFakeOutDoc() },
  };
}

test('exportCalibrationPagePdf draws one bordered square, the full tick ruler, and two lines of text, on an A4 page', async () => {
  const pdfLib = makeFakePdfLibForCalibration();
  const bytes = await exportCalibrationPagePdf({ pdfLib });
  assert.ok(bytes instanceof Uint8Array);

  assert.equal(pdfLib.rectangleCalls.length, 1);
  assert.equal(pdfLib.rectangleCalls[0].width, CALIBRATION_SQUARE_SIZE_PT);
  assert.equal(pdfLib.rectangleCalls[0].height, CALIBRATION_SQUARE_SIZE_PT);

  assert.equal(pdfLib.lineCalls.length, 22);
  assert.equal(pdfLib.textCalls.length, 2);
  assert.match(pdfLib.textCalls[0].text, /100%/);
  assert.match(pdfLib.textCalls[1].text, /100mm/);

  assert.equal(pdfLib.getEmbeddedFont(), 'Helvetica');
});

test('exportCalibrationPagePdf requires deps.pdfLib', async () => {
  await assert.rejects(() => exportCalibrationPagePdf({}), /requires deps.pdfLib/);
});
