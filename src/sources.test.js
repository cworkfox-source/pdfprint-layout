import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSourceEngine,
  createRenderQueue,
  computeThumbnailSize,
  computePreviewCanvasSize,
  computeImagePreviewSize,
  THUMBNAIL_LONG_EDGE_PX,
} from './sources.js';
import { createBinaryStore, isArrayBufferDetached } from './binary-store.js';

// --- pure sizing helpers --------------------------------------------------

test('computeThumbnailSize fits the long edge to the target, preserving aspect ratio', () => {
  assert.deepEqual(computeThumbnailSize(800, 400, 200), { width: 200, height: 100 });
  assert.deepEqual(computeThumbnailSize(400, 800, 200), { width: 100, height: 200 });
  assert.deepEqual(computeThumbnailSize(200, 200, 200), { width: 200, height: 200 });
});

test('computeThumbnailSize rejects non-positive dimensions', () => {
  assert.throws(() => computeThumbnailSize(0, 100, 200));
  assert.throws(() => computeThumbnailSize(100, -1, 200));
});

test('computePreviewCanvasSize scales pt at 150 DPI (150/72) when under the cap', () => {
  const size = computePreviewCanvasSize(595.276, 841.89); // A4
  assert.equal(size.width, Math.round(595.276 * (150 / 72)));
  assert.equal(size.height, Math.round(841.89 * (150 / 72)));
  assert.ok(Math.max(size.width, size.height) <= 4096);
});

test('computePreviewCanvasSize clamps to maxLongEdgePx for a huge page', () => {
  const size = computePreviewCanvasSize(10000, 5000, { maxLongEdgePx: 4096 });
  assert.equal(Math.max(size.width, size.height), 4096);
  assert.equal(size.width, 4096);
  assert.equal(size.height, 2048);
});

test('computeImagePreviewSize leaves a small image at its native pixel size (no DPI upscale)', () => {
  assert.deepEqual(computeImagePreviewSize(800, 600), { width: 800, height: 600 });
});

test('computeImagePreviewSize caps a huge image at maxLongEdgePx, preserving aspect ratio', () => {
  const size = computeImagePreviewSize(10000, 5000, { maxLongEdgePx: 4096 });
  assert.equal(size.width, 4096);
  assert.equal(size.height, 2048);
});

test('computeImagePreviewSize rejects non-positive dimensions', () => {
  assert.throws(() => computeImagePreviewSize(0, 100));
  assert.throws(() => computeImagePreviewSize(100, -1));
});

// --- render queue (§12.5 concurrency cap) --------------------------------

test('createRenderQueue runs at most maxConcurrent tasks at once, queues the rest', async () => {
  const queue = createRenderQueue(3);
  const deferreds = Array.from({ length: 5 }, () => {
    let resolve;
    const promise = new Promise((r) => { resolve = r; });
    return { promise, resolve };
  });

  const running = deferreds.map((d, i) => queue.run(() => d.promise.then(() => i)));

  // give microtasks a tick to let the queue start the first batch
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(queue.activeCount(), 3);
  assert.equal(queue.queuedCount(), 2);

  deferreds[0].resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(queue.activeCount(), 3); // 4th task started once a slot freed
  assert.equal(queue.queuedCount(), 1);

  deferreds[1].resolve();
  deferreds[2].resolve();
  deferreds[3].resolve();
  deferreds[4].resolve();
  const results = await Promise.all(running);
  assert.deepEqual(results, [0, 1, 2, 3, 4]);
  assert.equal(queue.activeCount(), 0);
  assert.equal(queue.queuedCount(), 0);
});

test('createRenderQueue rejects a non-positive maxConcurrent', () => {
  assert.throws(() => createRenderQueue(0));
});

// --- fakes for Source Engine tests ---------------------------------------

function makeFakePdfjsLib(pages) {
  const destroyedDocIds = [];
  let callIndex = 0;
  return {
    destroyedDocIds,
    getDocument({ data }) {
      const id = callIndex++;
      // Simulate the real transfer-to-Worker detach (§12.3's hazard) so
      // tests can assert the ORIGINAL buffer in SourceBinaryStore survives.
      try {
        structuredClone(data, { transfer: [data] });
      } catch {
        /* engines without structuredClone transfer: skip, other assertions still hold */
      }
      const pdfDoc = {
        numPages: pages.length,
        async getPage(n) {
          const p = pages[n - 1];
          return { view: p.view, rotate: p.rotate ?? 0 };
        },
      };
      return {
        promise: Promise.resolve(pdfDoc),
        async destroy() {
          destroyedDocIds.push(id);
        },
      };
    },
  };
}

function makeThumbnailSpy(prefix = 'thumb') {
  const released = [];
  const calls = [];
  const render = async ({ page, targetLongEdgePx }) => {
    calls.push({ page, targetLongEdgePx });
    const url = `blob:${prefix}-${calls.length}`;
    return { url, width: targetLongEdgePx, height: targetLongEdgePx, release: () => released.push(url) };
  };
  return { render, calls, released };
}

function makePdfFile(bytes = new Uint8Array([1, 2, 3, 4]).buffer) {
  return new File([bytes], 'drawing.pdf', { type: 'application/pdf' });
}

// --- loadPdfFile -----------------------------------------------------------

test('loadPdfFile creates one Source per page, all pages by default', async () => {
  const pdfjsLib = makeFakePdfjsLib([
    { view: [0, 0, 595.276, 841.89], rotate: 0 }, // A4
    { view: [0, 0, 841.89, 1190.551], rotate: 0 }, // A3
  ]);
  const thumb = makeThumbnailSpy();
  const engine = createSourceEngine({
    binaryStore: createBinaryStore(),
    renderPdfPageThumbnail: thumb.render,
  });

  const sources = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  assert.equal(sources.length, 2);
  assert.equal(sources[0].kind, 'pdf-page');
  assert.equal(sources[0].pageIndex, 0);
  assert.equal(sources[1].pageIndex, 1);
  assert.equal(sources[0].fileName, 'drawing.pdf');
  assert.ok(sources[0].docId);
  assert.equal(sources[0].docId, sources[1].docId); // one file -> shared docId
  // §17.1 — one hash per FILE, shared by every page-Source from it.
  assert.match(sources[0].contentHash, /^[0-9a-f]{64}$/);
  assert.equal(sources[0].contentHash, sources[1].contentHash);

  await engine.waitForAllThumbnails();
  assert.equal(thumb.calls.length, 2);
  const cachedThumb = engine.getThumbnail(sources[0].id);
  assert.equal(cachedThumb.url, 'blob:thumb-1');
  assert.equal(cachedThumb.width, THUMBNAIL_LONG_EDGE_PX);
  assert.equal(cachedThumb.height, THUMBNAIL_LONG_EDGE_PX);
});

test('loadPdfFile respects an explicit page range', async () => {
  const pdfjsLib = makeFakePdfjsLib([
    { view: [0, 0, 100, 100] },
    { view: [0, 0, 100, 100] },
    { view: [0, 0, 100, 100] },
  ]);
  const thumb = makeThumbnailSpy();
  const engine = createSourceEngine({ binaryStore: createBinaryStore(), renderPdfPageThumbnail: thumb.render });

  const sources = await engine.loadPdfFile(makePdfFile(), { pdfjsLib, pageRange: '1,3' });
  assert.deepEqual(sources.map((s) => s.pageIndex), [0, 2]);
});

test('§14.3 — naturalWidth/Height swap for /Rotate 90, and pageRotate is recorded separately', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 595.276, 841.89], rotate: 90 }]);
  const thumb = makeThumbnailSpy();
  const engine = createSourceEngine({ binaryStore: createBinaryStore(), renderPdfPageThumbnail: thumb.render });

  const [source] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  assert.equal(source.pageRotate, 90);
  assert.equal(source.naturalWidth, 841.89); // swapped: "as the user sees it" (§14.3)
  assert.equal(source.naturalHeight, 595.276);
});

test('§12.3 — SourceBinaryStore keeps the pristine original even though the PDF.js copy gets detached', async () => {
  const originalBytes = new Uint8Array([9, 8, 7, 6, 5]);
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const binaryStore = createBinaryStore();
  const engine = createSourceEngine({ binaryStore, renderPdfPageThumbnail: thumb.render });

  const [source] = await engine.loadPdfFile(makePdfFile(originalBytes.buffer.slice(0)), { pdfjsLib });
  const stored = binaryStore.get(source.docId);
  assert.equal(isArrayBufferDetached(stored), false);
  assert.deepEqual([...new Uint8Array(stored)], [9, 8, 7, 6, 5]);
});

test('loadPdfFile throws without pdfjsLib or without a thumbnail renderer configured', async () => {
  const engine = createSourceEngine({ binaryStore: createBinaryStore() });
  await assert.rejects(() => engine.loadPdfFile(makePdfFile(), {}));

  const engineNoThumb = createSourceEngine({ binaryStore: createBinaryStore() });
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  await assert.rejects(() => engineNoThumb.loadPdfFile(makePdfFile(), { pdfjsLib }));
});

// --- releaseSource / §12.6 memory release ---------------------------------

test('releaseSource releases the cached thumbnail immediately', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const engine = createSourceEngine({ binaryStore: createBinaryStore(), renderPdfPageThumbnail: thumb.render });

  const [source] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  await engine.waitForAllThumbnails();
  assert.ok(engine.getThumbnail(source.id));

  await engine.releaseSource(source);
  assert.equal(engine.getThumbnail(source.id), null);
  assert.deepEqual(thumb.released, ['blob:thumb-1']);
});

test('releaseSource only tears down the shared doc once the LAST page-Source for it is released', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }, { view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const binaryStore = createBinaryStore();
  const engine = createSourceEngine({ binaryStore, renderPdfPageThumbnail: thumb.render });

  const [page1, page2] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  await engine.waitForAllThumbnails();
  assert.equal(binaryStore.has(page1.docId), true);

  await engine.releaseSource(page1);
  assert.equal(binaryStore.has(page1.docId), true, 'bytes must survive while page2 still references them');
  assert.equal(pdfjsLib.destroyedDocIds.length, 0);

  await engine.releaseSource(page2);
  assert.equal(binaryStore.has(page1.docId), false);
  assert.equal(pdfjsLib.destroyedDocIds.length, 1);
});

test('releaseAllSources clears every cache entry and every open doc', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }, { view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const binaryStore = createBinaryStore();
  const engine = createSourceEngine({ binaryStore, renderPdfPageThumbnail: thumb.render });

  const sources = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  await engine.waitForAllThumbnails();

  await engine.releaseAllSources(sources);
  assert.equal(binaryStore.size(), 0);
  assert.equal(pdfjsLib.destroyedDocIds.length, 1);
  assert.equal(thumb.released.length, 2);
});

// --- loadImageFile -----------------------------------------------------------

test('loadImageFile creates one Source, stores original bytes, and renders a thumbnail', async () => {
  const decodeImage = async () => ({ width: 800, height: 600, bitmap: { close: () => {} } });
  const rendered = [];
  const renderImageThumbnail = async ({ decoded, targetLongEdgePx }) => {
    rendered.push({ decoded, targetLongEdgePx });
    return { url: 'blob:img-1', width: targetLongEdgePx, height: Math.round((targetLongEdgePx * 600) / 800), release: () => {} };
  };
  const binaryStore = createBinaryStore();
  const engine = createSourceEngine({ binaryStore, decodeImage, renderImageThumbnail });

  const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });
  const source = await engine.loadImageFile(file);

  assert.equal(source.kind, 'image');
  assert.equal(source.naturalWidth, 800);
  assert.equal(source.naturalHeight, 600);
  assert.equal(binaryStore.size(), 1);
  assert.ok(binaryStore.has(source.docId));
  assert.match(source.contentHash, /^[0-9a-f]{64}$/);

  await engine.waitForThumbnail(source.id);
  assert.equal(rendered.length, 1);
  assert.deepEqual(engine.getThumbnail(source.id).url, 'blob:img-1');
});

test('loadImageFile throws without decodeImage/renderImageThumbnail configured', async () => {
  const engine = createSourceEngine({ binaryStore: createBinaryStore() });
  const file = new File([new Uint8Array([1])], 'x.png');
  await assert.rejects(() => engine.loadImageFile(file));
});

// --- ensurePreview / §12.7 mid-resolution Canvas Preview tier (Phase 5) ------

function makePreviewSpy(prefix = 'preview') {
  const released = [];
  const calls = [];
  const render = async (args) => {
    calls.push(args);
    const url = `blob:${prefix}-${calls.length}`;
    return { url, width: 999, height: 999, release: () => released.push(url) };
  };
  return { render, calls, released };
}

test('ensurePreview lazily renders a pdf-page Source on first call, then serves the cached entry', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const preview = makePreviewSpy();
  const engine = createSourceEngine({
    binaryStore: createBinaryStore(),
    renderPdfPageThumbnail: thumb.render,
    renderPdfPagePreview: preview.render,
  });

  const [source] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  assert.equal(engine.getPreview(source.id), null); // not rendered yet — lazy

  const result = await engine.ensurePreview(source);
  assert.equal(result.url, 'blob:preview-1');
  assert.equal(preview.calls.length, 1);
  assert.equal(engine.getPreview(source.id).url, 'blob:preview-1');

  // second call serves the cache, doesn't render again
  await engine.ensurePreview(source);
  assert.equal(preview.calls.length, 1);
});

test('ensurePreview dedupes concurrent calls for the same Source into one render', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const preview = makePreviewSpy();
  const engine = createSourceEngine({
    binaryStore: createBinaryStore(),
    renderPdfPageThumbnail: thumb.render,
    renderPdfPagePreview: preview.render,
  });

  const [source] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  const [a, b] = await Promise.all([engine.ensurePreview(source), engine.ensurePreview(source)]);
  assert.equal(preview.calls.length, 1);
  assert.equal(a.url, b.url);
});

test('ensurePreview renders an image Source from SourceBinaryStore bytes (not the transient decode bitmap)', async () => {
  const decodeImage = async () => ({ width: 800, height: 600, bitmap: { close: () => {} } });
  const thumb = makeThumbnailSpy();
  const renderImageThumbnail = async ({ targetLongEdgePx }) => ({ url: 'blob:thumb', width: targetLongEdgePx, height: targetLongEdgePx, release: () => {} });
  const preview = makePreviewSpy();
  const binaryStore = createBinaryStore();
  const engine = createSourceEngine({
    binaryStore, decodeImage, renderImageThumbnail, renderImagePreview: preview.render,
  });

  const file = new File([new Uint8Array([1, 2, 3])], 'photo.png', { type: 'image/png' });
  const source = await engine.loadImageFile(file);

  const result = await engine.ensurePreview(source);
  assert.equal(result.url, 'blob:preview-1');
  assert.equal(preview.calls[0].naturalWidth, 800);
  assert.equal(preview.calls[0].naturalHeight, 600);
  assert.ok(preview.calls[0].bytes); // the ORIGINAL bytes, not the closed decode bitmap
});

test('ensurePreview throws when the required renderer dep is missing for that Source kind', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const engine = createSourceEngine({ binaryStore: createBinaryStore(), renderPdfPageThumbnail: thumb.render });
  const [source] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  assert.throws(() => engine.ensurePreview(source), /renderPdfPagePreview/);
});

test('releaseSource also releases a cached preview', async () => {
  const pdfjsLib = makeFakePdfjsLib([{ view: [0, 0, 100, 100] }]);
  const thumb = makeThumbnailSpy();
  const preview = makePreviewSpy();
  const engine = createSourceEngine({
    binaryStore: createBinaryStore(),
    renderPdfPageThumbnail: thumb.render,
    renderPdfPagePreview: preview.render,
  });

  const [source] = await engine.loadPdfFile(makePdfFile(), { pdfjsLib });
  await engine.ensurePreview(source);
  await engine.releaseSource(source);

  assert.equal(engine.getPreview(source.id), null);
  assert.deepEqual(preview.released, ['blob:preview-1']);
});
