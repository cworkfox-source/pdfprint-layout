// Browser-only rendering glue for the Source Engine (docs/plan.md §12.5 /
// §12.6). These are the concrete implementations of the `deps.render*` /
// `deps.decodeImage` functions createSourceEngine() (sources.js) expects —
// kept in a separate file for the same reason preview.js splits pure math
// from DOM adapters (§4.1): everything below touches Canvas/PDF.js/URL
// APIs that don't exist in the Node test runner, so it is verified live in
// a browser instead of node:test. Contains NO orchestration logic (no
// caching, no concurrency limiting, no docId bookkeeping) — that all stays
// in sources.js, which is unit-testable.

import { computeThumbnailSize, computePreviewCanvasSize, computeImagePreviewSize, computeSvgRasterSize } from './sources.js';

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

// deps.renderPdfPagePreview for createSourceEngine() — Phase 5's §12.7
// mid-resolution "Canvas Preview" tier. Same shape as
// renderPdfPageThumbnail() above (re-fetching a viewport at the size
// computePreviewCanvasSize() picks instead of computeThumbnailSize()'s), so
// it also re-`page.cleanup()`s afterward — this is a lazily-rendered,
// LRU-cached, on-demand render, not something kept hot.
export async function renderPdfPagePreview({ page, targetDpi, maxLongEdgePx }) {
  const viewportAtScale1 = page.getViewport({ scale: 1 });
  const { width: targetW } = computePreviewCanvasSize(
    viewportAtScale1.width,
    viewportAtScale1.height,
    { targetDpi, maxLongEdgePx },
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
  page.cleanup();

  return { url, width: canvas.width, height: canvas.height, release };
}

// deps.renderImagePreview for createSourceEngine(). Unlike the PDF path
// above, there is no still-open "page" to re-fetch for an image — the
// decoded ImageBitmap from loadImageFile() is transient and already closed
// once its thumbnail is drawn (render-adapters' own renderImageThumbnail,
// below) — so this re-decodes from the pristine bytes SourceBinaryStore
// still holds (image decode does not detach/transfer, unlike PDF.js; see
// decodeImage()'s own comment). Sized via computeImagePreviewSize() (a
// plain maxLongEdgePx cap), NOT computePreviewCanvasSize()'s DPI target —
// naturalWidth/Height here are pixels, not pt (see decision_log D-012).
export async function renderImagePreview({ bytes, naturalWidth, naturalHeight, maxLongEdgePx }) {
  const blob = new Blob([bytes]);
  const bitmap = await createImageBitmap(blob);
  const { width: targetW, height: targetH } = computeImagePreviewSize(naturalWidth, naturalHeight, { maxLongEdgePx });

  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close();

  const url = await canvasToObjectUrl(canvas);
  const release = releaseCanvasThumbnail(canvas, url);

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

// --- SVG (§12/§14, Phase 10) -------------------------------------------
// SVG has no bitmap to decode the way createImageBitmap() gives one for a
// raster image — every tier here (thumbnail/preview/export raster) goes
// through the SAME rasterizeSvg() helper (an <img> load + canvas draw at
// the TARGET resolution directly, since a vector has no "native pixels" to
// downscale FROM the way an over-large PNG would).

// deps.decodeSvgText for createSourceEngine() — just the file's own text;
// parseSvgIntrinsicSize() (sources.js) does the actual width/height parsing.
export async function decodeSvgText(file) {
  return file.text();
}

async function rasterizeSvg(bytes, targetWidthPx, targetHeightPx) {
  const blob = new Blob([bytes], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('rasterizeSvg: the browser could not decode this file as an SVG image'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = targetWidthPx;
    canvas.height = targetHeightPx;
    canvas.getContext('2d').drawImage(img, 0, 0, targetWidthPx, targetHeightPx);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// deps.renderSvgThumbnail for createSourceEngine().
export async function renderSvgThumbnail({ bytes, naturalWidth, naturalHeight, targetLongEdgePx }) {
  const { width: targetW, height: targetH } = computeThumbnailSize(naturalWidth, naturalHeight, targetLongEdgePx);
  const canvas = await rasterizeSvg(bytes, targetW, targetH);
  const url = await canvasToObjectUrl(canvas);
  const release = releaseCanvasThumbnail(canvas, url);
  return { url, width: canvas.width, height: canvas.height, release };
}

// deps.renderSvgPreview for createSourceEngine() — Phase 5's §12.7 tier,
// sized via computeImagePreviewSize() (a maxLongEdgePx cap), same
// convention renderImagePreview() uses for images (not a DPI target — an
// SVG rasterized for on-screen preview doesn't need print resolution; only
// the EXPORT-time rasterization below does).
export async function renderSvgPreview({ bytes, naturalWidth, naturalHeight, maxLongEdgePx }) {
  const { width: targetW, height: targetH } = computeImagePreviewSize(naturalWidth, naturalHeight, { maxLongEdgePx });
  const canvas = await rasterizeSvg(bytes, targetW, targetH);
  const url = await canvasToObjectUrl(canvas);
  const release = releaseCanvasThumbnail(canvas, url);
  return { url, width: canvas.width, height: canvas.height, release };
}

// deps.rasterizeSvgToPng for export.js's embedSource() — pdf-lib cannot
// embed SVG directly (§14 table), so this rasterizes at print resolution
// (computeSvgRasterSize(), sources.js) and hands back PNG bytes for
// outDoc.embedPng(), the same "transcode to a format pdf-lib can embed"
// role transcodeWebpToPng() plays for WEBP images (§14.5) — just for a
// vector format pdf-lib has no embed path for at all, rather than an
// unsupported raster encoding.
export async function rasterizeSvgToPng(bytes, naturalWidth, naturalHeight) {
  const { width: targetW, height: targetH } = computeSvgRasterSize(naturalWidth, naturalHeight);
  const canvas = await rasterizeSvg(bytes, targetW, targetH);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => {
      if (!b) { reject(new Error('rasterizeSvgToPng: canvas.toBlob() returned null')); return; }
      resolve(b);
    }, 'image/png');
  });
  return new Uint8Array(await blob.arrayBuffer());
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
