// §23.7 Export 品質 — byte-level checks against the REAL pdf-lib (not a
// fake), since pdf-lib (unlike pdf.js) runs fine in plain Node with no
// Worker/DOM requirement (verified directly against the vendored build —
// see decision_log D-015). These tests actually produce a PDF, reload it,
// and inspect its structure — the strongest verification short of a human
// opening the file in a reader.
//
// Guarded: `scripts/fetch-vendor.sh` fetches vendor/pdf-lib (gitignored,
// reproducible) for BOTH this file and the dev/export.html browser harness.
// If it hasn't been run yet, this whole file skips with a clear message
// instead of failing `npm test` on a fresh clone — the fake-pdfLib tests in
// export.test.js already cover the same orchestration logic without it.

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSource, createSlot, createPage, createAppState, createPaperSettings, createProject, createCropMarksSettings,
  createBleedSettings, createHeaderFooterSettings, createPageNumberSettings, createWatermarkSettings, createTextBox,
} from './model.js';
import { createBinaryStore } from './binary-store.js';
import { exportProjectToPdf } from './export.js';

let PDFLib = null;
try {
  PDFLib = await import('../vendor/pdf-lib/pdf-lib.esm.js');
} catch {
  PDFLib = null;
}

const skip = PDFLib ? false : 'vendor/pdf-lib not fetched — run scripts/fetch-vendor.sh first';

test('real pdf-lib: exported PDF has the correct rounded MediaBox and page count (§14.6)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    sources: [],
    pages: [createPage({ paper: createPaperSettings({ size: 'A4' }) })],
  });

  const bytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
  const box = reloaded.getPage(0).getMediaBox();
  assert.equal(box.width, 595.276);
  assert.equal(box.height, 841.89);
});

test('real pdf-lib: text-based source PDF exports without rasterizing — text-showing operators survive in the embedded content (§23.7.1)', { skip }, async () => {
  // Build a real source PDF with actual vector text.
  const srcDoc = await PDFLib.PDFDocument.create();
  const srcPage = srcDoc.addPage([200, 200]);
  srcPage.drawText('Hello Export', { x: 20, y: 100, size: 18 });
  const srcBytes = await srcDoc.save();

  const binaryStore = createBinaryStore();
  binaryStore.put('doc-1', srcBytes.buffer.slice(srcBytes.byteOffset, srcBytes.byteOffset + srcBytes.byteLength));
  const source = createSource({
    id: 'src-1', kind: 'pdf-page', docId: 'doc-1', pageIndex: 0, pageRotate: 0,
    naturalWidth: 200, naturalHeight: 200, cropBox: { x: 0, y: 0, w: 200, h: 200 },
  });
  const slot = createSlot({ sourceId: 'src-1', fitMode: 'contain' });
  const state = createAppState({ sources: [source], pages: [createPage({ slots: [slot] })] });

  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const page = reloaded.getPage(0);
  // Walk the page's XObject resources, find the embedded Form XObject, and
  // decode its content stream directly (bypassing any higher-level API) to
  // confirm a text-showing operator is present — i.e. the original vector
  // text traveled through embedPage() intact rather than being rasterized
  // into a single full-page image.
  const xObjects = page.node.Resources().lookup(PDFLib.PDFName.of('XObject'));
  const xObjectRefs = xObjects.entries().map(([, ref]) => ref);
  assert.equal(xObjectRefs.length, 1, 'expected exactly one embedded Form XObject');
  const formXObject = reloaded.context.lookup(xObjectRefs[0]);
  // PDFRawStream.getContents() returns the RAW (still-filtered) bytes —
  // decodePDFRawStream() applies whatever /Filter (FlateDecode here) was
  // used, the same helper pdf-lib's own PDFPageEmbedder uses internally.
  const decoded = PDFLib.decodePDFRawStream(formXObject).decode();
  const text = new TextDecoder('latin1').decode(decoded);
  assert.ok(/\bTj\b|\bTJ\b/.test(text), `expected a text-showing operator in the embedded content, got: ${text.slice(0, 300)}`);
});

test('real pdf-lib: the same image placed in 8 Slots embeds as exactly ONE Image XObject (§23.7.2)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  // embedPng() validates real PNG structure, so synthesize a minimal but
  // valid 1x1 PNG by hand (signature + IHDR + IDAT + IEND, correct CRCs) —
  // no image-encoding npm package needed.
  const realPng = buildMinimalPng();
  binaryStore.put('doc-img', realPng.buffer);
  const source = createSource({ id: 'src-img', kind: 'image', docId: 'doc-img', naturalWidth: 1, naturalHeight: 1 });
  const slots = Array.from({ length: 8 }, (_, i) => createSlot({ sourceId: 'src-img', x: (i % 4) * 0.25, y: Math.floor(i / 4) * 0.5, w: 0.25, h: 0.5 }));
  const state = createAppState({ sources: [source], pages: [createPage({ slots })] });

  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const page = reloaded.getPage(0);
  const xObjects = page.node.Resources().lookup(PDFLib.PDFName.of('XObject'));
  // §14.5 says "embed once, repeat drawImage" — it does NOT require a
  // single shared resource-dictionary NAME (8 Slots draw the same
  // underlying image via 8 cheap `/ContentN Do` resource entries, which is
  // exactly what "repeat drawImage" describes). What must be exactly 1 is
  // the underlying embedded OBJECT the 8 entries all point to — i.e. the
  // actual image bytes are stored in the file only once, not 8 times.
  const distinctRefs = new Set(xObjects.entries().map(([, ref]) => `${ref.objectNumber}:${ref.generationNumber}`));
  assert.equal(distinctRefs.size, 1, 'expected all 8 Slots to reference the SAME underlying embedded image object');
});

test('real pdf-lib: the `cm` operator ACTUALLY written for an image Slot matches computeXObjectDrawMatrix() exactly (regression for D-016)', { skip }, async () => {
  const { computeXObjectDrawMatrix } = await import('./export.js');
  const binaryStore = createBinaryStore();
  const realPng = buildMinimalPng(); // 1x1, but naturalWidth/Height below simulate a 100x100 source
  binaryStore.put('doc-img', realPng.buffer);
  const source = createSource({ id: 'src-img', kind: 'image', docId: 'doc-img', naturalWidth: 100, naturalHeight: 100 });
  const paper = createPaperSettings({ size: 'custom', customWidthPt: 200, customHeightPt: 200, marginTopPt: 0, marginBottomPt: 0, marginLeftPt: 0, marginRightPt: 0 });
  const slot = createSlot({ x: 0, y: 0, w: 1, h: 1, sourceId: 'src-img', fitMode: 'stretch' });
  const state = createAppState({ sources: [source], pages: [createPage({ paper, slots: [slot] })] });

  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const contents = reloaded.getPage(0).node.normalizedEntries().Contents;
  // A page's /Contents can be an ARRAY of multiple stream chunks (pdf-lib
  // may split pushOperators() calls across entries) — concatenate all of
  // them, same as pdf-lib's own PDFPageEmbedder.decodeContents() does.
  // Freshly-created streams stay as a live PDFContentStream (not yet
  // flattened to PDFRawStream) until the NEXT save/parse round-trip;
  // .getUnencodedContents() reads either kind uniformly.
  let text = '';
  for (let i = 0; i < contents.size(); i += 1) {
    const stream = contents.lookup(i);
    const decoded = stream.getUnencodedContents
      ? stream.getUnencodedContents()
      : PDFLib.decodePDFRawStream(stream).decode();
    text += new TextDecoder('latin1').decode(decoded);
  }
  const cmMatch = text.match(/([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+) cm/);
  assert.ok(cmMatch, `expected a cm operator in: ${text}`);
  const actualMatrix = cmMatch.slice(1, 7).map(Number);

  const expectedMatrix = computeXObjectDrawMatrix(
    slot, source, { x: 0, y: 0, w: 200, h: 200 }, 200,
  );
  for (let i = 0; i < 6; i += 1) {
    assert.ok(Math.abs(actualMatrix[i] - expectedMatrix[i]) < 0.01, `matrix[${i}]: expected ${expectedMatrix[i]}, got ${actualMatrix[i]}`);
  }
});

test('real pdf-lib: a /Rotate 90 source page is embedded and drawn with the combined rotation (§23.7.3 / §14.3)', { skip }, async () => {
  const srcDoc = await PDFLib.PDFDocument.create();
  const srcPage = srcDoc.addPage([200, 100]); // raw landscape
  srcPage.setRotation(PDFLib.degrees(90));
  srcPage.drawText('R', { x: 20, y: 20, size: 40 });
  const srcBytes = await srcDoc.save();

  const binaryStore = createBinaryStore();
  binaryStore.put('doc-rot', srcBytes.buffer.slice(srcBytes.byteOffset, srcBytes.byteOffset + srcBytes.byteLength));
  // naturalWidth/Height as Phase 2's sources.js would have recorded them:
  // swapped, since /Rotate 90 (§14.3).
  const source = createSource({
    id: 'src-rot', kind: 'pdf-page', docId: 'doc-rot', pageIndex: 0, pageRotate: 90,
    naturalWidth: 100, naturalHeight: 200, cropBox: { x: 0, y: 0, w: 200, h: 100 }, // RAW dims
  });
  const slot = createSlot({ sourceId: 'src-rot', fitMode: 'contain' });
  const state = createAppState({ sources: [source], pages: [createPage({ paper: createPaperSettings({ size: 'A4' }), slots: [slot] })] });

  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  // The OUTPUT page itself must not rely on a page-level /Rotate — the
  // rotation is baked into the drawn content's own matrix (§14.2: embedPage
  // does not auto-rotate, so if we hadn't compensated, the reloaded page's
  // own rotation would still read 0 while the content silently ended up
  // sideways; there is no page-level signal for "did we get this right" —
  // that is exactly why the pure equivalence test suite is the primary
  // proof, and this test's job is just confirming the pipeline actually
  // ran without throwing and produced a well-formed, single-page PDF).
  assert.equal(reloaded.getPage(0).getRotation().angle, 0);
  assert.equal(reloaded.getPageCount(), 1);
});

test('real pdf-lib: enabling Crop Marks draws exactly 8 real stroked lines per Slot (§16, Phase 8)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    project: createProject({ cropMarks: createCropMarksSettings({ enabled: true, lengthPt: 10, gapPt: 5, lineWidthPt: 0.5 }) }),
    sources: [],
    pages: [createPage({ slots: [createSlot({ sourceId: null }), createSlot({ sourceId: null })] })],
  });

  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const contents = reloaded.getPage(0).node.normalizedEntries().Contents;
  let text = '';
  for (let i = 0; i < contents.size(); i += 1) {
    const stream = contents.lookup(i);
    const decoded = stream.getUnencodedContents ? stream.getUnencodedContents() : PDFLib.decodePDFRawStream(stream).decode();
    text += new TextDecoder('latin1').decode(decoded);
  }
  // pdf-lib's drawLine() emits exactly one `S` (stroke) operator per call
  // (see vendor/pdf-lib's `drawLine`) — 8 segments x 2 Slots = 16 strokes,
  // and nothing else on this content-free page (no Slot has a Source) would
  // emit a stroke operator, so this count is unambiguous.
  const strokeCount = text.split(/\s+/).filter((tok) => tok === 'S').length;
  assert.equal(strokeCount, 16);
});

// --- Phase 10 Print Aids (§16) -----------------------------------------------
// Same content-stream-decoding approach as the crop-marks/rotation tests
// above, factored into one helper since every test below needs it.

async function getPageContentText(page) {
  const contents = page.node.normalizedEntries().Contents;
  let text = '';
  for (let i = 0; i < contents.size(); i += 1) {
    const stream = contents.lookup(i);
    const decoded = stream.getUnencodedContents ? stream.getUnencodedContents() : PDFLib.decodePDFRawStream(stream).decode();
    text += new TextDecoder('latin1').decode(decoded);
  }
  return text;
}

test('real pdf-lib: Bleed expands the Slot clip rect (the `re` operator args) by sizePt on every side (§16)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const realPng = buildMinimalPng();
  binaryStore.put('doc-img', realPng.buffer);
  const source = createSource({ id: 'src-img', kind: 'image', docId: 'doc-img', naturalWidth: 1, naturalHeight: 1 });
  const paper = createPaperSettings({ size: 'custom', customWidthPt: 200, customHeightPt: 200, marginTopPt: 0, marginBottomPt: 0, marginLeftPt: 0, marginRightPt: 0 });
  const slot = createSlot({ x: 0.25, y: 0.25, w: 0.5, h: 0.5, sourceId: 'src-img' });

  async function exportAndGetRectArgs(bleed) {
    const state = createAppState({ project: createProject({ bleed }), sources: [source], pages: [createPage({ paper, slots: [slot] })] });
    const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
    const reloaded = await PDFLib.PDFDocument.load(outBytes);
    const text = await getPageContentText(reloaded.getPage(0));
    const match = text.match(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/);
    return match.slice(1, 5).map(Number);
  }

  const withoutBleed = await exportAndGetRectArgs(createBleedSettings({ enabled: false }));
  const withBleed = await exportAndGetRectArgs(createBleedSettings({ enabled: true, sizePt: 5 }));
  // slot rect (200pt paper, x/y/w/h 0.25/0.25/0.5/0.5) = [50,50]-[150,150]
  assert.deepEqual(withoutBleed, [50, 50, 100, 100]);
  // bleed-expanded by 5pt on every side: x/y -5, w/h +10
  assert.deepEqual(withBleed, [45, 45, 110, 110]);
});

test('real pdf-lib: Header/Footer draws real selectable text via the high-level drawText path (§16)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    project: createProject({ headerFooter: createHeaderFooterSettings({ header: { enabled: true, text: 'CONFIDENTIAL', align: 'left' }, footer: { enabled: true, text: 'Acme Inc', align: 'right' } }) }),
    sources: [],
    pages: [createPage()],
  });
  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const text = await getPageContentText(reloaded.getPage(0));
  assert.ok(/\bTj\b/.test(text), `expected a text-showing operator, got: ${text.slice(0, 400)}`);
  // 2 separate drawText() calls (header + footer) -> 2 BT...ET runs
  assert.equal((text.match(/\bBT\b/g) ?? []).length, 2);
});

test('real pdf-lib: Page Number formats "{page} / {total}" per-page and draws it (§16)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    project: createProject({ pageNumber: createPageNumberSettings({ enabled: true, position: 'bottom-center' }) }),
    sources: [],
    pages: [createPage(), createPage(), createPage()],
  });
  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);

  // Independently encode the expected strings with a throwaway embedded
  // font, exactly the way export.js's own drawAnchoredText()/pdf-lib's
  // drawText() do internally, so this checks the ACTUAL glyph content, not
  // just "some text was drawn somewhere".
  const probeDoc = await PDFLib.PDFDocument.create();
  const probeFont = await probeDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 0; i < 3; i += 1) {
    const text = await getPageContentText(reloaded.getPage(i));
    const expectedHex = probeFont.encodeText(`${i + 1} / 3`).toString().replace(/[()<>]/g, '');
    assert.ok(text.toUpperCase().includes(expectedHex.toUpperCase()), `page ${i + 1}: expected hex "${expectedHex}" in content, got: ${text.slice(0, 400)}`);
  }
});

test('real pdf-lib: a rotated Text Box draws via the low-level matrix path (non-identity `cm`, real text operators) (§16)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const box = createTextBox({ text: 'Draft', rotationDeg: 90, bold: true, align: 'center', x: 0.1, y: 0.1, w: 0.3, h: 0.1 });
  const state = createAppState({ sources: [], pages: [createPage({ textBoxes: [box] })] });
  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const text = await getPageContentText(reloaded.getPage(0));
  assert.ok(/\bTj\b/.test(text), `expected a text-showing operator, got: ${text.slice(0, 400)}`);
  // the `cm` matrix for a 90 degree rotation must NOT be the identity/axis-
  // aligned [1 0 0 1 ...] shape — a real rotation changes the b/c components.
  const cmMatch = text.match(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) [-\d.]+ [-\d.]+ cm/);
  assert.ok(cmMatch, 'expected a cm operator');
  const [, a, b] = cmMatch.slice(0, 3).map(Number);
  assert.ok(Math.abs(b) > 0.9, `expected a real rotation (b close to +/-1 for 90deg), got a=${a} b=${b}`);
  // bold=true must select the Bold font resource, not the same registration Helvetica (regular) uses elsewhere
  const fontDict = reloaded.getPage(0).node.Resources().lookup(PDFLib.PDFName.of('Font'));
  const fontRefs = fontDict.entries().map(([, ref]) => reloaded.context.lookup(ref));
  assert.ok(fontRefs.some((f) => f.dict.get(PDFLib.PDFName.of('BaseFont')).toString().includes('Bold')));
});

test('real pdf-lib: a text Watermark draws with the requested opacity via a real ExtGState (§16)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const state = createAppState({
    project: createProject({ watermark: createWatermarkSettings({ enabled: true, type: 'text', text: 'COPY', opacity: 0.4, rotationDeg: -45 }) }),
    sources: [],
    pages: [createPage()],
  });
  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const extGState = reloaded.getPage(0).node.Resources().lookup(PDFLib.PDFName.of('ExtGState'));
  assert.ok(extGState, 'expected an ExtGState resource for the watermark opacity');
  const [, gsRef] = extGState.entries()[0];
  const gsDict = reloaded.context.lookup(gsRef);
  assert.equal(gsDict.get(PDFLib.PDFName.of('ca')).asNumber(), 0.4);
  const text = await getPageContentText(reloaded.getPage(0));
  assert.ok(/\bgs\b/.test(text), 'expected a gs (set graphics state) operator referencing the ExtGState');
});

test('real pdf-lib: an SVG Source is rasterized via deps.rasterizeSvgToPng and embeds as a real PNG XObject (§14/§14.5, Phase 10)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const svgBytes = new TextEncoder().encode('<svg width="10" height="10" xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" fill="red"/></svg>').buffer;
  binaryStore.put('doc-svg', svgBytes);
  const svgSource = createSource({ id: 'src-svg', kind: 'svg', docId: 'doc-svg', naturalWidth: 10, naturalHeight: 10 });
  const slot = createSlot({ x: 0, y: 0, w: 1, h: 1, sourceId: 'src-svg' });
  const state = createAppState({ sources: [svgSource], pages: [createPage({ slots: [slot] })] });

  const realPng = buildMinimalPng();
  const rasterizeSvgToPng = async () => realPng; // stands in for the browser-only Canvas rasterization (render-adapters.js, verified live)

  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib, rasterizeSvgToPng });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const xObjects = reloaded.getPage(0).node.Resources().lookup(PDFLib.PDFName.of('XObject'));
  assert.equal(xObjects.entries().length, 1);
  const text = await getPageContentText(reloaded.getPage(0));
  assert.ok(/\bDo\b/.test(text), 'expected a Do (draw XObject) operator');
});

test('real pdf-lib: an image Watermark embeds the Source image and draws it via the low-level XObject path (§16)', { skip }, async () => {
  const binaryStore = createBinaryStore();
  const realPng = buildMinimalPng();
  binaryStore.put('doc-wm', realPng.buffer);
  const wmSource = createSource({ id: 'src-wm', kind: 'image', docId: 'doc-wm', naturalWidth: 1, naturalHeight: 1 });
  const state = createAppState({
    project: createProject({ watermark: createWatermarkSettings({ enabled: true, type: 'image', imageSourceId: 'src-wm', opacity: 1 }) }),
    sources: [wmSource],
    pages: [createPage()],
  });
  const outBytes = await exportProjectToPdf(state, { binaryStore, pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(outBytes);
  const xObjects = reloaded.getPage(0).node.Resources().lookup(PDFLib.PDFName.of('XObject'));
  assert.equal(xObjects.entries().length, 1);
  const text = await getPageContentText(reloaded.getPage(0));
  assert.ok(/\bDo\b/.test(text), 'expected a Do (draw XObject) operator');
});

// Minimal valid 1x1 black RGB PNG, hand-assembled (no npm image library
// needed) — signature + IHDR + IDAT(zlib-deflated raw scanline) + IEND,
// each chunk with a correct CRC32, so real embedPng() (which validates the
// PNG structure) accepts it.
function buildMinimalPng() {
  const crcTable = (() => {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  })();
  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }
  function chunk(type, data) {
    const typeBytes = new TextEncoder().encode(type);
    const len = new Uint8Array(4);
    new DataView(len.buffer).setUint32(0, data.length);
    const crcInput = new Uint8Array([...typeBytes, ...data]);
    const crc = new Uint8Array(4);
    new DataView(crc.buffer).setUint32(0, crc32(crcInput));
    return new Uint8Array([...len, ...typeBytes, ...data, ...crc]);
  }
  // zlib stream wrapping one uncompressed DEFLATE block containing the
  // single scanline: filter-byte 0 + one black RGB pixel (0,0,0).
  const raw = new Uint8Array([0, 0, 0, 0]); // filter=0, R=0,G=0,B=0
  const deflateStored = new Uint8Array([
    0x01, // BFINAL=1, BTYPE=00 (stored)
    raw.length, 0x00, // LEN (little-endian)
    (~raw.length) & 0xff, 0xff, // NLEN
    ...raw,
  ]);
  const adler = adler32(raw);
  const zlibStream = new Uint8Array([0x78, 0x01, ...deflateStored, ...adler]);

  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, 1); // width
  dv.setUint32(4, 1); // height
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return new Uint8Array([
    ...signature,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibStream),
    ...chunk('IEND', new Uint8Array(0)),
  ]);
}

function adler32(bytes) {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, ((b << 16) | a) >>> 0);
  return out;
}
