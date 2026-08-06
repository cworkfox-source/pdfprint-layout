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
// computeContentHash (§17.1) is a converged Web Crypto call, same as
// `file.arrayBuffer()` a few lines below — called directly rather than
// injected, for the same reason: it needs no environment-specific fake to
// be Node-testable (decision_log D-018).
import { computeContentHash } from './hash.js';

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
// mid-resolution Canvas Preview a placed Slot uses (Phase 5 — a Source
// becomes "目前使用中的頁面" §12.5 the moment it's assigned to a Slot, at
// which point ensurePreview() below lazily renders into this tier).
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

// Image sources (unlike PDF pages) store PIXEL naturalWidth/naturalHeight —
// `loadImageFile()` below assigns `createImageBitmap()`'s own width/height
// directly, with no pt conversion, because a raster image has no inherent
// physical size the way a PDF page's MediaBox does. A DPI target (the
// targetDpi/72 scale computePreviewCanvasSize() above applies) is therefore
// meaningless here — an image's Canvas Preview tier is just its native
// resolution capped at maxLongEdgePx, never upscaled past what the file
// actually contains. See decision_log D-012.
export function computeImagePreviewSize(
  naturalWidth,
  naturalHeight,
  { maxLongEdgePx = PREVIEW_CANVAS_MAX_LONG_EDGE_PX } = {},
) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    throw new Error(`computeImagePreviewSize requires positive dimensions, got ${naturalWidth}x${naturalHeight}`);
  }
  const longEdge = Math.max(naturalWidth, naturalHeight);
  if (longEdge <= maxLongEdgePx) {
    return { width: Math.round(naturalWidth), height: Math.round(naturalHeight) };
  }
  const scale = maxLongEdgePx / longEdge;
  return { width: Math.round(naturalWidth * scale), height: Math.round(naturalHeight * scale) };
}

// --- SVG intrinsic size / raster sizing (§12, Phase 10) --------------------
// SVG (§14 table: "pdf-lib 不支援 embed SVG —— 需光柵化") has no inherent
// pixel bitmap the way an <img> decode gives one — its own "natural size" is
// read from the root <svg> element's width/height (with unit conversion to
// CSS px at 96dpi, matching browser default) or, failing that, its viewBox,
// or finally the SVG spec's own 300x150 fallback when neither is present.
// Regex-based (not a DOMParser) so this stays plain-string, Node-testable
// pure logic — no DOM needed just to read two attributes off a root tag.

const SVG_LENGTH_PX_PER_UNIT = Object.freeze({
  px: 1, in: 96, cm: 96 / 2.54, mm: 96 / 25.4, pt: 96 / 72, pc: 16,
});

function parseSvgLength(str) {
  if (!str) return null;
  const m = str.trim().match(/^([\d.]+)\s*(px|mm|cm|in|pt|pc)?$/i);
  if (!m) return null;
  const unit = (m[2] ?? 'px').toLowerCase();
  return parseFloat(m[1]) * SVG_LENGTH_PX_PER_UNIT[unit];
}

export function parseSvgIntrinsicSize(svgText) {
  const rootMatch = svgText.match(/<svg\b[^>]*>/i);
  if (!rootMatch) throw new Error('parseSvgIntrinsicSize: no <svg> root element found');
  const root = rootMatch[0];

  const width = parseSvgLength(root.match(/\bwidth="([^"]*)"/i)?.[1]);
  const height = parseSvgLength(root.match(/\bheight="([^"]*)"/i)?.[1]);
  if (width && height) return { width, height };

  const viewBoxAttr = root.match(/\bviewBox="([^"]*)"/i)?.[1];
  if (viewBoxAttr) {
    const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: width ?? parts[2], height: height ?? parts[3] };
    }
  }

  return { width: width ?? 300, height: height ?? 150 }; // SVG spec's own default intrinsic size
}

// Export-time raster resolution: `scale`x the intrinsic size (print quality
// headroom for a vector source, unlike a fixed-resolution raster image),
// capped at `maxLongEdgePx` so a huge or absurdly-scaled SVG can't blow up
// memory. Phase 10 judgment call (decision_log D-019) — plan.md gives no
// numbers for this.
export const SVG_RASTER_SCALE = 4;
export const SVG_RASTER_MAX_LONG_EDGE_PX = 3000;

export function computeSvgRasterSize(
  naturalWidth,
  naturalHeight,
  { scale = SVG_RASTER_SCALE, maxLongEdgePx = SVG_RASTER_MAX_LONG_EDGE_PX } = {},
) {
  if (!(naturalWidth > 0) || !(naturalHeight > 0)) {
    throw new Error(`computeSvgRasterSize requires positive dimensions, got ${naturalWidth}x${naturalHeight}`);
  }
  let width = naturalWidth * scale;
  let height = naturalHeight * scale;
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
    renderPdfPagePreview, // async ({ page, targetDpi, maxLongEdgePx }) => { url, width, height, release }
    renderImagePreview, // async ({ bytes, naturalWidth, naturalHeight, maxLongEdgePx }) => { url, width, height, release }
    decodeSvgText, // async (file) => svgText (Phase 10, §12/§14)
    renderSvgThumbnail, // async ({ bytes, naturalWidth, naturalHeight, targetLongEdgePx }) => { url, width, height, release }
    renderSvgPreview, // async ({ bytes, naturalWidth, naturalHeight, maxLongEdgePx }) => { url, width, height, release }
    onThumbnailReady, // (sourceId, { url, width, height }) => void
    onThumbnailError, // (sourceId, error) => void
  } = deps;

  if (!binaryStore) throw new Error('createSourceEngine requires deps.binaryStore');

  const renderQueue = createRenderQueue(maxConcurrentRenders);
  const openPdfDocs = new Map(); // docId -> { pdfDoc, loadingTask }
  const docRefCounts = new Map(); // docId -> number of live Sources referencing it
  const pendingThumbnailJobs = new Map(); // sourceId -> Promise
  const pendingPreviewJobs = new Map(); // sourceId -> Promise

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

  function enqueuePreview(sourceId, task) {
    const job = renderQueue
      .run(task)
      .then((result) => {
        previewCache.set(sourceId, result);
        return result;
      })
      .finally(() => {
        pendingPreviewJobs.delete(sourceId);
      });
    pendingPreviewJobs.set(sourceId, job);
    return job;
  }

  function getPreview(sourceId) {
    return previewCache.get(sourceId) ?? null;
  }

  // Phase 5 — lazily renders (and LRU-caches) the §12.7 mid-resolution
  // "Canvas Preview" tier for one Source, the first time it's actually
  // needed (a Slot gets it assigned; §12.5's "只 render 目前使用中的頁面").
  // Shares `renderQueue` with thumbnails, per §12.5's single concurrency cap
  // across all render work, not one cap per tier.
  function ensurePreview(source) {
    const cached = previewCache.get(source.id);
    if (cached) return Promise.resolve(cached);
    const pending = pendingPreviewJobs.get(source.id);
    if (pending) return pending;

    if (source.kind === 'pdf-page') {
      if (!renderPdfPagePreview) throw new Error('createSourceEngine requires deps.renderPdfPagePreview for pdf-page sources');
      const open = openPdfDocs.get(source.docId);
      if (!open) throw new Error(`ensurePreview: no open PDF document for docId ${source.docId}`);
      return enqueuePreview(source.id, async () => {
        const page = await open.pdfDoc.getPage(source.pageIndex + 1);
        return renderPdfPagePreview({
          page,
          targetDpi: PREVIEW_CANVAS_TARGET_DPI,
          maxLongEdgePx: PREVIEW_CANVAS_MAX_LONG_EDGE_PX,
        });
      });
    }

    if (source.kind === 'image') {
      if (!renderImagePreview) throw new Error('createSourceEngine requires deps.renderImagePreview for image sources');
      const bytes = binaryStore.get(source.docId);
      if (!bytes) throw new Error(`ensurePreview: no original bytes for docId ${source.docId}`);
      return enqueuePreview(source.id, () => renderImagePreview({
        bytes,
        naturalWidth: source.naturalWidth,
        naturalHeight: source.naturalHeight,
        maxLongEdgePx: PREVIEW_CANVAS_MAX_LONG_EDGE_PX,
      }));
    }

    if (source.kind === 'svg') {
      if (!renderSvgPreview) throw new Error('createSourceEngine requires deps.renderSvgPreview for svg sources');
      const bytes = binaryStore.get(source.docId);
      if (!bytes) throw new Error(`ensurePreview: no original bytes for docId ${source.docId}`);
      return enqueuePreview(source.id, () => renderSvgPreview({
        bytes,
        naturalWidth: source.naturalWidth,
        naturalHeight: source.naturalHeight,
        maxLongEdgePx: PREVIEW_CANVAS_MAX_LONG_EDGE_PX,
      }));
    }

    // blank/color/text (§5.2): no rendered content to preview (yet).
    return Promise.resolve(null);
  }

  function waitForPreview(sourceId) {
    return pendingPreviewJobs.get(sourceId) ?? Promise.resolve(getPreview(sourceId));
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
    // §17.1 — one hash per FILE (docId), not per page; every page-Source
    // sharing this docId gets the same value below.
    const contentHash = await computeContentHash(originalBuffer);

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
        contentHash,
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
    const contentHash = await computeContentHash(originalBuffer);

    const decoded = await decodeImage(file);
    const source = createSource({
      kind: 'image',
      fileName,
      naturalWidth: decoded.width,
      naturalHeight: decoded.height,
      docId,
      contentHash,
    });
    retainDoc(docId);
    enqueueThumbnail(source.id, () =>
      renderImageThumbnail({ decoded, targetLongEdgePx: THUMBNAIL_LONG_EDGE_PX }),
    );

    return source;
  }

  // §12.1/§14 — loads a single SVG file as one Source (kind: 'svg'). Unlike
  // loadImageFile(), there's no bitmap decode step — naturalWidth/Height
  // come from parseSvgIntrinsicSize() reading the file's own <svg> root
  // tag, and thumbnail rendering is a RASTERIZE (Canvas + <img>) rather than
  // a straight decode, since SVG is vector (§14 table: "pdf-lib 不支援
  // embed SVG —— 需光柵化", the same reason export.js's embedSource()
  // rasterizes it again at Export time, independently, at print resolution).
  async function loadSvgFile(file) {
    if (!decodeSvgText) throw new Error('createSourceEngine requires deps.decodeSvgText for svg sources');
    if (!renderSvgThumbnail) throw new Error('createSourceEngine requires deps.renderSvgThumbnail for svg sources');

    const fileName = file.name ?? 'unknown.svg';
    const originalBuffer = await file.arrayBuffer();
    const docId = makeDocId();
    binaryStore.put(docId, originalBuffer);
    const contentHash = await computeContentHash(originalBuffer);

    const svgText = await decodeSvgText(file);
    const { width, height } = parseSvgIntrinsicSize(svgText);
    const source = createSource({
      kind: 'svg',
      fileName,
      naturalWidth: width,
      naturalHeight: height,
      docId,
      contentHash,
    });
    retainDoc(docId);
    enqueueThumbnail(source.id, () =>
      renderSvgThumbnail({ bytes: originalBuffer, naturalWidth: width, naturalHeight: height, targetLongEdgePx: THUMBNAIL_LONG_EDGE_PX }),
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
    loadSvgFile,
    getThumbnail,
    waitForThumbnail,
    waitForAllThumbnails,
    getPreview,
    ensurePreview,
    waitForPreview,
    releaseSource,
    releaseAllSources,
    // exposed for tests/dev-harness introspection, not part of the "public API" surface
    _internal: { renderQueue, openPdfDocs, docRefCounts, thumbnailCache, previewCache },
  };
}
