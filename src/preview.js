// Preview Renderer (docs/plan.md §13, Phase 1 subset: §8 paper/margins, §42
// zoom, Canvas/DOM sizing). All the actual math — px sizing, zoom resolution,
// content-area rect — is DOM-free and unit-tested in preview.test.js; the
// DOM-touching functions here are thin adapters that only apply numbers
// geometry.js/this module already computed (§4.1: Layout Model vs DOM stay
// separate, so deleting the DOM and rebuilding it from state must be
// lossless).

import { resolvePaperSizePt } from './model.js';
import { sortByZOrder, slotContentMatrix } from './geometry.js';
import { computeCropMarksForSlot } from './print.js';
import {
  computeBleedExpandedRect,
  computeSafeAreaRect,
  computeHeaderFooterBandsPt,
  computeTextAnchorInBand,
  formatPageNumber,
  computePageNumberAnchorPt,
  computeWatermarkImageSizePt,
} from './print-aids.js';

// Preview-only convention: at zoom 1.0, 1pt = 1 CSS px. This is purely a
// Preview Renderer choice — Export (pdf-lib) never sees pixels, only pt
// (§6.1), so changing this later cannot affect exported output (§23.2.4).
export const PX_PER_PT_AT_ZOOM_1 = 1;

const NAMED_ZOOM_PRESETS = {
  '25%': 0.25,
  '50%': 0.5,
  '75%': 0.75,
  '100%': 1,
  '150%': 1.5,
  '200%': 2,
};

// §42 — resolves a zoom preset (named % or 'fit-page' / 'fit-width') plus a
// raw numeric zoom, against the container size actually available.
export function resolveZoom(preset, { containerWidthPx, containerHeightPx, paperWidthPt, paperHeightPt }) {
  if (typeof preset === 'number') {
    if (!(preset > 0)) throw new Error(`zoom must be a positive number, got ${preset}`);
    return preset;
  }
  if (preset in NAMED_ZOOM_PRESETS) {
    return NAMED_ZOOM_PRESETS[preset];
  }
  if (preset === 'fit-page') {
    const byWidth = containerWidthPx / (paperWidthPt * PX_PER_PT_AT_ZOOM_1);
    const byHeight = containerHeightPx / (paperHeightPt * PX_PER_PT_AT_ZOOM_1);
    return Math.min(byWidth, byHeight);
  }
  if (preset === 'fit-width') {
    return containerWidthPx / (paperWidthPt * PX_PER_PT_AT_ZOOM_1);
  }
  throw new Error(`Unknown zoom preset: ${preset}`);
}

// §8.3 — content area is the paper minus the four margins, in pt, BEFORE
// any zoom is applied. Slot normalized coordinates (§5.3) are relative to
// this rect, not the full paper.
export function computeContentAreaPt(paper) {
  const { width, height } = resolvePaperSizePt(paper);
  const x = paper.marginLeftPt;
  const y = paper.marginTopPt;
  const w = width - paper.marginLeftPt - paper.marginRightPt;
  const h = height - paper.marginTopPt - paper.marginBottomPt;
  if (w <= 0 || h <= 0) {
    throw new Error('Margins leave zero or negative content area');
  }
  return { x, y, width: w, height: h };
}

// Full Phase-1 layout: paper size + content area, in both pt and preview
// px at the given zoom. This is the one function both a Canvas-based and a
// DOM-based Preview implementation would call — §23.2's "A4 Canvas 比例正確"
// and "mm 計算正確" are properties of this function's output, not of
// whatever actually draws it.
export function computePaperPreviewLayout(paper, zoom) {
  const sizePt = resolvePaperSizePt(paper);
  const contentPt = computeContentAreaPt(paper);
  const pxPerPt = PX_PER_PT_AT_ZOOM_1 * zoom;

  return {
    zoom,
    paperPt: sizePt,
    contentAreaPt: contentPt,
    paperPx: {
      width: sizePt.width * pxPerPt,
      height: sizePt.height * pxPerPt,
    },
    contentAreaPx: {
      x: contentPt.x * pxPerPt,
      y: contentPt.y * pxPerPt,
      width: contentPt.width * pxPerPt,
      height: contentPt.height * pxPerPt,
    },
  };
}

// --- DOM adapters --------------------------------------------------------
// Thin on purpose: every number here already came from
// computePaperPreviewLayout(). No layout math belongs below this line.

export function renderPaper(container, layout) {
  let paperEl = container.querySelector(':scope > .pl-paper');
  if (!paperEl) {
    paperEl = document.createElement('div');
    paperEl.className = 'pl-paper';
    const contentEl = document.createElement('div');
    contentEl.className = 'pl-content-area';
    paperEl.appendChild(contentEl);
    container.appendChild(paperEl);
  }

  paperEl.style.position = 'relative';
  paperEl.style.width = `${layout.paperPx.width}px`;
  paperEl.style.height = `${layout.paperPx.height}px`;
  paperEl.style.background = '#fff';
  paperEl.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.2)';

  const contentEl = paperEl.querySelector(':scope > .pl-content-area');
  contentEl.style.position = 'absolute';
  contentEl.style.left = `${layout.contentAreaPx.x}px`;
  contentEl.style.top = `${layout.contentAreaPx.y}px`;
  contentEl.style.width = `${layout.contentAreaPx.width}px`;
  contentEl.style.height = `${layout.contentAreaPx.height}px`;
  contentEl.style.outline = '1px dashed rgba(0,100,255,0.6)';

  return paperEl;
}

// §13.1 — a Slot's Normalized rect (§5.3, 0..1 relative to the content
// area) converted to content-area-relative preview px. Pure so it's
// unit-testable without a DOM; Export will one day need the pt equivalent
// of this same idea, but that's a separate function per §4.3 (this one is
// Preview-only, px, and never consulted by Export).
export function computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx) {
  return {
    x: slot.x * contentAreaWidthPx,
    y: slot.y * contentAreaHeightPx,
    width: slot.w * contentAreaWidthPx,
    height: slot.h * contentAreaHeightPx,
  };
}

// DOM adapter: draws one outlined box per Slot inside the content-area
// element renderPaper() created. Rebuilds the `.pl-slot` children from
// scratch on every call rather than diffing — Phase 3/4 change the slot
// list wholesale often enough (new preset, split/merge) that reuse isn't
// worth the bookkeeping yet. Draw order follows §6.5's shared
// sortByZOrder() — the same function Export will use — not array order.
export function renderSlots(contentEl, slots, contentAreaWidthPx, contentAreaHeightPx) {
  for (const el of contentEl.querySelectorAll(':scope > .pl-slot')) el.remove();

  for (const slot of sortByZOrder(slots)) {
    const { x, y, width, height } = computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx);
    const el = document.createElement('div');
    el.className = 'pl-slot';
    el.dataset.slotId = slot.id;
    el.style.position = 'absolute';
    el.style.boxSizing = 'border-box';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.width = `${width}px`;
    el.style.height = `${height}px`;
    el.style.outline = '1px solid rgba(200,0,0,0.85)';
    el.style.background = 'rgba(200,0,0,0.05)';
    // §6.6 — Cover / any scale > fitScale overflows the Slot rect and MUST
    // be clipped to it; this is the one place that clip boundary is set, so
    // renderSlotContent() below never has to worry about it.
    el.style.overflow = 'hidden';
    contentEl.appendChild(el);
  }
  return contentEl;
}

// --- Crop Marks (§13.1/§16, Phase 8) --------------------------------------
// §13.1 [M] explicitly lists Crop Marks among what the Preview canvas must
// show, alongside Slots — this is the DOM-side twin of export.js's crop-mark
// drawing, reusing print.js's SAME computeCropMarksForSlot() (§4.3: one
// geometry function, two renderers) rather than a second implementation.
//
// Like computeSlotContentTransform() above (Phase 5, same judgment call,
// D-012/D-017), this works in coordinates LOCAL to the content-area element
// (computeSlotPx() already returns content-area-relative px, matching how
// renderSlots() positions each `.pl-slot`) rather than the page-absolute pt
// Export's computeSlotAbsoluteRectPt() uses — Preview's content-area `<div>`
// is already offset via renderPaper(), Export has no such nested container.
// computeCropMarksForSlot() itself is unit-agnostic (pure ratio/offset math),
// so passing it PX-converted length/gap alongside a PX slot rect yields PX
// segments directly — no separate "preview crop-mark geometry" function
// needed. Unlike Export' cropMarkSegmentsToPdfSpace(), no Y-flip applies
// here: Preview's own coordinate convention is already top-left/Y-down,
// the same as Model space, so nothing needs converting.
export function renderCropMarks(contentEl, slots, contentAreaWidthPx, contentAreaHeightPx, cropMarks, pxPerPt) {
  for (const el of contentEl.querySelectorAll(':scope > .pl-crop-mark')) el.remove();
  if (!cropMarks?.enabled) return;

  const lengthPx = cropMarks.lengthPt * pxPerPt;
  const gapPx = cropMarks.gapPt * pxPerPt;
  const thicknessPx = Math.max(1, cropMarks.lineWidthPt * pxPerPt);

  for (const slot of slots) {
    const slotPx = computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx);
    const segments = computeCropMarksForSlot(slotPx, { lengthPt: lengthPx, gapPt: gapPx });
    for (const seg of segments) {
      const el = document.createElement('div');
      el.className = 'pl-crop-mark';
      el.style.position = 'absolute';
      el.style.background = '#000';
      if (seg.x1 === seg.x2) {
        el.style.left = `${seg.x1 - thicknessPx / 2}px`;
        el.style.top = `${Math.min(seg.y1, seg.y2)}px`;
        el.style.width = `${thicknessPx}px`;
        el.style.height = `${Math.abs(seg.y2 - seg.y1)}px`;
      } else {
        el.style.left = `${Math.min(seg.x1, seg.x2)}px`;
        el.style.top = `${seg.y1 - thicknessPx / 2}px`;
        el.style.width = `${Math.abs(seg.x2 - seg.x1)}px`;
        el.style.height = `${thicknessPx}px`;
      }
      contentEl.appendChild(el);
    }
  }
}

// --- Source Placement (§10.1/§10.2/§6.6, Phase 5) -------------------------

// Pure half of drawing a Slot's placed content: the CSS transform matrix for
// an element sized exactly `contentWidthPx x contentHeightPx` (the content's
// OWN preview-resolution pixel size — e.g. a cached thumbnail/preview
// entry's width/height, not the Source's pt-based naturalWidth/Height) to
// sit correctly inside a Slot box of `slotWidthPx x slotHeightPx`.
//
// Calls geometry.js's slotContentMatrix() — the SAME function Export will
// use (§4.3) — with slotX/slotY pinned to 0 rather than the Slot's real
// content-area-relative position: this element is placed as a DOM CHILD of
// the already-positioned-and-clipped `.pl-slot` box renderSlots() creates,
// so its transform only needs to be relative to that box's own (0,0), not
// the outer content area's. Export (Phase 7) will call slotContentMatrix()
// again with the real absolute slotX/slotY, since pdf-lib draws onto one
// flat page with no nested "already positioned" container to lean on — same
// shared function, different origin parameter for each renderer's own
// coordinate frame, not a second implementation of the matrix itself.
export function computeSlotContentTransform(slot, contentWidthPx, contentHeightPx, slotWidthPx, slotHeightPx) {
  const matrix = slotContentMatrix({
    slotX: 0,
    slotY: 0,
    slotW: slotWidthPx,
    slotH: slotHeightPx,
    contentW: contentWidthPx,
    contentH: contentHeightPx,
    fitMode: slot.fitMode,
    scale: slot.scale,
    rotation: slot.rotation,
    offsetX: slot.offsetX,
    offsetY: slot.offsetY,
    flipX: slot.flipX,
    flipY: slot.flipY,
  });
  return { matrix, width: contentWidthPx, height: contentHeightPx };
}

// DOM adapter: draws (or removes) one Slot's placed content as an <img>
// inside the `.pl-slot` element renderSlots() created for it. `content` is
// `{ url, width, height } | null` — typically a Source Engine thumbnail or
// §12.7 mid-res preview cache entry; `null` (no Source assigned, or its
// preview hasn't rendered yet) removes any existing content element.
// `slotWidthPx`/`slotHeightPx` are passed in explicitly (from
// computeSlotPx(), the same values renderSlots() itself used) rather than
// read back off the DOM, so this stays a pure "apply already-computed
// numbers" step per the file's own §4.1 convention.
export function renderSlotContent(slotEl, slot, content, slotWidthPx, slotHeightPx) {
  let contentEl = slotEl.querySelector(':scope > .pl-slot-content');
  if (!content) {
    if (contentEl) contentEl.remove();
    return null;
  }
  if (!contentEl) {
    contentEl = document.createElement('img');
    contentEl.className = 'pl-slot-content';
    contentEl.style.position = 'absolute';
    contentEl.style.left = '0';
    contentEl.style.top = '0';
    contentEl.style.transformOrigin = '0 0';
    slotEl.appendChild(contentEl);
  }
  if (contentEl.src !== content.url) contentEl.src = content.url;

  const { matrix, width, height } = computeSlotContentTransform(slot, content.width, content.height, slotWidthPx, slotHeightPx);
  contentEl.style.width = `${width}px`;
  contentEl.style.height = `${height}px`;
  contentEl.style.transform = `matrix(${matrix.join(',')})`;
  return contentEl;
}

// §35/§36 — the ONE place `@page size` is set, so the browser's native
// print dialog reproduces the same paper size Preview/Export use. mm here
// only because CSS @page doesn't accept `pt` reliably across browsers;
// convert right at this boundary, not anywhere else.
export function applyPrintPageSize(paperWidthPt, paperHeightPt, doc = document) {
  const mm = (pt) => (pt / 72) * 25.4;
  let styleEl = doc.getElementById('pl-print-page-size');
  if (!styleEl) {
    styleEl = doc.createElement('style');
    styleEl.id = 'pl-print-page-size';
    doc.head.appendChild(styleEl);
  }
  styleEl.textContent = `@page { size: ${mm(paperWidthPt).toFixed(2)}mm ${mm(paperHeightPt).toFixed(2)}mm; margin: 0; }`;
  return styleEl;
}

// --- Print Aids (§16, Phase 10) ---------------------------------------------
// DOM adapters only — every rect/anchor below comes from print-aids.js's
// pure, UNIT-AGNOSTIC functions (§4.3), called here with PX instead of the
// PT Export uses; nothing here recomputes that geometry itself.

// computeSlotPx() (§13.1, Phase 1) returns `{x,y,width,height}`, but every
// print-aids.js rect function uses `{x,y,w,h}` (matching export.js's
// computeSlotAbsoluteRectPt convention) — this converts between the two so
// callers below don't silently feed `undefined` width/height into the pure
// math (caught live in the dev harness: guides rendered with NaN position).
function slotPxToWH(slotPx) {
  return { x: slotPx.x, y: slotPx.y, w: slotPx.width, h: slotPx.height };
}

// §16 Bleed guide — PREVIEW-ONLY visual aid (the actual clip expansion is
// Export's job, export.js's computeBleedClipRectPt). One dashed outline per
// Slot at its Bleed-expanded rect.
export function renderBleedGuide(contentEl, slots, contentAreaWidthPx, contentAreaHeightPx, bleed, pxPerPt) {
  for (const el of contentEl.querySelectorAll(':scope > .pl-bleed-guide')) el.remove();
  if (!bleed?.enabled) return;
  const bleedPx = bleed.sizePt * pxPerPt;
  for (const slot of slots) {
    const rect = computeBleedExpandedRect(slotPxToWH(computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx)), bleedPx);
    const el = document.createElement('div');
    el.className = 'pl-bleed-guide';
    el.style.position = 'absolute';
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
    el.style.outline = '1px dashed rgba(255,140,0,0.9)';
    el.style.pointerEvents = 'none';
    contentEl.appendChild(el);
  }
}

// §16 Safe Area guide — same PREVIEW-ONLY convention, inset instead of
// expanded. Never has an export.js counterpart to stay geometrically in
// sync with (§16: "僅畫面預覽，不列印、不匯出" — there is nothing to match).
export function renderSafeAreaGuide(contentEl, slots, contentAreaWidthPx, contentAreaHeightPx, safeArea, pxPerPt) {
  for (const el of contentEl.querySelectorAll(':scope > .pl-safe-area-guide')) el.remove();
  if (!safeArea?.enabled) return;
  const marginPx = safeArea.marginPt * pxPerPt;
  for (const slot of slots) {
    const rect = computeSafeAreaRect(slotPxToWH(computeSlotPx(slot, contentAreaWidthPx, contentAreaHeightPx)), marginPx);
    const el = document.createElement('div');
    el.className = 'pl-safe-area-guide';
    el.style.position = 'absolute';
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
    el.style.outline = '1px dashed rgba(0,170,0,0.9)';
    el.style.pointerEvents = 'none';
    contentEl.appendChild(el);
  }
}

// Shared by Header/Footer/Page Number below: an absolutely-positioned text
// element anchored at `anchor` (paper-relative px) and horizontally aligned
// via `anchor.align` — CSS's own text measurement (via the `translate(-N%,
// -50%)` idiom) stands in for the font-metrics math export.js's
// drawAnchoredText() needs to do by hand, since the DOM already knows how
// wide its own text is.
function renderMarginBandText(paperEl, className, text, anchor, sizePt, pxPerPt) {
  let el = paperEl.querySelector(`:scope > .${className}`);
  if (!text) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.className = className;
    el.style.position = 'absolute';
    el.style.whiteSpace = 'nowrap';
    el.style.pointerEvents = 'none';
    el.style.fontFamily = 'Helvetica, Arial, sans-serif';
    paperEl.appendChild(el);
  }
  el.textContent = text;
  el.style.fontSize = `${sizePt * pxPerPt}px`;
  el.style.left = `${anchor.x * pxPerPt}px`;
  el.style.top = `${anchor.y * pxPerPt}px`;
  const xShift = anchor.align === 'center' ? '-50%' : anchor.align === 'right' ? '-100%' : '0';
  el.style.transform = `translate(${xShift}, -50%)`;
}

// §16 Header / Footer — drawn relative to `paperEl` (not the content-area
// element renderPaper() creates), since the header/footer bands live in the
// margin OUTSIDE the content area, same reason renderCropMarks() above
// stays content-area-relative while this doesn't.
export function renderHeaderFooter(paperEl, layout, headerFooter) {
  const pxPerPt = layout.paperPx.width / layout.paperPt.width;
  if (!headerFooter) {
    renderMarginBandText(paperEl, 'pl-header', null);
    renderMarginBandText(paperEl, 'pl-footer', null);
    return;
  }
  const bands = computeHeaderFooterBandsPt(layout.paperPt.width, layout.paperPt.height, layout.contentAreaPt);
  renderMarginBandText(
    paperEl, 'pl-header',
    headerFooter.header?.enabled ? headerFooter.header.text : null,
    computeTextAnchorInBand(bands.header, headerFooter.header?.align),
    headerFooter.fontSizePt, pxPerPt,
  );
  renderMarginBandText(
    paperEl, 'pl-footer',
    headerFooter.footer?.enabled ? headerFooter.footer.text : null,
    computeTextAnchorInBand(bands.footer, headerFooter.footer?.align),
    headerFooter.fontSizePt, pxPerPt,
  );
}

// §16 Page Number — "1 / 10" format at one of 6 margin-band anchors.
// `pageIndex` is 0-based (same convention as everywhere else in the model).
export function renderPageNumber(paperEl, layout, pageNumber, pageIndex, totalPages) {
  const pxPerPt = layout.paperPx.width / layout.paperPt.width;
  if (!pageNumber?.enabled) {
    renderMarginBandText(paperEl, 'pl-page-number', null);
    return;
  }
  const anchor = computePageNumberAnchorPt(pageNumber.position, layout.paperPt.width, layout.paperPt.height, layout.contentAreaPt);
  renderMarginBandText(paperEl, 'pl-page-number', formatPageNumber(pageNumber.format, pageIndex + 1, totalPages), anchor, pageNumber.fontSizePt, pxPerPt);
}

// §16 Text Box — page-level annotations, content-area-relative like Slots
// (computeSlotPx() reads the same x/y/w/h shape). Alignment via CSS flexbox
// and rotation via CSS `rotate()` around the box's own center — the SAME
// rotationDeg CONVENTION (Y-down, clockwise-positive) slotContentMatrix()
// already uses for Slot content, so no sign flip is needed here (export.js's
// computeRotatedTextMatrix achieves the same visual result on the Export
// side via its own pdfPageFlipMatrix composition, not a flipped sign — see
// decision_log D-019).
export function renderTextBoxes(contentEl, textBoxes, contentAreaWidthPx, contentAreaHeightPx, pxPerPt) {
  for (const el of contentEl.querySelectorAll(':scope > .pl-text-box')) el.remove();
  for (const box of sortByZOrder(textBoxes ?? [])) {
    const rectPx = computeSlotPx(box, contentAreaWidthPx, contentAreaHeightPx);
    const el = document.createElement('div');
    el.className = 'pl-text-box';
    el.dataset.textBoxId = box.id;
    el.style.position = 'absolute';
    el.style.left = `${rectPx.x}px`;
    el.style.top = `${rectPx.y}px`;
    el.style.width = `${rectPx.width}px`;
    el.style.height = `${rectPx.height}px`;
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = box.align === 'center' ? 'center' : box.align === 'right' ? 'flex-end' : 'flex-start';
    el.style.fontSize = `${box.fontSizePt * pxPerPt}px`;
    el.style.fontWeight = box.bold ? 'bold' : 'normal';
    el.style.fontFamily = 'Helvetica, Arial, sans-serif';
    el.style.transform = `rotate(${box.rotationDeg}deg)`;
    el.style.pointerEvents = 'none';
    el.style.whiteSpace = 'nowrap';
    el.style.overflow = 'hidden';
    el.textContent = box.text;
    contentEl.appendChild(el);
  }
}

// §16 Watermark — text or image, centered on the page, rotated, at a fixed
// opacity. `imageContent` (only used for `type === 'image'`) is `{ url,
// naturalWidth, naturalHeight } | null` — a Source Engine thumbnail/preview
// entry, same "caller resolves content, this file only applies it" split as
// renderSlotContent()'s `content` param (§4.1 — this file has no Source
// Engine dependency of its own).
export function renderWatermark(contentEl, watermark, contentAreaWidthPx, contentAreaHeightPx, pxPerPt, imageContent) {
  const existing = contentEl.querySelector(':scope > .pl-watermark');
  if (existing) existing.remove();
  if (!watermark?.enabled) return;

  const el = document.createElement('div');
  el.className = 'pl-watermark';
  el.style.position = 'absolute';
  el.style.left = `${contentAreaWidthPx / 2}px`;
  el.style.top = `${contentAreaHeightPx / 2}px`;
  el.style.opacity = String(watermark.opacity);
  el.style.pointerEvents = 'none';

  if (watermark.type === 'text' && watermark.text) {
    el.textContent = watermark.text;
    el.style.fontSize = `${watermark.fontSizePt * pxPerPt}px`;
    el.style.fontFamily = 'Helvetica, Arial, sans-serif';
    el.style.whiteSpace = 'nowrap';
    el.style.transform = `translate(-50%, -50%) rotate(${watermark.rotationDeg}deg)`;
  } else if (watermark.type === 'image' && imageContent) {
    const size = computeWatermarkImageSizePt(contentAreaWidthPx, imageContent.naturalWidth, imageContent.naturalHeight, watermark.widthFraction);
    const img = document.createElement('img');
    img.src = imageContent.url;
    img.style.width = `${size.width}px`;
    img.style.height = `${size.height}px`;
    img.style.display = 'block';
    el.style.transform = `translate(-50%, -50%) rotate(${watermark.rotationDeg}deg)`;
    el.appendChild(img);
  } else {
    return; // nothing resolved to draw yet (e.g. image type, source still loading)
  }

  contentEl.appendChild(el);
}
