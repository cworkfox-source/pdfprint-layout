// Source Engine (docs/plan.md §12, Phase 2). Orchestrates PDF/image
// loading, per-page Source creation, the §12.3 bytes-retention rule, and
// the §12.5 render-concurrency / cache thresholds.
//
// Everything that touches PDF.js/Canvas/Image decoding is INJECTED
// (`deps.renderPdfPageThumbnail`, `deps.decodeImage`, ...) rather than
// called directly, so the orchestration logic here — page-range
// resolution, docId/bytes bookkeeping, concurrency limiting, cache
// wiring, release/ref-counting — is unit-testable in plain Node with fake
// implementations of those deps. The real Canvas/PDF.js-touching
// implementations live in render-adapters.js and are only exercised live
// in a browser (mirrors the preview.js pure-math/DOM-adapter split, §4.1).

import { createSource } from './model.js';
import { normalizeSourceDimensions } from './geometry.js';
import { parsePageRange } from './page-range.js';
import { createLruCache } from './lru-cache.js';

// §12.5 thresholds — named here so both the engine defaults and tests
// reference the one place these numbers live, per plan.md's table.
export const THUMBNAIL_LONG_EDGE_PX = 200;
export const THUMBNAIL_CACHE_LIMIT = 300;
export const PREVIEW_CANVAS_TARGET_DPI = 150;
export const PREVIEW_CANVAS_MAX_LONG_EDGE_PX = 4096;
export const PREVIEW_CACHE_LIMIT = 60;
export const MAX_CONCURRENT_RENDERS = 3;

// --- Pure sizing helpers (§12.5) ----------------------------------------

// Fit `naturalWidth × naturalHeight` so its long edge equals targetLongEdgePx.
export function computeThumbnailSize(naturalWidth, naturalHeight, targetLongEdgePx = THUMBNAIL_LONG_EDGE_PX) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    throw new Error(`computeThumbnailSize requires positive dimensions, got ${naturalWidth}x${naturalHeight}`);
  }
  const longEdge = Math.max(naturalWidth, naturalHeight);
  const scale = targetLongEdgePx / longEdge;
  return {
    width: Math.max(1, Math.round(naturalWidth * scale)),
    height: Math.max(1, Math.round(naturalHeight * scale)),
  };
}

// 150 DPI target, capped so the long edge never exceeds 4096px, for the
// mid-resolution Canvas Preview a placed Slot uses (populated starting
// whichever later phase actually draws Sources onto the paper canvas —
// Phase 2 only stands the cache up, see PREVIEW_CACHE_LIMIT usage below).
export function computePreviewCanvasSize(
  naturalWidthPt,
  naturalHeightPt,
  { targetDpi = PREVIEW_CANVAS_TARGET_DPI, maxLongEdgePx = PREVIEW_CANVAS_MAX_LONG_EDGE_PX } = {},
) {
  if (!(naturalWidthPt > 0) || !(naturalHeightPt > 0)) {
    throw new Error(`computePreviewCanvasSize requires positive dimensions, got ${naturalWidthPt}x${naturalHeightPt}`);
  }
  const scale = targetDpi / 72;
  let width = naturalWidthPt * scale;
  let height = naturalHeightPt * scale;
  const longEdge = Math.max(width, height);
  if (longEdge > maxLongEdgePx) {
    const clamp = maxLongEdgePx / longEdge;
    width *= clamp;
    height *= clamp;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

// --- Concurrency-limited render queue (§12.5 "同時進行的 render 工作最多 3 個") --

export function createRenderQueue(maxConcurrent = MAX_CONCURRENT_RENDERS) {
  if (!Number.isInteger(maxConcurrent) || maxConcurrent <= 0) {
    throw new Error(`createRenderQueue requires a positive integer maxConcurrent, got ${maxConcurrent}`);
  }
  let active = 0;
  const pending = [];

  function drain() {
    while (active < maxConcurrent && pending.length > 0) {
      pending.shift()();
    }
  }

  function run(task) {
    return new Promise((resolve, reject) => {
      const attempt = () => {
        active += 1;
        Promise.resolve()
          .then(task)
          .then(
            (result) => {
              active -= 1;
              drain();
              resolve(result);
            },
            (err) => {
              active -= 1;
              drain();
              reject(err);
            },
          );
      };
      if (active < maxConcurrent) attempt();
      else pending.push(attempt);
    });
  }

  return {
    run,
    activeCount: () => active,
    queuedCount: () => pending.length,
  };
}

function makeDocId() {
  return `doc-${crypto.randomUUID()}`;
}

// --- Source Engine --------------------------------------------------------

export function createSourceEngine(deps = {}) {
  const {
    binaryStore,
    thumbnailCache = createLruCache({
      limit: THUMBNAIL_CACHE_LIMIT,
      onEvict: (_id, entry) => entry?.release?.(),
    }),
    previewCache = createLruCache({
      limit: PREVIEW_CACHE_LIMIT,
      onEvict: (_id, entry) => entry?.release?.(),
    }),
    maxConcurrentRenders = MAX_CONCURRENT_RENDERS,
    renderPdfPageThumbnail, // async ({ page, targetLongEdgePx }) => { url, width, height, release }
    decodeImage, // async (file) => { width, height, bitmap }
    renderImageThumbnail, // async ({ decoded, targetLongEdgePx }) => { url, width, height, release }
    onThumbnailReady, // (sourceId, { url, width, height }) => void
    onThumbnailError, // (sourceId, error) => void
  } = deps;

  if (!binaryStore) throw new Error('createSourceEngine requires deps.binaryStore');

  const renderQueue = createRenderQueue(maxConcurrentRenders);
  const openPdfDocs = new Map(); // docId -> { pdfDoc, loadingTask }
  const docRefCounts = new Map(); // docId -> number of live Sources referencing it
  const pendingThumbnailJobs = new Map(); // sourceId -> Promise

  function retainDoc(docId) {
    docRefCounts.set(docId, (docRefCounts.get(docId) ?? 0) + 1);
  }

  function releaseDocRef(docId) {
    const remaining = (docRefCounts.get(docId) ?? 1) - 1;
    if (remaining > 0) {
      docRefCounts.set(docId, remaining);
      return;
    }
    docRefCounts.delete(docId);
    binaryStore.remove(docId);
    const open = openPdfDocs.get(docId);
    if (open) {
      openPdfDocs.delete(docId);
      // pdf.js v6: PDFDocumentProxy has no .destroy(); full teardown goes
      // through the loading task (decision_log D-008 / Known Issues).
      return open.loadingTask.destroy();
    }
    return undefined;
  }

  function enqueueThumbnail(sourceId, task) {
    const job = renderQueue
      .run(task)
      .then((result) => {
        thumbnailCache.set(sourceId, result);
        onThumbnailReady?.(sourceId, result);
        return result;
      })
      .catch((err) => {
        onThumbnailError?.(sourceId, err);
        throw err;
      })
      .finally(() => {
        pendingThumbnailJobs.delete(sourceId);
      });
    pendingThumbnailJobs.set(sourceId, job);
    return job;
  }

  // §12.1/§12.2 — loads a PDF file, creates one Source per selected page
  // (default: all pages), stores the ORIGINAL bytes once per file in
  // SourceBinaryStore, and hands PDF.js only a throwaway copy (§12.3).
  async function loadPdfFile(file, { pageRange = 'all', pdfjsLib } = {}) {
    if (!pdfjsLib) throw new Error('loadPdfFile requires opts.pdfjsLib');
    if (!renderPdfPageThumbnail) throw new Error('createSourceEngine requires deps.renderPdfPageThumbnail for PDF sources');

    const fileName = file.name ?? 'unknown.pdf';
    const originalBuffer = await file.arrayBuffer();
    const docId = makeDocId();
    binaryStore.put(docId, originalBuffer);

    const previewCopy = binaryStore.getCopyForPdfJs(docId);
    const loadingTask = pdfjsLib.getDocument({ data: previewCopy });
    const pdfDoc = await loadingTask.promise;
    openPdfDocs.set(docId, { pdfDoc, loadingTask });

    const pageIndices = parsePageRange(pageRange, pdfDoc.numPages);
    const sources = [];

    for (const pageIndex of pageIndices) {
      const page = await pdfDoc.getPage(pageIndex + 1); // pdf.js pages are 1-based
      const [x0, y0, x1, y1] = page.view; // already CropBox-resolved (§13.5)
      const rawWidth = x1 - x0;
      const rawHeight = y1 - y0;
      const rotate = page.rotate ?? 0;
      const { width, height } = normalizeSourceDimensions(rawWidth, rawHeight, rotate);
      // pdf.js's public page proxy only exposes this one already-resolved
      // box, not separate raw MediaBox/CropBox — Export (Phase 7) reads the
      // authoritative pair straight from pdf-lib against the
      // SourceBinaryStore original (§14.4), so this field is a Preview-time
      // convenience, not the Export source of truth.
      const box = { x: x0, y: y0, w: rawWidth, h: rawHeight };

      const source = createSource({
        kind: 'pdf-page',
        fileName,
        pageIndex,
        naturalWidth: width,
        naturalHeight: height,
        pageRotate: rotate,
        cropBox: box,
        mediaBox: box,
        docId,
      });
      sources.push(source);
      retainDoc(docId);
      enqueueThumbnail(source.id, () =>
        renderPdfPageThumbnail({ page, targetLongEdgePx: THUMBNAIL_LONG_EDGE_PX }),
      );
    }

    return sources;
  }

  // §12.1 — loads a single image file (PNG/JPG/WEBP) as one Source.
  async function loadImageFile(file) {
    if (!decodeImage) throw new Error('createSourceEngine requires deps.decodeImage for image sources');
    if (!renderImageThumbnail) throw new Error('createSourceEngine requires deps.renderImageThumbnail for image sources');

    const fileName = file.name ?? 'unknown';
    const originalBuffer = await file.arrayBuffer();
    const docId = makeDocId(); // 1:1 file-to-source, but still routed through the same store/ref-count machinery as PDFs
    binaryStore.put(docId, originalBuffer);

    const decoded = await decodeImage(file);
    const source = createSource({
      kind: 'image',
      fileName,
      naturalWidth: decoded.width,
      naturalHeight: decoded.height,
      docId,
    });
    retainDoc(docId);
    enqueueThumbnail(source.id, () =>
      renderImageThumbnail({ decoded, targetLongEdgePx: THUMBNAIL_LONG_EDGE_PX }),
    );

    return source;
  }

  function getThumbnail(sourceId) {
    return thumbnailCache.get(sourceId) ?? null;
  }

  function waitForThumbnail(sourceId) {
    return pendingThumbnailJobs.get(sourceId) ?? Promise.resolve(getThumbnail(sourceId));
  }

  function waitForAllThumbnails() {
    return Promise.allSettled(Array.from(pendingThumbnailJobs.values()));
  }

  // §12.6 — full memory release for one Source: drop its cached
  // thumbnail/preview (releasing their objectURL/canvas/bitmap), and once
  // the LAST Source referencing a docId is released, drop the original
  // bytes and tear down the PDF.js document.
  function releaseSource(source) {
    const cachedThumb = thumbnailCache.get(source.id);
    thumbnailCache.delete(source.id);
    cachedThumb?.release?.();

    const cachedPreview = previewCache.get(source.id);
    previewCache.delete(source.id);
    cachedPreview?.release?.();

    if (source.docId) {
      return releaseDocRef(source.docId);
    }
    return undefined;
  }

  // §23.5.3 — "delete all Sources" must bring memory back down near
  // baseline: evict every cache entry (running onEvict release for each)
  // and tear down every open PDF document.
  async function releaseAllSources(sources) {
    for (const source of sources) {
      // eslint-disable-next-line no-await-in-loop
      await releaseSource(source);
    }
    thumbnailCache.clear();
    previewCache.clear();
  }

  return {
    loadPdfFile,
    loadImageFile,
    getThumbnail,
    waitForThumbnail,
    waitForAllThumbnails,
    releaseSource,
    releaseAllSources,
    // exposed for tests/dev-harness introspection, not part of the "public API" surface
    _internal: { renderQueue, openPdfDocs, docRefCounts, thumbnailCache, previewCache },
  };
}
