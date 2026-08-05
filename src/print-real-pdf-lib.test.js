// §15.3 Print Calibration Page — byte-level checks against the REAL pdf-lib,
// mirroring export-real-pdf-lib.test.js's guard pattern (same vendor fetch,
// same reasoning: pdf-lib runs fine in plain Node, see decision_log D-015).

import test from 'node:test';
import assert from 'node:assert/strict';
import { PAPER_SIZES_PT } from './geometry.js';
import { exportCalibrationPagePdf, CALIBRATION_SQUARE_SIZE_PT } from './print.js';

let PDFLib = null;
try {
  PDFLib = await import('../vendor/pdf-lib/pdf-lib.esm.js');
} catch {
  PDFLib = null;
}

const skip = PDFLib ? false : 'vendor/pdf-lib not fetched — run scripts/fetch-vendor.sh first';

test('real pdf-lib: the calibration page is a single A4 page', { skip }, async () => {
  const bytes = await exportCalibrationPagePdf({ pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(bytes);
  assert.equal(reloaded.getPageCount(), 1);
  const box = reloaded.getPage(0).getMediaBox();
  assert.equal(box.width, PAPER_SIZES_PT.A4.width);
  assert.equal(box.height, PAPER_SIZES_PT.A4.height);
});

test('real pdf-lib: the drawn calibration square measures EXACTLY 100mm x 100mm in the actual output content stream (§23.6.1)', { skip }, async () => {
  const bytes = await exportCalibrationPagePdf({ pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(bytes);
  const contents = reloaded.getPage(0).node.normalizedEntries().Contents;
  let text = '';
  for (let i = 0; i < contents.size(); i += 1) {
    const stream = contents.lookup(i);
    const decoded = stream.getUnencodedContents ? stream.getUnencodedContents() : PDFLib.decodePDFRawStream(stream).decode();
    text += new TextDecoder('latin1').decode(decoded);
  }
  // drawRectangle() draws the path as translate(x,y) (a separate `cm` line)
  // + a LOCAL (0,0)..(w,h) "0 0 m / 0 h l / w h l / w 0 l / h" path — the
  // ONLY subpath in this whole page that starts at local (0,0) and closes
  // with `h` (the 22 tick-mark lines, drawn via drawLine(), never close a
  // path) — so anchoring on that exact shape isolates the square's own
  // path from the surrounding ticks, whose lineTo coordinates otherwise
  // collide with this regex if matched too loosely.
  const rectPathMatch = text.match(/0 0 m\s+([\d.-]+) ([\d.-]+) l\s+([\d.-]+) ([\d.-]+) l\s+([\d.-]+) ([\d.-]+) l\s+h/);
  assert.ok(rectPathMatch, `expected the square's own "0 0 m / l / l / l / h" path, got: ${text}`);
  // Path is (0,0) -> (0,H) -> (W,H) -> (W,0): captures are [x1,y1(H), x2(W),y2(H), x3(W),y3(0)].
  const [x1, height, width, y2, x3, y3] = rectPathMatch.slice(1).map(Number);
  assert.ok(Math.abs(width - CALIBRATION_SQUARE_SIZE_PT) < 0.01, `expected square width ${CALIBRATION_SQUARE_SIZE_PT}pt (100mm), got ${width}`);
  assert.ok(Math.abs(height - CALIBRATION_SQUARE_SIZE_PT) < 0.01, `expected square height ${CALIBRATION_SQUARE_SIZE_PT}pt (100mm), got ${height}`);
  assert.equal(x1, 0, 'first lineTo must stay on the left edge (x=0)');
  assert.equal(y2, height, 'second lineTo y must match the first (top edge, constant y)');
  assert.equal(x3, width, 'third lineTo x must match the second (right edge, constant x)');
  assert.equal(y3, 0, 'third lineTo must return to the bottom edge (y=0)');

  // §16's border stroke + the 22 tick-mark strokes = 23 total `S` operators.
  const strokeCount = text.split(/\s+/).filter((tok) => tok === 'S').length;
  assert.equal(strokeCount, 23);
});

test('real pdf-lib: the calibration page text is embedded as real selectable text, not rasterized (ASCII-only per D-017)', { skip }, async () => {
  const bytes = await exportCalibrationPagePdf({ pdfLib: PDFLib });
  const reloaded = await PDFLib.PDFDocument.load(bytes);
  const contents = reloaded.getPage(0).node.normalizedEntries().Contents;
  let text = '';
  for (let i = 0; i < contents.size(); i += 1) {
    const stream = contents.lookup(i);
    const decoded = stream.getUnencodedContents ? stream.getUnencodedContents() : PDFLib.decodePDFRawStream(stream).decode();
    text += new TextDecoder('latin1').decode(decoded);
  }
  assert.ok(/\bTj\b|\bTJ\b/.test(text), `expected a text-showing operator, got: ${text.slice(0, 400)}`);
});
