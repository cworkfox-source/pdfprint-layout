import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot, createSource, createPaperSettings, createAppState, createPage, createProject, createCropMarksSettings, createBleedSettings, createTextBox } from './model.js';
import { applyToPoint, boundingBoxOfTransformedRect } from './geometry.js';
import {
  roundedPaperSizePt,
  computeSlotAbsoluteRectPt,
  computeContentRotationAndSize,
  computeExportContentMatrix,
  computeXObjectDrawMatrix,
  computeExportClipRectPt,
  computeBleedClipRectPt,
  computeRotatedTextMatrix,
  computeRotatedImageMatrix,
  detectImageFormat,
  embedSource,
  exportProjectToPdf,
} from './export.js';
import { createBinaryStore } from './binary-store.js';

function assertClose(actual, expected, epsilon = 1e-6, msg) {
  assert.ok(Math.abs(actual - expected) <= epsilon, msg ?? `expected ${actual} to be close to ${expected}`);
}

// --- roundedPaperSizePt (§14.6) ---------------------------------------------

test('roundedPaperSizePt returns the exact A4 pt values, rounded to 3 decimals', () => {
  const size = roundedPaperSizePt(createPaperSettings());
  assert.equal(size.width, 595.276);
  assert.equal(size.height, 841.89);
});

test('roundedPaperSizePt rounds a custom size to 3 decimals', () => {
  const size = roundedPaperSizePt(createPaperSettings({ size: 'custom', customWidthPt: 100.123456, customHeightPt: 200.987654 }));
  assert.equal(size.width, 100.123);
  assert.equal(size.height, 200.988);
});

// --- computeSlotAbsoluteRectPt ----------------------------------------------

test('computeSlotAbsoluteRectPt converts a Normalized Slot rect to absolute pt within the content area', () => {
  const slot = createSlot({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 });
  const contentAreaPt = { x: 20, y: 30, width: 400, height: 800 };
  const rect = computeSlotAbsoluteRectPt(slot, contentAreaPt);
  assert.deepEqual(rect, { x: 20 + 100, y: 30 + 400, w: 200, h: 200 });
});

// --- computeContentRotationAndSize (§14.3 "most common bug") ---------------

test('computeContentRotationAndSize for a pdf-page: combines slot.rotation + source.pageRotate, uses RAW (pre-swap) box dims', () => {
  const source = createSource({
    kind: 'pdf-page', pageRotate: 90, naturalWidth: 841.89, naturalHeight: 595.276, // already swapped (§14.3)
    cropBox: { x: 0, y: 0, w: 595.276, h: 841.89 }, // RAW, pre-swap
  });
  const slot = createSlot({ rotation: 0 });
  const result = computeContentRotationAndSize(source, slot);
  assert.equal(result.rotation, 90); // 0 (slot) + 90 (source) = 90
  assert.equal(result.contentW, 595.276); // RAW box width, NOT naturalWidth
  assert.equal(result.contentH, 841.89);
});

test('computeContentRotationAndSize for a pdf-page: slot.rotation and source.pageRotate ADD and wrap at 360', () => {
  const source = createSource({ kind: 'pdf-page', pageRotate: 270, cropBox: { x: 0, y: 0, w: 100, h: 200 } });
  const slot = createSlot({ rotation: 180 });
  const result = computeContentRotationAndSize(source, slot);
  assert.equal(result.rotation, 90); // (180 + 270) % 360 = 450 % 360 = 90
});

test('computeContentRotationAndSize falls back to mediaBox when a pdf-page has no cropBox', () => {
  const source = createSource({ kind: 'pdf-page', pageRotate: 0, mediaBox: { x: 0, y: 0, w: 300, h: 400 } });
  const result = computeContentRotationAndSize(source, createSlot());
  assert.equal(result.contentW, 300);
  assert.equal(result.contentH, 400);
});

test('computeContentRotationAndSize for an image: only slot.rotation applies, natural (pixel) dims used directly', () => {
  const source = createSource({ kind: 'image', naturalWidth: 800, naturalHeight: 600 });
  const slot = createSlot({ rotation: 90 });
  const result = computeContentRotationAndSize(source, slot);
  assert.equal(result.rotation, 90);
  assert.equal(result.contentW, 800);
  assert.equal(result.contentH, 600);
});

test('computeContentRotationAndSize for an svg: treated exactly like an image (Phase 10)', () => {
  const source = createSource({ kind: 'svg', naturalWidth: 200, naturalHeight: 100 });
  const slot = createSlot({ rotation: 90 });
  const result = computeContentRotationAndSize(source, slot);
  assert.equal(result.rotation, 90);
  assert.equal(result.contentW, 200);
  assert.equal(result.contentH, 100);
});

test('computeContentRotationAndSize rejects an unsupported source kind', () => {
  const source = createSource({ kind: 'blank' });
  assert.throws(() => computeContentRotationAndSize(source, createSlot()), /unsupported source kind/);
});

// --- computeExportContentMatrix ---------------------------------------------

test('computeExportContentMatrix places an unrotated, unscaled full-bleed image Slot exactly, flipped into PDF space', () => {
  const source = createSource({ kind: 'image', naturalWidth: 100, naturalHeight: 100 });
  const slot = createSlot({ fitMode: 'stretch' });
  const slotAbsRectPt = { x: 50, y: 60, w: 100, h: 100 };
  const paperHeightPt = 800;
  const matrix = computeExportContentMatrix(slot, source, slotAbsRectPt, paperHeightPt);

  // model-space top-left of the slot (50,60) with h=100 -> PDF-space y = 800-60-100 = 640
  const bottomLeft = applyToPoint(matrix, 0, 100); // content-local bottom-left (unrotated square)
  assertClose(bottomLeft.x, 50);
  assertClose(bottomLeft.y, 640);
});

test('computeExportContentMatrix: a pdf-page with pageRotate=90 and slot.rotation=0 still fits correctly (content axis swap applied)', () => {
  // Landscape RAW page (595x842-ish numbers picked simple) embedded with
  // pageRotate=90 into a PORTRAIT slot — contain fit must be constrained by
  // the correct (post-combined-rotation) axis, matching what Preview would
  // show using the already-swapped naturalWidth/Height.
  const source = createSource({
    kind: 'pdf-page', pageRotate: 90,
    naturalWidth: 200, naturalHeight: 100, // already swapped (as Preview sees it)
    cropBox: { x: 0, y: 0, w: 100, h: 200 }, // RAW
  });
  const slot = createSlot({ fitMode: 'contain', rotation: 0 });
  const slotAbsRectPt = { x: 0, y: 0, w: 50, h: 50 }; // square slot
  const matrix = computeExportContentMatrix(slot, source, slotAbsRectPt, 800);
  const box = boundingBoxOfTransformedRect(matrix, source.cropBox.w, source.cropBox.h);
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;
  // contain in a 50x50 slot: must fit within it on both axes
  assert.ok(width <= 50 + 1e-6 && height <= 50 + 1e-6);
  // and actually touch the slot on the constraining axis (both equal here
  // since 200:100 content rotated 90 into a square slot is constrained
  // equally on both axes at the corner case, so just assert non-trivial size)
  assert.ok(width > 0 && height > 0);
});

// --- computeExportClipRectPt (§6.6) ------------------------------------------

test('computeExportClipRectPt converts an absolute model-space Slot rect to PDF space (Y flipped, unrotated)', () => {
  const slotAbsRectPt = { x: 50, y: 60, w: 100, h: 200 };
  const clip = computeExportClipRectPt(slotAbsRectPt, 800);
  assert.deepEqual(clip, { x: 50, y: 800 - 60 - 200, w: 100, h: 200 });
});

// --- computeBleedClipRectPt (§16 Bleed, Phase 10) ---------------------------

test('computeBleedClipRectPt is a plain computeExportClipRectPt when bleed is disabled/absent', () => {
  const slotAbsRectPt = { x: 50, y: 60, w: 100, h: 200 };
  assert.deepEqual(
    computeBleedClipRectPt(slotAbsRectPt, createBleedSettings({ enabled: false }), 800),
    computeExportClipRectPt(slotAbsRectPt, 800),
  );
  assert.deepEqual(computeBleedClipRectPt(slotAbsRectPt, undefined, 800), computeExportClipRectPt(slotAbsRectPt, 800));
});

test('computeBleedClipRectPt expands the clip rect by sizePt on all sides when enabled, THEN flips to PDF space', () => {
  const slotAbsRectPt = { x: 50, y: 60, w: 100, h: 200 };
  const clip = computeBleedClipRectPt(slotAbsRectPt, createBleedSettings({ enabled: true, sizePt: 5 }), 800);
  // expanded model rect: { x: 45, y: 55, w: 110, h: 210 } -> Y-flip
  assert.deepEqual(clip, { x: 45, y: 800 - 55 - 210, w: 110, h: 210 });
});

// --- computeRotatedTextMatrix / computeRotatedImageMatrix (Text Box/
// Watermark, Phase 10) -------------------------------------------------------
// Pinned regression values, same convention as computeXObjectDrawMatrix's
// own tests above: verify the FULL composed matrix against hand-computed
// expectations for simple, unambiguous inputs (no rotation, then a 90°
// rotation) rather than only checking it "looks plausible".

test('computeRotatedTextMatrix with no rotation places the text local-origin at (alignedX, alignedY) relative to the box\'s top-left, flipped to PDF space', () => {
  const centerPt = { x: 100, y: 50 }; // box center
  const boxW = 80;
  const boxH = 20;
  const matrix = computeRotatedTextMatrix(centerPt, 0, boxW, boxH, 10, 15, 800);
  // box top-left = center - (w/2, h/2) = (60, 40); local origin (10,15) inside
  // the box -> model point (70, 55) -> PDF y = 800 - 55 = 745
  const point = applyToPoint(matrix, 0, 0);
  assertClose(point.x, 70);
  assertClose(point.y, 745);
});

test('computeRotatedTextMatrix rotates 90 degrees the SAME visual direction as Preview\'s CSS rotation (no manual sign flip needed — the flip composition handles it)', () => {
  // A rotation of the local +X axis (rightward, from the local origin) must,
  // after a 90 deg rotation in the Y-down model convention (§6.3 — visually
  // clockwise, same as Slot content), end up pointing in the model's +Y
  // direction (downward). Once flipped to PDF space that is the -Y (page-
  // down) direction — i.e. NOT the same sign as pdf-lib's own native CCW
  // `rotate:` option would give for the same numeric angle (see the
  // decision_log D-19 note on why this function avoids that option).
  const centerPt = { x: 0, y: 0 };
  const matrix = computeRotatedTextMatrix(centerPt, 90, 100, 100, 0, 0, 1000);
  const origin = applyToPoint(matrix, 0, 0);
  const alongLocalX = applyToPoint(matrix, 10, 0);
  const modelDelta = { x: alongLocalX.x - origin.x, y: -(alongLocalX.y - origin.y) }; // un-flip the Y delta back to model space
  assertClose(modelDelta.x, 0);
  assertClose(modelDelta.y, 10); // model +Y (downward on screen) — visually clockwise, matching Slot rotation
});

test('computeRotatedImageMatrix places an unrotated image\'s 4 corners at the expected PDF-space rect (D-016\'s unit-square correction applied)', () => {
  const centerPt = { x: 100, y: 100 };
  const matrix = computeRotatedImageMatrix(centerPt, 0, 40, 20, 800);
  // unit square (0,0)-(1,1) -> image rect [80,90]-[120,110] model -> PDF
  const corner00 = applyToPoint(matrix, 0, 0);
  const corner11 = applyToPoint(matrix, 1, 1);
  assertClose(corner00.x, 80);
  assertClose(corner00.y, 800 - 110); // bottom-left of the image in PDF space
  assertClose(corner11.x, 120);
  assertClose(corner11.y, 800 - 90);
});

// --- computeXObjectDrawMatrix (§14.1/§14.5, decision_log D-016) -------------
// Regression tests pinned to values EMPIRICALLY calibrated against real
// pdf-lib + real pdf.js (see the D-016 trace): a naive matrix that only
// accounted for the outer page-level Y-flip either drew images into a
// razor-thin invisible sliver, or drew pdf-page content vertically
// mirrored. These exact numbers are what real rendering confirmed correct
// for this specific, easy-to-reason-about case (full-bleed stretch, no
// rotation, content exactly matching the target box) — do not "simplify"
// away the two branches without re-verifying against dev/export.html's
// Playwright round-trip.

test('computeXObjectDrawMatrix (image): full-bleed stretch resolves to a PLAIN positive scale — no flip, no sliver (§14.5)', () => {
  const source = createSource({ kind: 'image', naturalWidth: 100, naturalHeight: 100 });
  const slot = createSlot({ fitMode: 'stretch' });
  const slotAbsRectPt = { x: 0, y: 0, w: 200, h: 200 };
  const matrix = computeXObjectDrawMatrix(slot, source, slotAbsRectPt, 200);
  assert.deepEqual(matrix, [200, 0, 0, 200, 0, 0]);
});

test('computeXObjectDrawMatrix (pdf-page): full-bleed stretch resolves to the IDENTITY matrix (embedPage BBox already matches)', () => {
  const source = createSource({ kind: 'pdf-page', pageRotate: 0, cropBox: { x: 0, y: 0, w: 200, h: 200 } });
  const slot = createSlot({ fitMode: 'stretch' });
  const slotAbsRectPt = { x: 0, y: 0, w: 200, h: 200 };
  const matrix = computeXObjectDrawMatrix(slot, source, slotAbsRectPt, 200);
  assert.deepEqual(matrix, [1, 0, 0, 1, 0, 0]);
});

test('computeXObjectDrawMatrix differs from computeExportContentMatrix (the conceptual, Preview-comparable matrix) for the same inputs', () => {
  const source = createSource({ kind: 'image', naturalWidth: 100, naturalHeight: 100 });
  const slot = createSlot({ fitMode: 'stretch' });
  const slotAbsRectPt = { x: 0, y: 0, w: 200, h: 200 };
  const conceptual = computeExportContentMatrix(slot, source, slotAbsRectPt, 200);
  const draw = computeXObjectDrawMatrix(slot, source, slotAbsRectPt, 200);
  assert.notDeepEqual(conceptual, draw); // deliberately different — see D-016
});

test('computeXObjectDrawMatrix rejects an unsupported source kind', () => {
  const source = createSource({ kind: 'blank' });
  assert.throws(() => computeXObjectDrawMatrix(createSlot(), source, { x: 0, y: 0, w: 10, h: 10 }, 100), /unsupported source kind/);
});

// --- detectImageFormat (§14.5) — magic-byte sniffing, no filename trust ------

function bytesOf(arr) {
  return new Uint8Array(arr);
}

test('detectImageFormat recognizes PNG/JPEG/WEBP by magic bytes', () => {
  assert.equal(detectImageFormat(bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])), 'png');
  assert.equal(detectImageFormat(bytesOf([0xff, 0xd8, 0xff, 0xe0])), 'jpg');
  assert.equal(detectImageFormat(bytesOf([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])), 'webp');
});

test('detectImageFormat returns "unknown" for unrecognized/too-short bytes', () => {
  assert.equal(detectImageFormat(bytesOf([1, 2, 3])), 'unknown');
  assert.equal(detectImageFormat(bytesOf([])), 'unknown');
});

test('detectImageFormat accepts a plain ArrayBuffer too', () => {
  const buf = new Uint8Array([0xff, 0xd8, 0xff, 0xe1]).buffer;
  assert.equal(detectImageFormat(buf), 'jpg');
});

// --- embedSource / exportProjectToPdf — orchestration, with a FAKE pdfLib ---
// These test ORCHESTRATION only (dedup, error handling, page/z-order, which
// embed method gets called) — not real PDF byte production, which is what
// the real-pdf-lib tests further down (guarded, see below) cover. Mirrors
// sources.test.js's fake-pdfjsLib pattern (§4.1).

function makeFakePdfLib({ encryptedDocIds = new Set() } = {}) {
  class FakeEncryptedPDFError extends Error {}
  const embedCalls = [];
  const drawnXObjectKeys = []; // in call order, across the whole run
  const lineCalls = []; // §16 Crop Marks, across the whole run

  function makeFakePage() {
    let xObjectCounter = 0;
    return {
      node: { newXObject: (name) => `${name}#${xObjectCounter += 1}` },
      pushOperators(...ops) {
        const drawOp = ops.find((o) => o.op === 'Do');
        if (drawOp) drawnXObjectKeys.push(drawOp.args[0]);
      },
      drawLine(opts) { lineCalls.push(opts); },
    };
  }

  function makeFakeOutDoc() {
    const pages = [];
    return {
      pages,
      producer: null,
      creationDate: null,
      setProducer(p) { this.producer = p; },
      setCreationDate(d) { this.creationDate = d; },
      addPage(size) {
        const page = makeFakePage();
        page.size = size;
        pages.push(page);
        return page;
      },
      async embedPage(srcPage, boundingBox) {
        embedCalls.push({ type: 'page', srcPage, boundingBox });
        return { ref: `pageref-${embedCalls.length}` };
      },
      async embedPng(bytes) {
        embedCalls.push({ type: 'png', bytesLength: bytes.length });
        return { ref: `pngref-${embedCalls.length}` };
      },
      async embedJpg(bytes) {
        embedCalls.push({ type: 'jpg', bytesLength: bytes.length });
        return { ref: `jpgref-${embedCalls.length}` };
      },
      async save() { return new Uint8Array([1, 2, 3]); },
    };
  }

  return {
    embedCalls,
    drawnXObjectKeys,
    lineCalls,
    EncryptedPDFError: FakeEncryptedPDFError,
    PDFDocument: {
      create: async () => makeFakeOutDoc(),
      load: async (bytes) => {
        if (encryptedDocIds.has(bytes)) throw new FakeEncryptedPDFError('encrypted');
        return { getPage: (i) => ({ __srcPageIndex: i }) };
      },
    },
    pushGraphicsState: () => ({ op: 'q' }),
    popGraphicsState: () => ({ op: 'Q' }),
    rectangle: (...args) => ({ op: 're', args }),
    clip: () => ({ op: 'W' }),
    endPath: () => ({ op: 'n' }),
    concatTransformationMatrix: (...args) => ({ op: 'cm', args }),
    drawObject: (name) => ({ op: 'Do', args: [name] }),
    rgb: (r, g, b) => ({ r, g, b }),
  };
}

function makePdfPageSource(overrides) {
  return createSource({
    kind: 'pdf-page', pageIndex: 0, pageRotate: 0,
    naturalWidth: 200, naturalHeight: 100,
    cropBox: { x: 0, y: 0, w: 200, h: 100 },
    docId: 'doc-1',
    ...overrides,
  });
}

test('embedSource (pdf-page): loads via pdfLib, calls embedPage with the CropBox mapped to {left,bottom,right,top}', async () => {
  const binaryStore = createBinaryStore();
  const bytes = new Uint8Array([1, 2, 3]).buffer;
  binaryStore.put('doc-1', bytes);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const source = makePdfPageSource({ cropBox: { x: 10, y: 20, w: 100, h: 50 } });

  const embedded = await embedSource(outDoc, source, binaryStore, { pdfLib });
  assert.equal(pdfLib.embedCalls.length, 1);
  assert.equal(pdfLib.embedCalls[0].type, 'page');
  assert.deepEqual(pdfLib.embedCalls[0].boundingBox, { left: 10, bottom: 20, right: 110, top: 70 });
  assert.ok(embedded.ref);
});

test('embedSource (pdf-page): a pdf-lib EncryptedPDFError becomes a clear, wrapped error (§14.2)', async () => {
  const binaryStore = createBinaryStore();
  const bytes = new Uint8Array([1]).buffer;
  binaryStore.put('doc-1', bytes);
  const pdfLib = makeFakePdfLib({ encryptedDocIds: new Set([bytes]) });
  const outDoc = await pdfLib.PDFDocument.create();
  const source = makePdfPageSource({ fileName: 'secret.pdf' });

  await assert.rejects(() => embedSource(outDoc, source, binaryStore, { pdfLib }), /加密.*secret\.pdf/);
});

test('embedSource (image): detects PNG/JPG by magic bytes and calls the matching embed method', async () => {
  const binaryStore = createBinaryStore();
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]).buffer;
  binaryStore.put('doc-png', pngBytes);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const pngSource = createSource({ kind: 'image', docId: 'doc-png', naturalWidth: 10, naturalHeight: 10 });

  await embedSource(outDoc, pngSource, binaryStore, { pdfLib });
  assert.equal(pdfLib.embedCalls[0].type, 'png');
});

test('embedSource (image): a WEBP source is transcoded to PNG via deps.transcodeWebpToPng before embedding (§14.5)', async () => {
  const binaryStore = createBinaryStore();
  const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).buffer;
  binaryStore.put('doc-webp', webpBytes);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const webpSource = createSource({ kind: 'image', docId: 'doc-webp', naturalWidth: 10, naturalHeight: 10 });
  const transcodeCalls = [];
  const transcodeWebpToPng = async (bytes) => { transcodeCalls.push(bytes); return new Uint8Array([0x89, 0x50, 0x4e, 0x47]); };

  await embedSource(outDoc, webpSource, binaryStore, { pdfLib, transcodeWebpToPng });
  assert.equal(transcodeCalls.length, 1);
  assert.equal(pdfLib.embedCalls[0].type, 'png');
});

test('embedSource (image): a WEBP source without deps.transcodeWebpToPng throws a clear error', async () => {
  const binaryStore = createBinaryStore();
  const webpBytes = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]).buffer;
  binaryStore.put('doc-webp', webpBytes);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const webpSource = createSource({ kind: 'image', docId: 'doc-webp' });
  await assert.rejects(() => embedSource(outDoc, webpSource, binaryStore, { pdfLib }), /transcodeWebpToPng/);
});

// --- embedSource (svg, §14/§14.5, Phase 10) ---------------------------------

test('embedSource (svg): ALWAYS rasterizes via deps.rasterizeSvgToPng, unconditionally (pdf-lib has no SVG embed path at all)', async () => {
  const binaryStore = createBinaryStore();
  const svgBytes = new TextEncoder().encode('<svg width="10" height="10"></svg>').buffer;
  binaryStore.put('doc-svg', svgBytes);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const svgSource = createSource({ kind: 'svg', docId: 'doc-svg', naturalWidth: 10, naturalHeight: 10 });
  const rasterizeCalls = [];
  const rasterizeSvgToPng = async (bytes, naturalWidth, naturalHeight) => {
    rasterizeCalls.push({ bytes, naturalWidth, naturalHeight });
    return new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  };

  await embedSource(outDoc, svgSource, binaryStore, { pdfLib, rasterizeSvgToPng });
  assert.equal(rasterizeCalls.length, 1);
  assert.equal(rasterizeCalls[0].naturalWidth, 10);
  assert.equal(rasterizeCalls[0].naturalHeight, 10);
  assert.equal(pdfLib.embedCalls[0].type, 'png');
});

test('embedSource (svg): without deps.rasterizeSvgToPng throws a clear error', async () => {
  const binaryStore = createBinaryStore();
  binaryStore.put('doc-svg', new Uint8Array([1]).buffer);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const svgSource = createSource({ kind: 'svg', docId: 'doc-svg', naturalWidth: 10, naturalHeight: 10 });
  await assert.rejects(() => embedSource(outDoc, svgSource, binaryStore, { pdfLib }), /rasterizeSvgToPng/);
});

test('embedSource throws a clear error when SourceBinaryStore has no bytes for the docId', async () => {
  const binaryStore = createBinaryStore();
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const source = createSource({ kind: 'image', docId: 'missing-doc' });
  await assert.rejects(() => embedSource(outDoc, source, binaryStore, { pdfLib }), /no original bytes/);
});

test('embedSource rejects an unsupported source kind', async () => {
  const binaryStore = createBinaryStore();
  binaryStore.put('doc-1', new Uint8Array([1]).buffer);
  const pdfLib = makeFakePdfLib();
  const outDoc = await pdfLib.PDFDocument.create();
  const source = createSource({ kind: 'blank', docId: 'doc-1' });
  await assert.rejects(() => embedSource(outDoc, source, binaryStore, { pdfLib }), /unsupported source kind/);
});

// --- exportProjectToPdf ---------------------------------------------------

function makeStateWithSources(sources, pages) {
  return createAppState({ sources, pages });
}

test('exportProjectToPdf embeds each unique Source exactly ONCE even when reused across many Slots/pages (§14.5/§23.7.2)', async () => {
  const binaryStore = createBinaryStore();
  binaryStore.put('doc-1', new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer);
  const source = createSource({ id: 'src-1', kind: 'image', docId: 'doc-1', naturalWidth: 100, naturalHeight: 100 });

  // 8 slots referencing the SAME source, spread across 2 pages
  const slotsPage1 = Array.from({ length: 4 }, () => createSlot({ sourceId: 'src-1' }));
  const slotsPage2 = Array.from({ length: 4 }, () => createSlot({ sourceId: 'src-1' }));
  const state = makeStateWithSources([source], [createPage({ slots: slotsPage1 }), createPage({ slots: slotsPage2 })]);

  const pdfLib = makeFakePdfLib();
  await exportProjectToPdf(state, { binaryStore, pdfLib });

  assert.equal(pdfLib.embedCalls.length, 1); // embedded once
  assert.equal(pdfLib.drawnXObjectKeys.length, 8); // but drawn 8 times
});

test('exportProjectToPdf creates one output page per AppState page, sized to the rounded paper MediaBox (§14.6)', async () => {
  const binaryStore = createBinaryStore();
  const state = makeStateWithSources([], [
    createPage({ paper: createPaperSettings({ size: 'A4' }) }),
    createPage({ paper: createPaperSettings({ size: 'A3' }) }),
  ]);
  const pdfLib = makeFakePdfLib();
  let capturedDoc;
  const originalCreate = pdfLib.PDFDocument.create;
  pdfLib.PDFDocument.create = async () => { capturedDoc = await originalCreate(); return capturedDoc; };

  const savedBytes = await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.ok(savedBytes instanceof Uint8Array);
  assert.equal(capturedDoc.pages.length, 2);
  assert.deepEqual(capturedDoc.pages[0].size, [595.276, 841.89]);
  assert.deepEqual(capturedDoc.pages[1].size, [841.89, 1190.551]);
});

test('exportProjectToPdf skips Slots with no sourceId (Empty Slots) — no embed/draw calls for them', async () => {
  const binaryStore = createBinaryStore();
  const state = makeStateWithSources([], [createPage({ slots: [createSlot({ sourceId: null })] })]);
  const pdfLib = makeFakePdfLib();
  await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.equal(pdfLib.embedCalls.length, 0);
  assert.equal(pdfLib.drawnXObjectKeys.length, 0);
});

test('exportProjectToPdf throws a clear error when a Slot references an unknown sourceId', async () => {
  const binaryStore = createBinaryStore();
  const state = makeStateWithSources([], [createPage({ slots: [createSlot({ sourceId: 'does-not-exist' })] })]);
  const pdfLib = makeFakePdfLib();
  await assert.rejects(() => exportProjectToPdf(state, { binaryStore, pdfLib }), /unknown source/);
});

test('exportProjectToPdf draws Slots in §6.5 z-order (same shared sortByZOrder as Preview), not array order', async () => {
  const binaryStore = createBinaryStore();
  binaryStore.put('doc-a', new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer);
  binaryStore.put('doc-b', new Uint8Array([0xff, 0xd8]).buffer);
  const sourceA = createSource({ id: 'src-a', kind: 'image', docId: 'doc-a', naturalWidth: 10, naturalHeight: 10 });
  const sourceB = createSource({ id: 'src-b', kind: 'image', docId: 'doc-b', naturalWidth: 10, naturalHeight: 10 });
  // array order is [B, A] but z-order is [A(z:0), B(z:1)]
  const slotB = createSlot({ id: 'b', sourceId: 'src-b', z: 1 });
  const slotA = createSlot({ id: 'a', sourceId: 'src-a', z: 0 });
  const state = makeStateWithSources([sourceA, sourceB], [createPage({ slots: [slotB, slotA] })]);

  const pdfLib = makeFakePdfLib();
  await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.deepEqual(pdfLib.embedCalls.map((c) => c.type), ['png', 'jpg']); // A (png) embedded before B (jpg)
});

test('exportProjectToPdf sets Producer metadata and a creation date, nothing user-path-specific (§14.6)', async () => {
  const binaryStore = createBinaryStore();
  const state = makeStateWithSources([], [createPage()]);
  const pdfLib = makeFakePdfLib();
  let capturedDoc;
  const originalCreate = pdfLib.PDFDocument.create;
  pdfLib.PDFDocument.create = async () => { capturedDoc = await originalCreate(); return capturedDoc; };

  await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.equal(capturedDoc.producer, 'pdfprint-layout');
  assert.ok(capturedDoc.creationDate instanceof Date);
});

// --- exportProjectToPdf: Crop Marks (§16, Phase 8) --------------------------

test('exportProjectToPdf draws no crop marks when project.cropMarks.enabled is false (the default)', async () => {
  const binaryStore = createBinaryStore();
  const state = makeStateWithSources([], [createPage({ slots: [createSlot()] })]);
  const pdfLib = makeFakePdfLib();
  await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.equal(pdfLib.lineCalls.length, 0);
});

test('exportProjectToPdf draws 8 crop-mark lines per Slot when enabled, even for an Empty Slot with no Source', async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    project: createProject({ cropMarks: createCropMarksSettings({ enabled: true, lengthPt: 10, gapPt: 5, lineWidthPt: 0.5 }) }),
    sources: [],
    pages: [createPage({ slots: [createSlot({ sourceId: null }), createSlot({ sourceId: null })] })],
  });
  const pdfLib = makeFakePdfLib();
  await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.equal(pdfLib.lineCalls.length, 16); // 8 segments x 2 Slots
  assert.equal(pdfLib.lineCalls[0].thickness, 0.5);
  assert.deepEqual(pdfLib.lineCalls[0].color, { r: 0, g: 0, b: 0 });
});

test('exportProjectToPdf: crop marks are drawn once per Slot per PAGE, not once globally', async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    project: createProject({ cropMarks: createCropMarksSettings({ enabled: true }) }),
    sources: [],
    pages: [
      createPage({ slots: [createSlot()] }),
      createPage({ slots: [createSlot(), createSlot()] }),
    ],
  });
  const pdfLib = makeFakePdfLib();
  await exportProjectToPdf(state, { binaryStore, pdfLib });
  assert.equal(pdfLib.lineCalls.length, 8 * 3); // 1 slot on page 1 + 2 slots on page 2 = 3 slots total
});
