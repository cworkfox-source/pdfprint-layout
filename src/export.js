// Export Renderer (docs/plan.md §14, Phase 7). This file's PURE functions
// (no pdf-lib import at module scope — see the bottom section for the
// pdf-lib-dependent orchestration) compute exactly what Preview computes,
// just for Export's coordinate frame:
//
//   Preview (preview.js's computeSlotContentTransform):
//     - content nested as a DOM child of the already-positioned .pl-slot
//       box -> slotContentMatrix() called with slotX=slotY=0 (local origin)
//     - PDF page rendered by pdf.js, which already applies /Rotate itself,
//       so the bitmap IS "as the user sees it" -> rotation = slot.rotation
//       only, contentW/H = source.naturalWidth/Height (already /Rotate-
//       swapped, §14.3)
//
//   Export (this file):
//     - one flat output page, no nested "already positioned" container to
//       lean on -> slotContentMatrix() called with the Slot's REAL absolute
//       x/y (in pt, within the page's content area)
//     - pdf-lib's embedPage does NOT apply /Rotate (§14.2's most-cited
//       known limitation) -> the RAW embedded page is unrotated, so Export
//       must apply (slot.rotation + source.pageRotate) itself, against the
//       RAW (pre-swap) box dimensions (source.cropBox/mediaBox), not
//       naturalWidth/Height
//
// Both call the exact same geometry.js slotContentMatrix() (§4.3) — the
// ONLY difference between the two call sites is the origin parameter and,
// for pdf-page Sources specifically, which rotation/which dimensions feed
// in (documented above). See decision_log D-015 and the equivalence test
// (preview-export-equivalence.test.js, §23.3) that proves the two stay in
// sync for every fit/rotation/flip/offset/pageRotate combination.

import { resolvePaperSizePt } from './model.js';
import { computeContentAreaPt } from './preview.js';
import {
  roundPt,
  slotContentMatrix,
  modelYToPdfY,
  pdfPageFlipMatrix,
  multiply,
  scaleXY,
  effectiveBoundingBox,
  sortByZOrder,
} from './geometry.js';
import { computeCropMarksForSlot, cropMarkSegmentsToPdfSpace } from './print.js';

// §14.6 — output MediaBox is the paper size in pt, rounded to 3 decimals
// only at this PDF-writing boundary (geometry.js's own convention, §6.1).
export function roundedPaperSizePt(paper) {
  const { width, height } = resolvePaperSizePt(paper);
  return { width: roundPt(width), height: roundPt(height) };
}

// A Slot's Normalized rect (§5.3) converted to ABSOLUTE pt, within the
// page's content area — the Export-side sibling of preview.js's
// computeSlotPx(), just in pt instead of px and relative to the page's
// content area origin rather than (0,0).
export function computeSlotAbsoluteRectPt(slot, contentAreaPt) {
  return {
    x: contentAreaPt.x + slot.x * contentAreaPt.width,
    y: contentAreaPt.y + slot.y * contentAreaPt.height,
    w: slot.w * contentAreaPt.width,
    h: slot.h * contentAreaPt.height,
  };
}

// §14.3 — the "most common bug" plan.md warns about: pdf-lib's embedPage
// does NOT apply a source PDF page's own /Rotate, so Export must fold it
// into the SAME rotation slotContentMatrix() already applies for the
// user's own Slot-level rotation (§6.3) — a naive implementation that only
// applies slot.rotation would render a rotated scan sideways. The fit-scale
// axis-swap (§6.3, already implemented in computeFitScale) then correctly
// reacts to the COMBINED rotation, using the RAW (pre-/Rotate-swap) box
// dimensions the raw embedded page actually has — not the already-swapped
// naturalWidth/Height Preview uses (that swap only exists to make the
// PRE-ROTATED PREVIEW BITMAP's own reported size match what's on screen;
// the raw PDF-lib embed has no such pre-rotation).
export function computeContentRotationAndSize(source, slot) {
  if (source.kind === 'pdf-page') {
    const box = effectiveBoundingBox(source);
    return {
      rotation: ((slot.rotation + source.pageRotate) % 360 + 360) % 360,
      contentW: box.w,
      contentH: box.h,
    };
  }
  if (source.kind === 'image') {
    // No inherent source rotation for a raster image (§14.3 is PDF-page-
    // specific) — naturalWidth/Height are pixel dims either way (D-012).
    return { rotation: slot.rotation, contentW: source.naturalWidth, contentH: source.naturalHeight };
  }
  throw new Error(`computeContentRotationAndSize: unsupported source kind "${source.kind}" for Export`);
}

// The Export-side sibling of preview.js's computeSlotContentTransform(): the
// CONCEPTUAL matrix mapping content-local (Y-down, top-left origin — the
// SAME convention Preview's bitmap uses) to PDF page space (bottom-left
// origin, Y-up), via pdfPageFlipMatrix() (§6.2) composed in front of the
// model-space content matrix — so rotation/flip survive the Y-axis
// conversion correctly (unlike naively flipping just a translation
// component). This is the matrix compared against Preview's own in
// preview-export-equivalence.test.js (§23.3) — it deliberately does NOT
// know anything about pdf-lib's own XObject-drawing quirks; see
// computeXObjectDrawMatrix() below for the function that adds those.
export function computeExportContentMatrix(slot, source, slotAbsRectPt, paperHeightPt) {
  const { rotation, contentW, contentH } = computeContentRotationAndSize(source, slot);
  const modelMatrix = slotContentMatrix({
    slotX: slotAbsRectPt.x,
    slotY: slotAbsRectPt.y,
    slotW: slotAbsRectPt.w,
    slotH: slotAbsRectPt.h,
    contentW,
    contentH,
    fitMode: slot.fitMode,
    scale: slot.scale,
    rotation,
    offsetX: slot.offsetX,
    offsetY: slot.offsetY,
    flipX: slot.flipX,
    flipY: slot.flipY,
  });
  return multiply(pdfPageFlipMatrix(paperHeightPt), modelMatrix);
}

// The matrix ACTUALLY handed to pdf-lib's `concatTransformationMatrix()`
// (`cm`) before `drawObject()` (`Do`). Conceptually this places content at
// the exact same four corners computeExportContentMatrix() computes (and
// which the §23.3 equivalence test proves match Preview) — but pdf-lib's
// `Do` operator doesn't draw an object addressed by "content-local
// (0,0)..(contentW,contentH), Y-down" coordinates the way this project's
// own matrices assume; it draws whatever native coordinate frame the
// embedded XObject itself has, which is NEITHER of those things by default
// for either embedded kind this project uses:
//   - `embedPng`/`embedJpg`: the Image XObject natively occupies the UNIT
//     SQUARE [0,1]x[0,1] (pdf-lib's own high-level drawImage()/drawPage()
//     helpers scale that unit square up to the desired point size — they
//     never draw in "contentW x contentH" units directly), AND that unit
//     square's own q axis runs bottom(q=0) to top(q=1) — the SAME
//     handedness mismatch `embedPage` has (below), on top of the size
//     mismatch. Feeding computeExportContentMatrix()'s matrix straight to
//     `Do` without the size correction draws the image into a razor-thin
//     sliver near one corner (verified: for a 100x100 image stretched to
//     fill a 200x200 slot, the unscaled matrix only ever painted a 2x2pt
//     patch); with only the size correction and not the flip, the image
//     renders at the correct size but vertically mirrored (verified via a
//     quadrant-colored test image). Fix: compose `scaleXY(contentW,
//     contentH)` then `pdfPageFlipMatrix(contentH)` (same order as
//     embedPage's own correction, just with the rescale first) as the
//     INNERMOST steps.
//   - `embedPage`: the Form XObject's BBox already spans exactly
//     `contentW x contentH` (pdf-lib's `boundingBoxAdjustedMatrix` only
//     TRANSLATES, per its own source — see decision_log D-016), so no
//     rescale is needed there — but its coordinate frame is Y-UP,
//     bottom-left origin (literally the original PDF page's own native
//     space, untouched), the OPPOSITE handedness from what
//     slotContentMatrix()'s math assumes for its content-local input. Fix:
//     compose `pdfPageFlipMatrix(contentH)` — the SAME general "mirror a
//     box of height H" primitive already used for the outer page-level
//     flip, just parameterized by the content's own height instead of the
//     paper's — as the INNERMOST step, to convert that Y-up native content
//     into the Y-down convention slotContentMatrix()'s math expects before
//     its own transform pipeline runs.
// Both corrections were found and verified against pdf-lib's own reference
// high-level drawImage()/drawPage() helpers, re-rendered with real pdf.js —
// see decision_log D-016 for the full empirical trace. This is precisely
// WHY computeExportContentMatrix() above is kept free of these corrections
// (and why the equivalence test calls that function, not this one): the
// pure equivalence test could not have caught THIS class of bug on its own
// — it only proves Preview's and Export's OWN conceptual matrix math stay
// consistent with each other, not that either is correct against pdf-lib's
// real drawing semantics. Only a real pdf-lib + real pdf.js round-trip
// (dev/export.html's Playwright verification) could and did catch it.
export function computeXObjectDrawMatrix(slot, source, slotAbsRectPt, paperHeightPt) {
  const conceptualMatrix = computeExportContentMatrix(slot, source, slotAbsRectPt, paperHeightPt);
  const { contentW, contentH } = computeContentRotationAndSize(source, slot);
  if (source.kind === 'image') {
    return multiply(conceptualMatrix, multiply(pdfPageFlipMatrix(contentH), scaleXY(contentW, contentH)));
  }
  if (source.kind === 'pdf-page') {
    return multiply(conceptualMatrix, pdfPageFlipMatrix(contentH));
  }
  throw new Error(`computeXObjectDrawMatrix: unsupported source kind "${source.kind}" for Export`);
}

// §6.6 clip boundary, in PDF space. The Slot's own rect is NEVER rotated
// (only its content is, via slot.rotation) — so unlike the content matrix
// above, a plain modelYToPdfY() on this one axis-aligned rect is exactly
// right; no full-matrix flip is needed here.
export function computeExportClipRectPt(slotAbsRectPt, paperHeightPt) {
  return {
    x: slotAbsRectPt.x,
    y: modelYToPdfY(slotAbsRectPt.y, slotAbsRectPt.h, paperHeightPt),
    w: slotAbsRectPt.w,
    h: slotAbsRectPt.h,
  };
}

// §14.5 — sniffs the image FORMAT from its own magic bytes rather than
// trusting a filename extension (which can be missing, wrong, or renamed).
// pdf-lib can embed PNG/JPEG directly; WEBP needs the canvas-based
// transcode in deps.transcodeWebpToPng (browser-only, see
// render-adapters.js) before pdf-lib ever sees the bytes.
export function detectImageFormat(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length >= 2 && b[0] === 0xff && b[1] === 0xd8) return 'jpg';
  if (
    b.length >= 12
    && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 // 'RIFF'
    && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // 'WEBP'
  ) return 'webp';
  return 'unknown';
}

// --- pdf-lib-dependent orchestration --------------------------------------
// Nothing above this line imports pdf-lib. Everything below takes it as an
// injected dependency (`deps.pdfLib`, the imported PDFLib module namespace)
// instead — mirroring sources.js's deps-injection split (§4.1), so this
// file has no hard import of `vendor/pdf-lib` and stays loadable even
// before `scripts/fetch-vendor.sh` has been run. Unlike pdf.js, pdf-lib
// itself runs fine in plain Node (no Worker/DOM needed for its core API —
// verified directly against the vendored build), so export.test.js can and
// does exercise the REAL library for its most rigorous checks (see
// decision_log D-015) — the injection here is about keeping src/export.js
// itself dependency-free, not about pdf-lib needing a browser.

// §14.5 — embeds one Source exactly once; callers (exportProjectToPdf)
// memoize the result across Slots so a Source used 8 times only embeds once.
export async function embedSource(outDoc, source, binaryStore, deps) {
  const { pdfLib, transcodeWebpToPng } = deps;
  const originalBytes = binaryStore.get(source.docId);
  if (!originalBytes) {
    throw new Error(`embedSource: no original bytes in SourceBinaryStore for docId ${source.docId} (source ${source.id})`);
  }

  if (source.kind === 'pdf-page') {
    let srcDoc;
    try {
      srcDoc = await pdfLib.PDFDocument.load(originalBytes);
    } catch (err) {
      if (err instanceof pdfLib.EncryptedPDFError) {
        throw new Error(`來源 PDF 已加密,無法匯出(§14.2): ${source.fileName ?? source.docId}`);
      }
      throw err;
    }
    const srcPage = srcDoc.getPage(source.pageIndex);
    const box = effectiveBoundingBox(source); // §14.4 — CropBox (fallback MediaBox), same data Preview uses
    const boundingBox = { left: box.x, bottom: box.y, right: box.x + box.w, top: box.y + box.h };
    return outDoc.embedPage(srcPage, boundingBox);
  }

  if (source.kind === 'image') {
    const format = detectImageFormat(originalBytes);
    if (format === 'webp') {
      if (!transcodeWebpToPng) {
        throw new Error('embedSource: source is WEBP but no deps.transcodeWebpToPng was provided (§14.5)');
      }
      const pngBytes = await transcodeWebpToPng(originalBytes);
      return outDoc.embedPng(pngBytes);
    }
    if (format === 'jpg') return outDoc.embedJpg(originalBytes);
    if (format === 'png') return outDoc.embedPng(originalBytes);
    throw new Error(`embedSource: unrecognized image format for source ${source.id} (${source.fileName ?? 'unknown'})`);
  }

  throw new Error(`embedSource: unsupported source kind "${source.kind}" for Export`);
}

// §14.1's full pipeline. `state` is the AppState (§5.1: project/sources/
// pages); `deps.binaryStore` is the SourceBinaryStore (§12.3 — the ONLY
// place original bytes are read from, never re-derived from a cache);
// `deps.pdfLib` is the injected PDFLib namespace; `deps.transcodeWebpToPng`
// is optional (only needed if a WEBP image Source is actually used).
// Returns the output PDF as a Uint8Array.
export async function exportProjectToPdf(state, deps) {
  const { binaryStore, pdfLib } = deps;
  if (!binaryStore) throw new Error('exportProjectToPdf requires deps.binaryStore');
  if (!pdfLib) throw new Error('exportProjectToPdf requires deps.pdfLib');

  const sourcesById = new Map(state.sources.map((s) => [s.id, s]));
  const outDoc = await pdfLib.PDFDocument.create();
  // §14.6 — metadata limited to Producer + creation date; no user path or
  // system info, and no Author/Subject/Keywords derived from anything.
  outDoc.setProducer('pdfprint-layout');
  outDoc.setCreationDate(new Date());

  const embeddedBySourceId = new Map(); // §14.5 resource dedup

  for (const page of state.pages) {
    const paper = page.paper ?? state.project.paper;
    const { width, height } = roundedPaperSizePt(paper);
    const outPage = outDoc.addPage([width, height]);
    const contentAreaPt = computeContentAreaPt(paper);

    // §6.5 — Export MUST use the same draw order Preview does.
    for (const slot of sortByZOrder(page.slots)) {
      if (!slot.sourceId) continue;
      const source = sourcesById.get(slot.sourceId);
      if (!source) {
        throw new Error(`exportProjectToPdf: Slot ${slot.id} references unknown source ${slot.sourceId}`);
      }

      let embedded = embeddedBySourceId.get(slot.sourceId);
      if (!embedded) {
        // eslint-disable-next-line no-await-in-loop
        embedded = await embedSource(outDoc, source, binaryStore, deps);
        embeddedBySourceId.set(slot.sourceId, embedded);
      }

      const slotAbsRectPt = computeSlotAbsoluteRectPt(slot, contentAreaPt);
      const matrix = computeXObjectDrawMatrix(slot, source, slotAbsRectPt, height);
      const clipRectPt = computeExportClipRectPt(slotAbsRectPt, height);

      const xObjectKey = outPage.node.newXObject('Content', embedded.ref);
      outPage.pushOperators(
        pdfLib.pushGraphicsState(),
        pdfLib.rectangle(clipRectPt.x, clipRectPt.y, clipRectPt.w, clipRectPt.h),
        pdfLib.clip(),
        pdfLib.endPath(),
        pdfLib.concatTransformationMatrix(...matrix),
        pdfLib.drawObject(xObjectKey),
        pdfLib.popGraphicsState(),
      );
    }

    // §16 Crop Marks — drawn for EVERY Slot on the page (not just ones with
    // a Source), since these mark physical cut lines for the printed sheet
    // itself, independent of whether a given Slot has content yet (decision_
    // log D-017). Uses pdf-lib's high-level drawLine() rather than the raw
    // operators above: unlike XObject placement (computeXObjectDrawMatrix's
    // whole reason for existing), a straight, unrotated, axis-aligned line
    // has no matrix-decomposition ambiguity for drawLine() to get wrong.
    if (state.project.cropMarks?.enabled) {
      const { lineWidthPt } = state.project.cropMarks;
      for (const slot of page.slots) {
        const slotAbsRectPt = computeSlotAbsoluteRectPt(slot, contentAreaPt);
        const segments = cropMarkSegmentsToPdfSpace(computeCropMarksForSlot(slotAbsRectPt, state.project.cropMarks), height);
        for (const seg of segments) {
          outPage.drawLine({
            start: { x: seg.x1, y: seg.y1 },
            end: { x: seg.x2, y: seg.y2 },
            thickness: lineWidthPt,
            color: pdfLib.rgb(0, 0, 0),
          });
        }
      }
    }
  }

  return outDoc.save();
}
