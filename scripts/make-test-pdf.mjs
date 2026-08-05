// Zero-dependency synthetic PDF generator for manual/Phase-2 testing. No
// npm packages, no network — just hand-written PDF object syntax with the
// byte offsets computed as we go, so this repo never needs a committed
// binary test fixture (mirrors spike/fetch-vendor.sh's "reproduce, don't
// commit" approach for vendor/).
//
// Produces a 3-page PDF exercising the two things Phase 2 (Source Engine)
// must get right per plan.md:
//   - §12.4 mixed page sizes (A4 / A3) in one file
//   - §14.3 a page with /Rotate 90 (naturalWidth/Height must swap)
//
// Usage: node scripts/make-test-pdf.mjs [output-path]
import fs from 'node:fs';
import path from 'node:path';

const A4 = [595.276, 841.89];
const A3 = [841.89, 1190.551];

function contentStream(text, x, y) {
  return `BT /F1 24 Tf ${x} ${y} Td (${text}) Tj ET`;
}

function buildPdf() {
  const objects = []; // 1-based; objects[0] unused
  const pageObjNums = [3, 5, 7];

  const page = (num, contentsNum, [w, h], rotate) => {
    const rotateEntry = rotate ? ` /Rotate ${rotate}` : '';
    return `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}]${rotateEntry} /Resources << /Font << /F1 9 0 R >> >> /Contents ${contentsNum} 0 R >>`;
  };
  const stream = (text, x, y) => {
    const body = contentStream(text, x, y);
    return `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  };

  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageObjNums.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageObjNums.length} >>`;
  objects[3] = page(3, 4, A4, 0);
  objects[4] = stream('Page 1 - A4', 50, 700);
  objects[5] = page(5, 6, A3, 0);
  objects[6] = stream('Page 2 - A3', 50, 1100);
  objects[7] = page(7, 8, A4, 90);
  objects[8] = stream('Page 3 - Rotate90', 50, 700);
  objects[9] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const chunks = ['%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'];
  const offsets = [0]; // object 0 is the free-list head, not written
  let byteOffset = Buffer.byteLength(chunks[0], 'latin1');

  for (let n = 1; n < objects.length; n += 1) {
    offsets[n] = byteOffset;
    const objText = `${n} 0 obj\n${objects[n]}\nendobj\n`;
    chunks.push(objText);
    byteOffset += Buffer.byteLength(objText, 'latin1');
  }

  const xrefOffset = byteOffset;
  const count = objects.length; // objects.length === highest obj num + 1
  let xref = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let n = 1; n < count; n += 1) {
    xref += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`;
  }
  chunks.push(xref);

  const trailer = `trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  chunks.push(trailer);

  return Buffer.from(chunks.join(''), 'latin1');
}

const outPath = process.argv[2] ?? path.join(process.cwd(), 'fixtures', 'test-multi-page.pdf');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, buildPdf());
console.log(`Wrote ${outPath} (${fs.statSync(outPath).size} bytes)`);
