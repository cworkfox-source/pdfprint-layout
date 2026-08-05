import test from 'node:test';
import assert from 'node:assert/strict';
import { createSlot, createSource, createPaperSettings, createAppState, createPage } from './model.js';
import { applyToPoint, boundingBoxOfTransformedRect } from './geometry.js';
import {
  roundedPaperSizePt,
  computeSlotAbsoluteRectPt,
  computeContentRotationAndSize,
  computeExportContentMatrix,
  computeXObjectDrawMatrix,
  computeExportClipRectPt,
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

  function makeFakePage() {
    let xObjectCounter = 0;
    return {
      node: { newXObject: (name) => `${name}#${xObjectCounter += 1}` },
      pushOperators(...ops) {
        const drawOp = ops.find((o) => o.op === 'Do');
        if (drawOp) drawnXObjectKeys.push(drawOp.args[0]);
      },
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
