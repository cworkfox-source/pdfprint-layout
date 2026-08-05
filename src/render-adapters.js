// Browser-only rendering glue for the Source Engine (docs/plan.md §12.5 /
// §12.6). These are the concrete implementations of the `deps.render*` /
// `deps.decodeImage` functions createSourceEngine() (sources.js) expects —
// kept in a separate file for the same reason preview.js splits pure math
// from DOM adapters (§4.1): everything below touches Canvas/PDF.js/URL
// APIs that don't exist in the Node test runner, so it is verified live in
// a browser instead of node:test. Contains NO orchestration logic (no
// caching, no concurrency limiting, no docId bookkeeping) — that all stays
// in sources.js, which is unit-testable.

import { computeThumbnailSize } from './sources.js';

function canvasToObjectUrl(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('canvas.toBlob() returned null (0x0 canvas or unsupported format)'));
        return;
      }
      resolve(URL.createObjectURL(blob));
    });
  });
}

// §12.6 — releasing a rendered thumbnail must free the canvas (set 0x0,
// per plan's explicit wording, not just drop the reference) and revoke its
// object URL.
function releaseCanvasThumbnail(canvas, url) {
  return () => {
    URL.revokeObjectURL(url);
    canvas.width = 0;
    canvas.height = 0;
  };
}

// deps.renderPdfPageThumbnail for createSourceEngine(). `page` is a PDF.js
// PDFPageProxy already fetched by sources.js (so this function never calls
// pdfDoc.getPage() itself — that stays in the orchestration layer).
export async function renderPdfPageThumbnail({ page, targetLongEdgePx }) {
  const viewportAtScale1 = page.getViewport({ scale: 1 }); // reflects /Rotate already (§14.3)
  const { width: targetW } = computeThumbnailSize(
    viewportAtScale1.width,
    viewportAtScale1.height,
    targetLongEdgePx,
  );
  const scale = targetW / viewportAtScale1.width;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;

  const url = await canvasToObjectUrl(canvas);
  const release = releaseCanvasThumbnail(canvas, url);
  // §13.4 — PDF.js is preview/thumbnail-only; §12.6 frees the decoded page
  // resources right after use while leaving the parent document (and thus
  // sibling pages / future re-renders) alive.
  page.cleanup();

  return { url, width: canvas.width, height: canvas.height, release };
}

// deps.decodeImage for createSourceEngine(). Takes the raw File directly —
// unlike PDF.js, image decoding does not detach/transfer the underlying
// bytes, so there's no need to route it through SourceBinaryStore's
// copy-for-worker mechanism (that's specifically the §12.3 PDF.js hazard).
export async function decodeImage(file) {
  const bitmap = await createImageBitmap(file);
  return { width: bitmap.width, height: bitmap.height, bitmap };
}

// deps.renderImageThumbnail for createSourceEngine().
export async function renderImageThumbnail({ decoded, targetLongEdgePx }) {
  const { width: targetW, height: targetH } = computeThumbnailSize(decoded.width, decoded.height, targetLongEdgePx);

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(decoded.bitmap, 0, 0, targetW, targetH);

  const url = await canvasToObjectUrl(canvas);
  const releaseCanvas = releaseCanvasThumbnail(canvas, url);
  const release = () => {
    releaseCanvas();
    decoded.bitmap.close?.();
  };

  return { url, width: canvas.width, height: canvas.height, release };
}
